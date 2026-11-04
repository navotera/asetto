<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Akunta Auto-Journal API (server-to-server)
    |--------------------------------------------------------------------------
    |
    | Asetto is a sub-ledger of assets. Economic events (depreciation expense,
    | disposals, gain/loss on sale) are posted as balanced journals to Akunta's
    | general ledger via the akunta/api-client package — NEVER from the browser.
    | Each posting carries an idempotency key so retries never double-post.
    |
    */

    'auto_journal' => [
        'base_url' => env('ACCOUNTING_API_BASE_URL', 'http://localhost'),
        'token' => env('ACCOUNTING_API_TOKEN', ''),
        'timeout_seconds' => (float) env('ACCOUNTING_API_TIMEOUT', 10.0),
        'retries' => (int) env('ACCOUNTING_API_RETRIES', 2),
        'retry_base_delay_ms' => (int) env('ACCOUNTING_API_RETRY_DELAY_MS', 200),
    ],
];
