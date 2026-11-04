<?php

declare(strict_types=1);

namespace Database\Seeders;

use Akunta\Rbac\Models\App as RbacApp;
use Akunta\Rbac\Models\Entity;
use Akunta\Rbac\Models\Tenant;
use App\Models\AppSetting;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Custodian;
use App\Services\SettingsService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeds reference + sample asset data that mirrors web/src/api/mock/db.ts, so
 * the SPA shows the same dataset in `live` mode as in `mock`. Also registers
 * the Asetto app row used by the Ecopa lifecycle webhooks.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        RbacApp::query()->firstOrCreate(
            ['code' => (string) config('ecopa.self_slug', 'asetto')],
            ['name' => (string) config('ecopa.registration_name', 'Asetto'), 'version' => '1.0', 'enabled' => true],
        );

        // Default application settings (depreciation mode, storage disk).
        foreach (SettingsService::DEFAULTS as $key => $value) {
            AppSetting::query()->firstOrCreate(['key' => $key], ['value' => $value]);
        }

        // RBAC: permissions catalog + preset roles.
        $this->call(RolesSeeder::class);

        // Demo entity (company) that assets + journals belong to. The id is
        // Asetto's own; Akunta maps it to an Akunta entity via AutoMappingEntityLink.
        $tenant = Tenant::query()->firstOrCreate(['slug' => 'default'], ['name' => 'Default']);
        $entity = Entity::query()->firstOrCreate(
            ['name' => 'PT Contoh Asetto'],
            ['id' => (string) Str::ulid(), 'tenant_id' => $tenant->id],
        );

        $categories = [
            ['id' => 'cat_kendaraan', 'code' => 'KND', 'name' => 'Kendaraan', 'default_method' => 'straight_line', 'default_useful_life_months' => 96],
            ['id' => 'cat_komputer', 'code' => 'KMP', 'name' => 'Komputer & IT', 'default_method' => 'declining_balance', 'default_useful_life_months' => 48],
            ['id' => 'cat_mebel', 'code' => 'MBL', 'name' => 'Mebel & Perlengkapan', 'default_method' => 'straight_line', 'default_useful_life_months' => 60],
            ['id' => 'cat_mesin', 'code' => 'MSN', 'name' => 'Mesin Produksi', 'default_method' => 'straight_line', 'default_useful_life_months' => 120],
        ];
        foreach ($categories as $c) {
            AssetCategory::query()->updateOrCreate(['id' => $c['id']], $c);
        }

        $custodians = [
            ['id' => 'cus_ops', 'type' => 'entity', 'code' => 'DEPT-OPS', 'name' => 'Divisi Operasional'],
            ['id' => 'cus_it', 'type' => 'entity', 'code' => 'DEPT-IT', 'name' => 'Divisi Teknologi'],
            ['id' => 'cus_fin', 'type' => 'entity', 'code' => 'DEPT-FIN', 'name' => 'Divisi Keuangan'],
            ['id' => 'cus_budi', 'type' => 'person', 'code' => 'EMP-0012', 'name' => 'Budi Santoso', 'department' => 'Operasional'],
            ['id' => 'cus_sari', 'type' => 'person', 'code' => 'EMP-0048', 'name' => 'Sari Wijaya', 'department' => 'Teknologi'],
        ];
        foreach ($custodians as $c) {
            Custodian::query()->updateOrCreate(['id' => $c['id']], $c);
        }

        // Keyed on `code` (unique) — `id` is a generated ULID, so route-model
        // binding sees real ULIDs just like production-created assets.
        $assets = [
            ['code' => 'AST-0001', 'name' => 'Toyota Avanza B 1234 XYZ', 'category_id' => 'cat_kendaraan', 'acquisition_date' => '2023-02-10', 'acquisition_cost' => 240_000_000, 'salvage_value' => 24_000_000, 'useful_life_months' => 96, 'method' => 'straight_line', 'condition' => 'good', 'custodian_id' => 'cus_ops', 'location' => 'Kantor Pusat — Jakarta', 'serial_number' => 'VIN-AVZ-2023-0098', 'accumulated_depreciation' => 72_000_000, 'last_depreciated_period' => '2026-10'],
            ['code' => 'AST-0002', 'name' => 'MacBook Pro 14 M3', 'category_id' => 'cat_komputer', 'acquisition_date' => '2024-06-01', 'acquisition_cost' => 38_000_000, 'salvage_value' => 3_000_000, 'useful_life_months' => 48, 'method' => 'declining_balance', 'condition' => 'good', 'custodian_id' => 'cus_sari', 'location' => 'Kantor Pusat — Jakarta', 'serial_number' => 'C02-MBP-7781', 'accumulated_depreciation' => 11_200_000, 'last_depreciated_period' => '2026-10'],
            ['code' => 'AST-0003', 'name' => 'Meja Kerja Eksekutif (set 10)', 'category_id' => 'cat_mebel', 'acquisition_date' => '2022-09-15', 'acquisition_cost' => 45_000_000, 'salvage_value' => 2_000_000, 'useful_life_months' => 60, 'method' => 'straight_line', 'condition' => 'needs_repair', 'custodian_id' => 'cus_fin', 'location' => 'Kantor Pusat — Lantai 3', 'accumulated_depreciation' => 36_833_333, 'last_depreciated_period' => '2026-10'],
            ['code' => 'AST-0004', 'name' => 'Mesin CNC Router 1325', 'category_id' => 'cat_mesin', 'acquisition_date' => '2021-11-20', 'acquisition_cost' => 520_000_000, 'salvage_value' => 40_000_000, 'useful_life_months' => 120, 'method' => 'straight_line', 'condition' => 'good', 'custodian_id' => 'cus_ops', 'location' => 'Pabrik — Bekasi', 'serial_number' => 'CNC-1325-0442', 'accumulated_depreciation' => 236_000_000, 'last_depreciated_period' => '2026-10'],
            ['code' => 'AST-0005', 'name' => 'Server Dell PowerEdge R760', 'category_id' => 'cat_komputer', 'acquisition_date' => '2025-01-05', 'acquisition_cost' => 95_000_000, 'salvage_value' => 8_000_000, 'useful_life_months' => 48, 'method' => 'declining_balance', 'condition' => 'good', 'custodian_id' => 'cus_it', 'location' => 'Ruang Server — Jakarta', 'serial_number' => 'DELL-R760-1180', 'accumulated_depreciation' => 28_900_000, 'last_depreciated_period' => '2026-10'],
            ['code' => 'AST-0006', 'name' => 'Forklift Toyota 2.5T', 'category_id' => 'cat_mesin', 'acquisition_date' => '2020-03-12', 'acquisition_cost' => 310_000_000, 'salvage_value' => 25_000_000, 'useful_life_months' => 120, 'method' => 'straight_line', 'condition' => 'idle', 'custodian_id' => 'cus_ops', 'location' => 'Gudang — Bekasi', 'accumulated_depreciation' => 190_000_000, 'last_depreciated_period' => '2026-10'],
        ];
        foreach ($assets as $a) {
            $a['status'] = 'active';
            $a['entity_id'] = $entity->id;
            Asset::query()->updateOrCreate(['code' => $a['code']], $a);
        }
    }
}
