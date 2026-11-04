<?php

declare(strict_types=1);

namespace Database\Seeders;

use Akunta\Rbac\Models\App as RbacApp;
use Akunta\Rbac\Models\Permission;
use Akunta\Rbac\Models\Role;
use Akunta\Rbac\Services\PermissionRegistry;
use Illuminate\Database\Seeder;

/**
 * Registers Asetto's permission catalog against the `asetto` App and creates the
 * three preset roles wired to their default permissions. `admin` bypasses checks
 * (role code), so it carries no pivot rows.
 */
class RolesSeeder extends Seeder
{
    public function run(): void
    {
        $slug = (string) config('ecopa.self_slug', 'asetto');

        $app = RbacApp::query()->firstOrCreate(
            ['code' => $slug],
            ['name' => (string) config('ecopa.registration_name', 'Asetto'), 'version' => '1.0', 'enabled' => true],
        );

        app(PermissionRegistry::class)->registerMany($slug, collect(config('asetto_permissions.catalog', []))
            ->map(fn (array $p) => ['code' => $p['code'], 'description' => $p['label'], 'category' => $p['group']])
            ->all());

        $permsByCode = Permission::query()->where('app_id', $app->id)->get()->keyBy('code');

        foreach (config('asetto_permissions.roles', []) as $code => $def) {
            $role = Role::query()->firstOrCreate(
                ['code' => $code, 'tenant_id' => null],
                ['name' => $def['name'], 'is_preset' => true],
            );

            if ($code === 'admin') {
                continue; // bypasses hasPermission via its role code — no pivot needed
            }

            $ids = collect($def['permissions'])
                ->map(fn (string $c) => $permsByCode[$c]?->id)
                ->filter()
                ->all();
            $role->permissions()->syncWithoutDetaching($ids);
        }
    }
}
