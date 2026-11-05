<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\JournalOutbox;
use App\Services\SettingsService;
use Illuminate\Console\Command;

/**
 * Prunes the economic-event queue per the retention settings:
 *   - Trashed items older than `retention.trashed_months` (since trashed).
 *   - Accepted items older than `retention.accepted_years`.
 * A retention value of 0 disables pruning for that bucket.
 */
class PruneJournalOutbox extends Command
{
    protected $signature = 'asetto:prune-journals';

    protected $description = 'Delete old Trashed and Accepted journal-outbox entries per retention settings.';

    public function handle(SettingsService $settings): int
    {
        $trashedMonths = $settings->retentionTrashedMonths();
        $acceptedYears = $settings->retentionAcceptedYears();

        $trashedDeleted = 0;
        if ($trashedMonths > 0) {
            $trashedDeleted = JournalOutbox::query()
                ->where('status', 'trashed')
                ->where('updated_at', '<', now()->subMonths($trashedMonths))
                ->delete();
        }

        $acceptedDeleted = 0;
        if ($acceptedYears > 0) {
            $acceptedDeleted = JournalOutbox::query()
                ->where('status', 'accepted')
                ->where('created_at', '<', now()->subYears($acceptedYears))
                ->delete();
        }

        $this->info("Pruned {$trashedDeleted} trashed + {$acceptedDeleted} accepted journal entries.");

        return self::SUCCESS;
    }
}
