<?php

return [
    // Ecosystem position (see AGENTS.md §2). Asetto is a third-tier domain app:
    // identity via Ecopa (SSO), accounting via Akunta (general ledger).
    'tier' => 'child_app',
    'domain' => 'asset_management',

    'main_tier' => [
        'name' => 'Ecopa',
        'role' => 'identity_provider',
    ],

    'accounting_tier' => [
        'name' => 'Akunta',
        'role' => 'general_ledger',
    ],

    // Where the SPA lives (used to redirect back after login in local dev where
    // the SPA and backend run on different ports). Defaults to APP_URL.
    'spa_url' => env('ASETTO_SPA_URL', env('APP_URL')),

    // Identifies Asetto as the `source` of events sent to Akunta's Auto Mapping
    // ingest (so the Akunta admin can tell which app a raw event came from).
    'events_source_url' => env('ASETTO_EVENTS_SOURCE_URL', env('APP_URL')),

    /*
    |--------------------------------------------------------------------------
    | Dev login (Ecopa bypass) — LOCAL ONLY
    |--------------------------------------------------------------------------
    | A temporary on/off switch to develop/review Asetto without a running
    | Ecopa. When enabled, the login routes log in a seeded dev admin shadow
    | user instead of redirecting to Ecopa's OIDC flow. There is NO password —
    | it is a no-credential local shim, hard-disabled in production. Turn it
    | off (and configure Ecopa) to restore real SSO. See AGENTS.md §8.2.
    */
    'dev_login' => [
        'enabled' => (bool) env('ASETTO_DEV_LOGIN', false) && env('APP_ENV', 'production') !== 'production',
        'email' => env('ASETTO_DEV_LOGIN_EMAIL', 'dev@asetto.test'),
        'name' => env('ASETTO_DEV_LOGIN_NAME', 'Dev Admin'),
    ],
];
