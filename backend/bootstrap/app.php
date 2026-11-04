<?php

use App\Http\Middleware\VerifyEcopaSignature;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // SPA cookie auth (apps/web): promote first-party calls from the
        // configured Sanctum stateful domains so `auth:sanctum` resolves the
        // session user. Mirrors apps/poso.
        $middleware->statefulApi();

        // akunta_entity cookie is shared across ECOSYSTEM_BASE_DOMAIN so sibling
        // apps read the same plaintext value — exempt from cookie encryption.
        $middleware->encryptCookies(except: [
            'akunta_entity',
        ]);

        // Ecopa posts here server-to-server (no browser session / CSRF token);
        // authenticity is enforced by HMAC signature, not CSRF.
        $middleware->validateCsrfTokens(except: [
            'webhooks/ecopa',
        ]);

        $middleware->alias([
            'ecopa.signature' => VerifyEcopaSignature::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
