<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Asset;
use App\Models\DepreciationLine;
use App\Models\DepreciationRun;
use App\Support\AssetAudit;
use Illuminate\Support\Facades\DB;

/**
 * Orchestrates depreciation runs: building a draft (no side effects) and
 * committing it (apply to assets + enqueue the balanced journal to Akunta).
 * Shared by the API controller and the scheduled command.
 */
class DepreciationService
{
    public function __construct(
        private readonly DepreciationEngine $engine,
        private readonly AkuntaPostingService $posting,
    ) {}

    public function alreadyPosted(string $period): bool
    {
        return DepreciationRun::query()->where('period', $period)->where('status', 'posted')->exists();
    }

    /**
     * Create a draft run (+lines) for a period, or null when nothing is due.
     * When $commit is true the run is immediately applied + posted.
     */
    public function runForPeriod(string $period, bool $commit): ?DepreciationRun
    {
        if ($this->alreadyPosted($period)) {
            return null;
        }

        $rows = $this->engine->buildLines($period);
        if ($rows === []) {
            return null;
        }

        $run = $this->makeDraft($period, $rows);

        return $commit ? $this->commitRun($run) : $run;
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    public function makeDraft(string $period, array $rows): DepreciationRun
    {
        return DB::transaction(function () use ($period, $rows): DepreciationRun {
            $total = 0.0;
            $run = DepreciationRun::query()->create([
                'period' => $period,
                'status' => 'draft',
                'total_amount' => 0,
            ]);

            foreach ($rows as $row) {
                $asset = $row['asset'];
                DepreciationLine::query()->create([
                    'run_id' => $run->id,
                    'asset_id' => $asset->id,
                    'amount' => $row['amount'],
                    'book_value_before' => $row['book_value_before'],
                    'book_value_after' => $row['book_value_after'],
                ]);
                $total += $row['amount'];
            }

            $run->total_amount = $total;
            $run->save();

            return $run;
        });
    }

    /** Apply a draft run to its assets, mark it posted, and enqueue the journal. */
    public function commitRun(DepreciationRun $run): DepreciationRun
    {
        DB::transaction(function () use ($run): void {
            foreach ($run->lines as $line) {
                $asset = Asset::query()->find($line->asset_id);
                if (! $asset) {
                    continue;
                }
                $asset->accumulated_depreciation = (float) $asset->accumulated_depreciation + (float) $line->amount;
                $asset->last_depreciated_period = $run->period;
                $asset->save();
                AssetAudit::log($asset->id, 'depreciation', "Depresiasi {$run->period}: Rp ".number_format((float) $line->amount, 0, ',', '.'));
            }

            $run->status = 'posted';
            $run->posted_at = now();
            $run->save();
        });

        $outboxes = $this->posting->postDepreciationRun($run->load('lines'));
        $run->forceFill(['journal_id' => $outboxes[0]->id ?? null])->save();

        return $run;
    }
}
