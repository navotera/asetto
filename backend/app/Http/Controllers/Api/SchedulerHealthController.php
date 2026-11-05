<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SchedulerStatus;
use Illuminate\Http\JsonResponse;

/**
 * Scheduler/cron health for the Settings UI + the app-wide alert. Reports
 * whether the OS cron is driving the Laravel scheduler, the exact cron line to
 * install, and Asetto's scheduled tasks.
 */
class SchedulerHealthController extends Controller
{
    /** @var array<int, array{command: string, label: string, schedule: string}> */
    private const TASKS = [
        [
            'command' => 'asetto:flush-outbox',
            'label' => 'Kirim ulang antrean jurnal ke Akunta',
            'schedule' => 'Setiap 5 menit',
        ],
        [
            'command' => 'asetto:run-depreciation',
            'label' => 'Depresiasi bulanan otomatis',
            'schedule' => 'Setiap tanggal 28 pukul 02:00',
        ],
        [
            'command' => 'asetto:prune-journals',
            'label' => 'Bersihkan antrean lama (Trashed / Berhasil)',
            'schedule' => 'Setiap hari pukul 01:30',
        ],
    ];

    public function index(SchedulerStatus $scheduler): JsonResponse
    {
        return response()->json([
            'scheduler' => [
                ...$scheduler->status(),
                'working_directory' => base_path(),
                'cron_command' => $this->cronCommand(),
            ],
            'tasks' => self::TASKS,
        ]);
    }

    private function cronCommand(): string
    {
        return "* * * * * cd '".str_replace("'", "'\\''", base_path())."' && php artisan schedule:run >> /dev/null 2>&1";
    }
}
