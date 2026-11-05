<?php

namespace App\Providers;

use Akunta\EcopaClient\EcopaClient;
use App\Services\AsettoEcopaClient;
use App\Services\SettingsService;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Replace the shared ecopa-client with Asetto's hardened ID-token
        // verifier (RS256 pin, aud/nbf/discovery-issuer checks) without editing
        // the package. `extend` is order-independent across providers.
        $this->app->extend(EcopaClient::class, fn ($service, $app) => new AsettoEcopaClient($app['config']->get('ecopa')));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Apply the configured timezone (from General settings) app-wide.
        try {
            if (Schema::hasTable('app_settings')) {
                $tz = $this->app->make(SettingsService::class)->timezone();
                config(['app.timezone' => $tz]);
                date_default_timezone_set($tz);
            }
        } catch (Throwable) {
            // Settings not available yet (e.g. during migrate) — keep the default.
        }
    }
}
