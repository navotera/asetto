<?php

namespace App\Providers;

use Akunta\EcopaClient\EcopaClient;
use App\Services\AsettoEcopaClient;
use Illuminate\Support\ServiceProvider;

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
        //
    }
}
