<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS)
    |--------------------------------------------------------------------------
    |
    | In local dev the SPA (e.g. http://localhost:5180) and this backend
    | (http://localhost:8090) run on different origins, so the browser needs
    | explicit CORS with credentials for the Sanctum cookie session to work.
    | In production they share one eTLD+1 and this is effectively a no-op.
    |
    | NOTE: with credentials, the allowed origin must be explicit (never "*").
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'auth/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter([
        env('ASETTO_SPA_URL', 'http://localhost:5180'),
        env('FRONTEND_URL'),
    ])),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,
];
