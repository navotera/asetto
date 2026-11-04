<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\DepreciationEngine;
use App\Services\DepreciationService;
use App\Services\SettingsService;
use Illuminate\Console\Command;

/**
 * Scheduled monthly depreciation. Depending on the `depreciation.mode` setting:
 *   - auto_post (default): builds + commits the run and enqueues the journal.
 *   - draft: builds a draft run for an admin to review and approve.
 * Idempotent — skips periods already posted.
 */
class RunScheduledDepreciation extends Command
{
    protected $signature = 'asetto:run-depreciation {--period= : YYYY-MM, defaults to the earliest pending period}';

    protected $description = 'Run scheduled depreciation (auto-post or draft, per settings).';

    public function handle(
        DepreciationEngine $engine,
        DepreciationService $depreciation,
        SettingsService $settings,
    ): int {
        $period = (string) ($this->option('period') ?: $engine->pendingPeriod());
        if ($period === '') {
            $this->info('Tidak ada periode yang perlu didepresiasi.');

            return self::SUCCESS;
        }

        if ($depreciation->alreadyPosted($period)) {
            $this->info("Periode {$period} sudah diposting. Dilewati.");

            return self::SUCCESS;
        }

        $mode = $settings->depreciationMode();
        $run = $depreciation->runForPeriod($period, commit: $mode === 'auto_post');

        if (! $run) {
            $this->info("Tidak ada aset yang perlu didepresiasi untuk {$period}.");

            return self::SUCCESS;
        }

        $mode === 'auto_post'
            ? $this->info("Depresiasi {$period} diposting otomatis (run {$run->id}), jurnal masuk antrean Akunta.")
            : $this->info("Draft depresiasi {$period} dibuat (run {$run->id}) menunggu persetujuan admin.");

        return self::SUCCESS;
    }
}
