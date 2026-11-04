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
];
