<?php

use App\Http\Controllers\Auth\EcopaController;
use App\Http\Controllers\Webhooks\EcopaWebhookController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web routes — SSO entrypoints + Ecopa webhook
|--------------------------------------------------------------------------
| Asetto has NO username/password login. Every login is a silent OIDC
| redirect to Ecopa (akunta/ecopa-client). The SPA (web/) is served
| separately and talks to the /api/v1 surface via Sanctum cookie auth.
*/

Route::get('/', function () {
    if (config('ecopa.client_id')) {
        return redirect()->route('sso.login');
    }

    return response()->json([
        'app' => 'Asetto',
        'tier' => config('asetto.tier'),
        'domain' => config('asetto.domain'),
    ]);
});

// Default `login` route — Laravel's AuthenticationException handler resolves
// route('login') as the guest fallback. Point it at Ecopa SSO when configured.
Route::get('/login', function () {
    return config('ecopa.client_id')
        ? redirect()->route('ecopa.login')
        : abort(404, 'Login disabled — Ecopa not configured.');
})->name('login');

// Ecopa-launched entrypoint. Ecopa's ecosystem menu opens <app>/sso/login.
Route::get('/sso/login', function () {
    if (auth()->check()) {
        return redirect('/');
    }

    return config('ecopa.client_id')
        ? redirect()->route('ecopa.login')
        : abort(404, 'SSO disabled — Ecopa not configured.');
})->name('sso.login');

// Ecopa (Main Tier) SSO — OIDC authorization-code flow.
Route::middleware('web')->group(function () {
    Route::get('/auth/ecopa/redirect', [EcopaController::class, 'redirect'])->name('ecopa.login');
    Route::get('/auth/ecopa/callback', [EcopaController::class, 'callback'])->name('ecopa.callback');
    Route::match(['get', 'post'], '/auth/ecopa/logout', function () {
        auth()->logout();
        request()->session()->invalidate();
        request()->session()->regenerateToken();

        $base = rtrim((string) config('ecopa.url'), '/');
        $redirect = url('/');

        return redirect()->away(
            $base.'/oauth/logout?post_logout_redirect_uri='.urlencode($redirect)
        );
    })->name('ecopa.logout');
});

// Single Ecopa webhook endpoint — HMAC-verified, idempotent lifecycle events.
Route::post('/webhooks/ecopa', [EcopaWebhookController::class, 'handle'])
    ->middleware('ecopa.signature')
    ->name('webhooks.ecopa');
