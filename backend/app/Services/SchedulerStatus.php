<?php

declare(strict_types=1);

namespace App\Services;

use App\Console\Commands\SchedulerHeartbeatCommand;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Reads the heartbeat written by `asetto:scheduler-heartbeat` (scheduled
 * everyMinute) to tell whether the OS cron is actually running the Laravel
 * scheduler. When stale/absent, the outbox flush and monthly depreciation are
 * not running — the UI surfaces an alert.
 */
class SchedulerStatus
{
    /** Max tolerable gap (seconds) between heartbeats before alerting. */
    public const STALE_THRESHOLD_SECONDS = 180;

    public function lastHeartbeat(): ?Carbon
    {
        $value = Cache::get(SchedulerHeartbeatCommand::CACHE_KEY);
        if ($value === null) {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    public function isHealthy(): bool
    {
        $last = $this->lastHeartbeat();

        return $last !== null && abs($last->diffInSeconds(now())) <= self::STALE_THRESHOLD_SECONDS;
    }

    /** @return array{healthy: bool, last: ?string, age_seconds: ?int, threshold_seconds: int} */
    public function status(): array
    {
        $last = $this->lastHeartbeat();

        return [
            'healthy' => $this->isHealthy(),
            'last' => $last?->toIso8601String(),
            'age_seconds' => $last ? (int) abs($last->diffInSeconds(now())) : null,
            'threshold_seconds' => self::STALE_THRESHOLD_SECONDS,
        ];
    }
}
