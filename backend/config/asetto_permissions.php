<?php

/*
|--------------------------------------------------------------------------
| Asetto permission catalog + preset roles
|--------------------------------------------------------------------------
|
| Source of truth for Asetto's RBAC. Permission codes are registered against
| the `asetto` App row via PermissionRegistry (AppServiceProvider@boot), and
| the preset roles are created + wired to these permissions by RolesSeeder.
| Roles follow the user's 3-role model; `admin` bypasses checks entirely.
|
*/

return [
    'catalog' => [
        ['code' => 'asset.read', 'group' => 'Aset', 'label' => 'Lihat daftar & detail aset'],
        ['code' => 'asset.read_own', 'group' => 'Aset', 'label' => 'Lihat aset tanggung jawab sendiri'],
        ['code' => 'asset.view_value', 'group' => 'Aset', 'label' => 'Lihat nilai & angka aset'],
        ['code' => 'asset.manage', 'group' => 'Aset', 'label' => 'Kelola aset (tambah/ubah/hapus/pelimpahan/kondisi/foto/pembelian)'],
        ['code' => 'disposal.manage', 'group' => 'Aset', 'label' => 'Pelepasan & penjualan aset'],
        ['code' => 'depreciation.run', 'group' => 'Depresiasi', 'label' => 'Jalankan & setujui depresiasi'],
        ['code' => 'journal.read', 'group' => 'Integrasi', 'label' => 'Lihat outbox jurnal Akunta'],
        ['code' => 'settings.manage', 'group' => 'Pengaturan', 'label' => 'Kelola pengaturan, role, & custodian'],
    ],

    // code => { name, permissions: '*' (all, bypass) | string[] }
    'roles' => [
        'admin' => [
            'name' => 'Admin',
            'permissions' => '*',
        ],
        'asset_manager' => [
            'name' => 'Asset Manager',
            'permissions' => ['asset.read', 'asset.view_value', 'asset.manage', 'disposal.manage', 'depreciation.run', 'journal.read'],
        ],
        'asset_user' => [
            'name' => 'User',
            'permissions' => ['asset.read_own'],
        ],
    ],

    // Role seniority for impersonation / self-protection guards (higher = more senior).
    'ranks' => [
        'admin' => 100,
        'asset_manager' => 50,
        'asset_user' => 10,
    ],
];
