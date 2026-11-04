<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Scheduled tasks
|--------------------------------------------------------------------------
| Run locally with `php artisan schedule:work` (serve.ps1 -Live starts this),
| or in production via a single system cron calling `schedule:run` each minute.
*/

// Retry the Akunta journal queue often, so anything stuck (e.g. Akunta offline)
// is delivered as soon as it comes back.
Schedule::command('asetto:flush-outbox')
    ->everyFiveMinutes()
    ->withoutOverlapping();

// Monthly depreciation (auto-post or draft, per settings).
Schedule::command('asetto:run-depreciation')
    ->monthlyOn(28, '02:00')
    ->withoutOverlapping();
