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

    /** Entities this user may act within. Admins = all; others = entities an
     *  admin explicitly assigned them to (per-entity assignments). A plain
     *  membership (entity_id null) grants NO entity access on its own. */
    public function getTenants(): Collection
    {
        if ($this->isAssettoAdmin()) {
            return Entity::query()->get();
        }

        return Entity::query()->whereIn('id', $this->accessibleEntityIds())->get();
    }

    public function canAccessTenant(Entity $entity): bool
    {
        if ($this->isAssettoAdmin()) {
            return true;
        }

        return $this->accessibleEntityIds()->contains($entity->id);
    }

    /**
     * Entity ids a non-admin user may access — taken only from entity-scoped
     * assignments (entity_id set). Admins are not entity-scoped (see getTenants).
     *
     * @return Collection<int, string>
     */
    public function accessibleEntityIds(): Collection
    {
        return $this->assignments()
            ->whereNull('revoked_at')
            ->whereNotNull('entity_id')
            ->pluck('entity_id')
            ->unique()
            ->values();
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
}
