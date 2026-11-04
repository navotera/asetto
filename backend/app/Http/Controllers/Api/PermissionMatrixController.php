<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use Akunta\Rbac\Models\App as RbacApp;
use Akunta\Rbac\Models\Permission;
use Akunta\Rbac\Models\Role;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin screen: view and edit which permissions each preset role holds. The
 * `admin` role bypasses checks and is shown read-only ("all"). Permissions are
 * stored directly on the role_permissions pivot, so `hasPermission` reflects
 * edits immediately.
 */
class PermissionMatrixController extends Controller
{
    public function show(): JsonResponse
    {
        $catalog = collect(config('asetto_permissions.catalog', []));
        $allCodes = $catalog->pluck('code')->all();
        $roleDefs = config('asetto_permissions.roles', []);

        $roles = Role::query()->whereNull('tenant_id')
            ->whereIn('code', array_keys($roleDefs))
            ->with('permissions:id,code')
            ->get()
            ->sortByDesc(fn (Role $r) => config('asetto_permissions.ranks.'.$r->code, 0))
            ->map(function (Role $r) use ($allCodes) {
                $isAdmin = $r->code === 'admin';

                return [
                    'code' => $r->code,
                    'name' => $r->name,
                    'is_preset' => (bool) $r->is_preset,
                    'editable' => ! $isAdmin,
                    'permissions' => $isAdmin ? $allCodes : $r->permissions->pluck('code')->values()->all(),
                ];
            })->values();

        return response()->json([
            'catalog' => $catalog->map(fn ($p) => ['code' => $p['code'], 'group' => $p['group'], 'label' => $p['label']])->values(),
            'roles' => $roles,
        ]);
    }

    public function update(Request $request, string $roleCode): JsonResponse
    {
        if ($roleCode === 'admin') {
            return response()->json(['message' => 'Role admin memiliki semua izin dan tidak dapat diubah.'], 422);
        }

        $catalogCodes = collect(config('asetto_permissions.catalog', []))->pluck('code')->all();

        $data = $request->validate([
            'permissions' => ['present', 'array'],
            'permissions.*' => ['string', 'in:'.implode(',', $catalogCodes)],
        ]);

        $role = Role::query()->whereNull('tenant_id')->where('code', $roleCode)->firstOrFail();

        $app = RbacApp::query()->where('code', (string) config('ecopa.self_slug', 'asetto'))->firstOrFail();
        $ids = Permission::query()->where('app_id', $app->id)
            ->whereIn('code', $data['permissions'])
            ->pluck('id')->all();

        $role->permissions()->sync($ids);

        return $this->show();
    }
}
