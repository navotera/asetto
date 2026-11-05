<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/**
 * Writes a timestamp into the cache every minute so the UI can detect whether
 * the OS cron is actually invoking `php artisan schedule:run`. If the heartbeat
 * goes stale, the scheduler (and thus the outbox flush + monthly depreciation)
 * is not running.
 */
class SchedulerHeartbeatCommand extends Command
{
    protected $signature = 'asetto:scheduler-heartbeat';

    protected $description = 'Write a heartbeat so the UI can confirm the Laravel scheduler/cron is running.';

    public const CACHE_KEY = 'asetto:scheduler:last_heartbeat';

    public function handle(): int
    {
        Cache::put(self::CACHE_KEY, now()->toIso8601String(), now()->addDays(7));
        $this->info('Heartbeat: '.now()->toIso8601String());

        return self::SUCCESS;
    }
}
