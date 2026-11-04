<?php

declare(strict_types=1);

namespace App\Models;

use Akunta\Rbac\Models\Entity;
use Akunta\Rbac\Models\User as RbacUser;
use Akunta\Rbac\Models\UserAppAssignment;
use Illuminate\Support\Collection;
use Laravel\Sanctum\HasApiTokens;

/**
 * Asetto shadow user. Identity is owned by Ecopa (main tier); this row is a
 * local mirror provisioned from OIDC claims / lifecycle webhooks. There is no
 * password — getAuthPassword() on the rbac base returns null.
 *
 * The real security gate lives here (session guard + webhook-synced
 * assignments), not in the ecosystem menu. Detailed Asetto roles (Asset
 * Manager, Custodian, Viewer, ...) are chosen locally via role_id on the
 * assignment; `app_role` from Ecopa is only admin|user and never sets them.
 */
class User extends RbacUser
{
    use HasApiTokens;

    /** Entities this user may act within (RBAC-scoped, like Akunta). */
    public function getTenants(): Collection
    {
        if ($this->isSsoAdmin()) {
            return Entity::query()->get();
        }

        return Entity::query()
            ->whereIn('id', $this->assignments()->whereNull('revoked_at')->pluck('entity_id')->filter()->unique()->values())
            ->orWhereIn('id', $this->accessibleEntityIdsFromTenantWide())
            ->get();
    }

    public function canAccessTenant(Entity $entity): bool
    {
        if ($this->isSsoAdmin()) {
            return true;
        }

        return $this->assignments()
            ->whereNull('revoked_at')
            ->where(function ($q) use ($entity) {
                $q->whereNull('entity_id')->orWhere('entity_id', $entity->id);
            })
            ->exists();
    }

    /** True if the current session was provisioned via Ecopa with app_role=admin. */
    public function isSsoAdmin(): bool
    {
        return session('ecopa.app_role') === 'admin';
    }

    /**
     * Ecopa admins (app_role=admin) bypass all permission checks even before a
     * local `admin` role is assigned. Otherwise defer to the rbac pivot logic
     * (which itself bypasses for role code admin/super_admin).
     */
    public function hasPermission(string $permissionCode, ?string $entityId = null): bool
    {
        if ($this->isSsoAdmin()) {
            return true;
        }

        return parent::hasPermission($permissionCode, $entityId);
    }

    public function isAssettoAdmin(): bool
    {
        return $this->isSsoAdmin() || $this->localRoleCode() === 'admin';
    }

    /** The user's active app-wide Asetto assignment (entity_id null). */
    public function assettoAssignment(): ?UserAppAssignment
    {
        return $this->assignments()
            ->whereNull('revoked_at')
            ->whereNull('entity_id')
            ->whereHas('app', fn ($q) => $q->where('code', config('ecopa.self_slug', 'asetto')))
            ->with('role')
            ->first();
    }

    public function localRoleCode(): ?string
    {
        return $this->assettoAssignment()?->role?->code;
    }

    public function localRoleName(): ?string
    {
        return $this->assettoAssignment()?->role?->name;
    }

    /**
     * Effective Asetto permission codes for this user.
     *
     * @return array<int, string>
     */
    public function permissionCodes(): array
    {
        $all = collect(config('asetto_permissions.catalog', []))->pluck('code')->all();

        if ($this->isAssettoAdmin()) {
            return $all;
        }

        return $this->assignments()
            ->whereNull('revoked_at')
            ->with('role.permissions:id,code')
            ->get()
            ->flatMap(fn ($a) => $a->role?->permissions->pluck('code') ?? [])
            ->unique()
            ->values()
            ->all();
    }

    protected function accessibleEntityIdsFromTenantWide(): Collection
    {
        if ($this->assignments()->whereNull('revoked_at')->whereNull('entity_id')->exists()) {
            return Entity::query()->pluck('id');
        }

        return collect();
    }
}
