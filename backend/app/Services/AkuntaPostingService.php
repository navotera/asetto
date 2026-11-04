<?php

declare(strict_types=1);

namespace App\Services;

use Akunta\ApiClient\AutoJournalClient;
use Akunta\ApiClient\Exceptions\ApiException;
use Akunta\ApiClient\Exceptions\DuplicateIdempotencyException;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\DepreciationRun;
use App\Models\Disposal;
use App\Models\JournalOutbox;
use Illuminate\Support\Facades\Log;

/**
 * Turns Asetto economic events into balanced journals and pushes them to
 * Akunta's general ledger server-to-server (never from the browser).
 *
 * Every journal lands in the outbox first with a stable idempotency key, then
 * we attempt delivery via akunta/api-client. When no Akunta token is configured
 * (local/dev), the row stays `queued` — the posting surface is still exercised
 * end-to-end without a live ledger. See AGENTS.md §6, §8.4; the exact Akunta
 * journal payload mapping is finalized against Akunta's posting contract.
 */
class AkuntaPostingService
{
    public function __construct(private readonly AutoJournalClient $client) {}

    /**
     * Build + enqueue the depreciation journal for a posted run.
     *
     * Dr Depreciation Expense / Cr Accumulated Depreciation, grouped per
     * category so each GL account pair nets correctly.
     */
    public function postDepreciationRun(DepreciationRun $run): JournalOutbox
    {
        $byCategory = [];
        foreach ($run->lines as $line) {
            $asset = Asset::find($line->asset_id);
            $category = $asset?->category;
            if (! $category instanceof AssetCategory) {
                continue;
            }
            $byCategory[$category->id] ??= ['category' => $category, 'amount' => 0.0];
            $byCategory[$category->id]['amount'] += (float) $line->amount;
        }

        $lines = [];
        foreach ($byCategory as $group) {
            /** @var AssetCategory $category */
            $category = $group['category'];
            $amount = round($group['amount'], 2);
            if ($amount <= 0) {
                continue;
            }
            $lines[] = $this->line($category->akunta_dep_expense_account, 'Beban Depresiasi - '.$category->name, $amount, 0);
            $lines[] = $this->line($category->akunta_accum_dep_account, 'Akumulasi Depresiasi - '.$category->name, 0, $amount);
        }

        return $this->enqueueAndPush(
            idempotencyKey: 'dep:'.$run->period,
            source: 'depreciation',
            sourceRef: $run->id,
            date: $run->period.'-28',
            memo: 'Depresiasi aset periode '.$run->period,
            lines: $lines,
        );
    }

    /**
     * Build + enqueue the disposal journal: derecognize the asset (remove cost
     * and accumulated depreciation), record proceeds, and book the gain/loss.
     */
    public function postDisposal(Disposal $disposal, Asset $asset): JournalOutbox
    {
        $category = $asset->category;
        $cost = (float) $asset->acquisition_cost;
        $accum = (float) $asset->accumulated_depreciation;
        $proceeds = (float) $disposal->proceeds;
        $gainLoss = (float) $disposal->gain_loss;

        $cash = (string) config('asetto.accounts.cash', '1-1000');
        $gainLossAccount = (string) config('asetto.accounts.gain_loss_disposal', '7-9000');

        $lines = [];
        if ($accum > 0) {
            $lines[] = $this->line($category?->akunta_accum_dep_account ?? '', 'Akumulasi Depresiasi', round($accum, 2), 0);
        }
        if ($proceeds > 0) {
            $lines[] = $this->line($cash, 'Kas/Bank - hasil pelepasan', round($proceeds, 2), 0);
        }
        $lines[] = $this->line($category?->akunta_asset_account ?? '', 'Aset - '.$asset->name, 0, round($cost, 2));

        if (abs($gainLoss) > 0.005) {
            $gainLoss > 0
                ? $lines[] = $this->line($gainLossAccount, 'Laba pelepasan aset', 0, round($gainLoss, 2))
                : $lines[] = $this->line($gainLossAccount, 'Rugi pelepasan aset', round(-$gainLoss, 2), 0);
        }

        return $this->enqueueAndPush(
            idempotencyKey: 'disp:'.$disposal->id,
            source: 'disposal',
            sourceRef: $disposal->id,
            date: $disposal->date?->format('Y-m-d') ?? now()->format('Y-m-d'),
            memo: ($disposal->type === 'sale' ? 'Penjualan' : 'Penghapusan').' aset '.$asset->code,
            lines: $lines,
        );
    }

    /** @param array<int, array<string, mixed>> $lines */
    private function enqueueAndPush(
        string $idempotencyKey,
        string $source,
        string $sourceRef,
        string $date,
        string $memo,
        array $lines,
    ): JournalOutbox {
        $outbox = JournalOutbox::query()->firstOrNew(['idempotency_key' => $idempotencyKey]);
        $outbox->fill([
            'source' => $source,
            'source_ref' => $sourceRef,
            'date' => $date,
            'memo' => $memo,
            'lines' => $lines,
        ]);
        if (! $outbox->exists || $outbox->status !== 'posted') {
            $outbox->status = 'queued';
        }
        $outbox->save();

        $this->push($outbox);

        return $outbox->refresh();
    }

    /** Attempt delivery to Akunta. No-op (stays queued) when unconfigured. */
    public function push(JournalOutbox $outbox): void
    {
        if ($outbox->status === 'posted') {
            return;
        }

        if (trim((string) config('akunta-api-client.auto_journal.token')) === '') {
            // Dev/local: no Akunta token — leave queued for a later flush.
            return;
        }

        try {
            $response = $this->client->postJournal([
                'idempotency_key' => $outbox->idempotency_key,
                'source' => 'asetto:'.$outbox->source,
                'source_ref' => $outbox->source_ref,
                'date' => $outbox->date?->format('Y-m-d'),
                'memo' => $outbox->memo,
                'lines' => $outbox->lines,
            ]);

            $outbox->forceFill([
                'status' => 'posted',
                'akunta_journal_no' => $response->journalId ?: null,
                'last_error' => null,
                'posted_at' => now(),
            ])->save();
        } catch (DuplicateIdempotencyException $e) {
            // Already posted in Akunta — idempotency did its job.
            $outbox->forceFill([
                'status' => 'posted',
                'akunta_journal_no' => $e->existingJournalId,
                'last_error' => null,
                'posted_at' => now(),
            ])->save();
        } catch (ApiException $e) {
            Log::warning('asetto.akunta.post_failed', [
                'idempotency_key' => $outbox->idempotency_key,
                'error' => $e->getMessage(),
            ]);
            $outbox->forceFill(['status' => 'failed', 'last_error' => $e->getMessage()])->save();
        }
    }

    /** @return array<string, mixed> */
    private function line(string $accountCode, string $accountName, float $debit, float $credit): array
    {
        return [
            'account_code' => $accountCode,
            'account_name' => $accountName,
            'debit' => round($debit, 2),
            'credit' => round($credit, 2),
        ];
    }
}
