<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Ecopa Main Tier (Identity Provider / SSO)
    |--------------------------------------------------------------------------
    |
    | Asetto is a child app (third tier) in the Akunta ecosystem. Identity is
    | delegated entirely to Ecopa via the OIDC-style authorization-code flow
    | provided by the akunta/ecopa-client package. There is NO username/password
    | login in Asetto. New installations receive and encrypt the SSO + webhook
    | credentials through the first-access registration approval callback, so
    | these env values only seed local/dev or legacy deployments.
    |
    */

    'url' => env('ECOPA_URL', 'https://home.opensynergic.com'),

    'client_id' => env('ECOPA_CLIENT_ID'),
    'client_secret' => env('ECOPA_CLIENT_SECRET'),
    'redirect_uri' => env('ECOPA_REDIRECT_URI'),

    // Bearer token for /api/* server-to-server calls to Ecopa.
    'api_token' => env('ECOPA_API_TOKEN'),

    // Name shown to the Ecopa admin when Asetto registers itself.
    'registration_name' => env('ECOPA_REGISTRATION_NAME', 'Asetto'),

    // Canonical child-app base URL. The first-access wizard only asks for the
    // Ecopa URL + Registration Token; base_url/webhook_url derive from here.
    'registration_base_url' => env('ECOPA_REGISTRATION_BASE_URL', env('APP_URL')),

    // Asetto's own slug as registered in Ecopa. Keep consistent with the slug
    // sent in the registration request and filtered out of the "Ekosistem" menu.
    'self_slug' => env('ECOPA_SELF_SLUG', 'asetto'),

    // Shared secret used to verify permanent lifecycle webhook signatures.
    'webhook_secret' => env('ECOPA_WEBHOOK_SECRET'),

    'expected_issuer' => env('ECOPA_EXPECTED_ISSUER', 'ecopa'),

    'jwks_cache_seconds' => (int) env('ECOPA_JWKS_CACHE_SECONDS', 3600),

    'http_timeout' => (int) env('ECOPA_HTTP_TIMEOUT', 8),

    'profile_in_nav' => (bool) env('ECOPA_PROFILE_IN_NAV', true),

    // Route names consumed by the ecopa-client package.
    'routes' => [
        'login' => env('ECOPA_LOGIN_ROUTE', 'ecopa.login'),
        'callback' => env('ECOPA_CALLBACK_ROUTE', 'ecopa.callback'),
        'logout' => env('ECOPA_LOGOUT_ROUTE', 'ecopa.logout'),
    ],
];
