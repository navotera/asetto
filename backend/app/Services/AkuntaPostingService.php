<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\DepreciationRun;
use App\Models\Disposal;
use App\Models\JournalOutbox;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Emits Asetto economic events to Akunta's Auto Mapping ingest endpoint
 * server-to-server (never from the browser). Asetto sends raw business JSON —
 * NO account codes. The Akunta admin maps fields → accounts once per
 * `source_type`; correlation across time is by the asset identity carried in
 * the payload + a stable idempotency key.
 *
 * `entity_id` on the outbox is Asetto's OWN entity id. It is sent as the ingest
 * `source_entity_id`, which the Akunta admin maps to an Akunta entity once (via
 * AutoMappingEntityLink). Asetto never holds Akunta's internal entity ULIDs.
 *
 * Every event lands in the outbox first (`queued`), then we attempt ingest. A
 * 202 marks it `accepted` (+ `akunta_raw_id`); a failure marks it `failed` for
 * a later `asetto:flush-outbox` retry. When no Akunta token is configured
 * (local/dev), the row stays `queued`. See AGENTS.md §6 and the Auto Mapping
 * contract.
 */
class AkuntaPostingService
{
    public function __construct(
        private readonly AutoMappingClient $client,
        private readonly SettingsService $settings,
    ) {}

    /**
     * Acquisition (B): emitted when purchase data is entered. Dr {asset} /
     * Cr {cash|payable} — mapped per category in Akunta. One event per asset.
     */
    public function postAcquisition(Asset $asset): ?JournalOutbox
    {
        if (! $this->settings->syncEnabled('acquisition')) {
            return null;
        }
        $purchase = $asset->purchase;
        if (! $purchase || ! $asset->entity_id) {
            return null;
        }

        $amount = round((float) $purchase->amount, 2);
        if ($amount <= 0) {
            return null; // ingest rejects zero-amount lines
        }

        $category = $asset->category;
        $date = $purchase->purchase_date?->format('Y-m-d')
            ?? $asset->acquisition_date?->format('Y-m-d')
            ?? now()->format('Y-m-d');
        $memo = 'Perolehan aset '.$asset->code;

        return $this->enqueueAndPush(
            idempotencyKey: 'asetto:acq:'.$asset->id,
            source: 'acquisition',
            sourceType: 'asetto.acquisition',
            sourceRef: $asset->id,
            entityId: (string) $asset->entity_id,
            date: $date,
            memo: $memo,
            payload: [
                'event' => 'acquisition',
                'asset_id' => $asset->id,
                'asset_code' => $asset->code,
                'asset_name' => $asset->name,
                'category_code' => $category?->code,
                'date' => $date,
                'amount' => $amount,
                'memo' => $memo,
            ],
        );
    }

    /**
     * Depreciation (1): one ingest per (entity × category) so each GL account
     * pair nets correctly. Dr depreciation expense / Cr accumulated depreciation.
     *
     * @return array<int, JournalOutbox>
     */
    public function postDepreciationRun(DepreciationRun $run): array
    {
        if (! $this->settings->syncEnabled('depreciation')) {
            return [];
        }
        $groups = [];
        foreach ($run->lines as $line) {
            $asset = Asset::query()->with('category')->find($line->asset_id);
            $category = $asset?->category;
            if (! $asset || ! $asset->entity_id || ! $category instanceof AssetCategory) {
                continue;
            }
            $key = $asset->entity_id.'|'.$category->id;
            $groups[$key] ??= ['entity_id' => (string) $asset->entity_id, 'category' => $category, 'amount' => 0.0];
            $groups[$key]['amount'] += (float) $line->amount;
        }

        $out = [];
        foreach ($groups as $group) {
            $amount = round($group['amount'], 2);
            if ($amount <= 0) {
                continue;
            }
            /** @var AssetCategory $category */
            $category = $group['category'];
            $memo = 'Depresiasi '.$category->name.' periode '.$run->period;

            $out[] = $this->enqueueAndPush(
                idempotencyKey: 'asetto:dep:'.$group['entity_id'].':'.$run->period.':'.$category->code,
                source: 'depreciation',
                sourceType: 'asetto.depreciation',
                sourceRef: $run->id,
                entityId: $group['entity_id'],
                date: $run->period.'-28',
                memo: $memo,
                payload: [
                    'event' => 'depreciation',
                    'period' => $run->period,
                    'category_code' => $category->code,
                    'category_name' => $category->name,
                    'date' => $run->period.'-28',
                    'amount' => $amount,
                    'memo' => $memo,
                ],
            );
        }

        return $out;
    }

    /**
     * Disposal / write-off (2, 3): derecognize the asset and book the gain/loss.
     * Only legs with a value > 0 are sent (ingest rejects zero-amount lines); a
     * `scenario` field lets the Akunta admin map each structural variant once.
     */
    public function postDisposal(Disposal $disposal, Asset $asset): ?JournalOutbox
    {
        if (! $this->settings->syncEnabled('disposal')) {
            return null;
        }
        if (! $asset->entity_id) {
            return null;
        }

        $category = $asset->category;
        $cost = round((float) $asset->acquisition_cost, 2);
        $accum = round((float) $asset->accumulated_depreciation, 2);
        $proceeds = round((float) $disposal->proceeds, 2);
        $gainLoss = round((float) $disposal->gain_loss, 2);
        $date = $disposal->date?->format('Y-m-d') ?? now()->format('Y-m-d');

        if ($disposal->type === 'writeoff') {
            $scenario = 'writeoff';
        } elseif ($gainLoss > 0.005) {
            $scenario = 'sale_gain';
        } elseif ($gainLoss < -0.005) {
            $scenario = 'sale_loss';
        } else {
            $scenario = 'sale_even';
        }

        $memo = ($disposal->type === 'sale' ? 'Penjualan' : 'Penghapusan').' aset '.$asset->code;

        $payload = [
            'event' => 'disposal',
            'scenario' => $scenario,
            'asset_id' => $asset->id,
            'asset_code' => $asset->code,
            'asset_name' => $asset->name,
            'category_code' => $category?->code,
            'date' => $date,
            'cost' => $cost,
            'memo' => $memo,
        ];
        if ($accum > 0) {
            $payload['accumulated'] = $accum;
        }
        if ($proceeds > 0) {
            $payload['proceeds'] = $proceeds;
        }
        if ($gainLoss > 0.005) {
            $payload['gain'] = $gainLoss;
        } elseif ($gainLoss < -0.005) {
            $payload['loss'] = round(-$gainLoss, 2);
        }

        return $this->enqueueAndPush(
            idempotencyKey: 'asetto:disp:'.$disposal->id,
            source: 'disposal',
            sourceType: 'asetto.disposal',
            sourceRef: $disposal->id,
            entityId: (string) $asset->entity_id,
            date: $date,
            memo: $memo,
            payload: $payload,
        );
    }

    /** @param array<string, mixed> $payload */
    private function enqueueAndPush(
        string $idempotencyKey,
        string $source,
        string $sourceType,
        string $sourceRef,
        string $entityId,
        string $date,
        string $memo,
        array $payload,
    ): JournalOutbox {
        $outbox = JournalOutbox::query()->firstOrNew(['idempotency_key' => $idempotencyKey]);
        $outbox->fill([
            'source' => $source,
            'source_type' => $sourceType,
            'source_ref' => $sourceRef,
            'entity_id' => $entityId,
            'date' => $date,
            'memo' => $memo,
            'payload' => $payload,
        ]);
        if (! $outbox->exists || $outbox->status !== 'accepted') {
            $outbox->status = 'queued';
        }
        $outbox->save();

        $this->push($outbox);

        return $outbox->refresh();
    }

    /** Attempt ingest to Akunta. No-op (stays queued) when unconfigured. */
    public function push(JournalOutbox $outbox): void
    {
        if ($outbox->status === 'accepted') {
            return;
        }

        if (trim((string) config('akunta-api-client.auto_journal.token')) === '') {
            // Dev/local: no Akunta token — leave queued for a later flush.
            return;
        }

        try {
            // $outbox->entity_id is Asetto's own entity id → sent as source_entity_id.
            $response = $this->client->ingest(
                (string) $outbox->entity_id,
                (string) $outbox->source_type,
                (array) $outbox->payload,
                (string) $outbox->idempotency_key,
            );

            $outbox->forceFill([
                'status' => 'accepted',
                'akunta_raw_id' => $response['raw_id'] ?? null,
                'last_error' => null,
                'posted_at' => now(),
            ])->save();
        } catch (Throwable $e) {
            // 4xx = permanent rejection (fix payload/mapping, no blind retry);
            // 5xx / network = transient failure (eligible for the flush cron).
            $code = $e->getCode();
            $status = (is_int($code) && $code >= 400 && $code < 500) ? 'rejected' : 'failed';
            Log::warning('asetto.akunta.ingest_'.$status, [
                'idempotency_key' => $outbox->idempotency_key,
                'source_type' => $outbox->source_type,
                'error' => $e->getMessage(),
            ]);
            $outbox->forceFill(['status' => $status, 'last_error' => $e->getMessage()])->save();
        }
    }
}
