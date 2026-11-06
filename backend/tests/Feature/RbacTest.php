<?php

declare(strict_types=1);

use Akunta\Rbac\Models\App as RbacApp;
use Akunta\Rbac\Models\Role;
use Akunta\Rbac\Models\UserAppAssignment;
use App\Models\Asset;
use App\Models\Custodian;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DatabaseSeeder::class);
});

function makeUser(?string $email = null): User
{
    return User::query()->create([
        'id' => (string) Str::ulid(),
        'email' => $email ?? Str::ulid().'@example.com',
        'name' => 'U',
        'main_tier_user_id' => (string) Str::ulid(),
        'email_verified_at' => now(),
    ]);
}

function assignRole(User $u, string $roleCode): UserAppAssignment
{
    $app = RbacApp::query()->where('code', 'asetto')->first();
    $role = Role::query()->whereNull('tenant_id')->where('code', $roleCode)->first();

    return UserAppAssignment::query()->create([
        'id' => (string) Str::ulid(),
        'user_id' => $u->id,
        'app_id' => $app->id,
        'entity_id' => null,
        'role_id' => $role->id,
        'assigned_at' => now(),
    ]);
}

/** Grant a non-admin user access to a specific entity (entity-scoped assignment). */
function assignEntity(User $u, string $entityId, string $roleCode): UserAppAssignment
{
    $app = RbacApp::query()->where('code', 'asetto')->first();
    $role = Role::query()->whereNull('tenant_id')->where('code', $roleCode)->first();

    return UserAppAssignment::query()->create([
        'id' => (string) Str::ulid(),
        'user_id' => $u->id,
        'app_id' => $app->id,
        'entity_id' => $entityId,
        'role_id' => $role->id,
        'assigned_at' => now(),
    ]);
}

/** actingAs as a non-admin role (session app_role=user so isSsoAdmin is false). */
function actingAsRole($test, string $roleCode): User
{
    $u = makeUser();
    assignRole($u, $roleCode);
    $test->withSession(['ecopa.app_role' => 'user'])->actingAs($u);

    return $u;
}

it('me exposes all permissions for an Ecopa admin', function () {
    $u = makeUser();
    $this->withSession(['ecopa.app_role' => 'admin'])->actingAs($u);

    $this->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('role', 'Admin')
        ->assertJsonPath('is_impersonating', false)
        ->assertJsonCount(8, 'permissions');
});

it('asset manager can list assets with values and create assets in assigned entities', function () {
    $u = actingAsRole($this, 'asset_manager');
    $entityId = \Akunta\Rbac\Models\Entity::query()->value('id');
    // Must be granted the entity to see/create its assets (no automatic all-entity access).
    assignEntity($u, $entityId, 'asset_manager');

    $this->getJson('/api/assets')->assertOk()->assertJsonPath('0.values_hidden', false);
    $this->getJson('/api/me')->assertJsonPath('role', 'Asset Manager');
    $this->postJson('/api/assets', [
        'name' => 'X', 'entity_id' => $entityId,
        'category_id' => 'cat_komputer', 'acquisition_date' => '2026-01-01', 'acquisition_cost' => 1000,
    ])->assertCreated();
});

it('a non-admin without an entity grant sees an empty asset list', function () {
    actingAsRole($this, 'asset_manager'); // membership role only, no entity assignment

    $this->getJson('/api/assets?page=1&per_page=25')
        ->assertOk()
        ->assertJsonPath('total', 0);
});

it('plain user is blocked from the asset list and management but can see Aset Saya without values', function () {
    $u = actingAsRole($this, 'asset_user');

    // No asset.read / asset.manage.
    $this->getJson('/api/assets')->assertStatus(403);
    $this->postJson('/api/assets', ['name' => 'X', 'acquisition_date' => '2026-01-01', 'acquisition_cost' => 1])->assertStatus(403);

    // Link a custodian to this user and give them an asset.
    $cust = Custodian::query()->where('code', 'EMP-0012')->first();
    $cust->update(['user_id' => $u->id]);
    Asset::query()->where('code', 'AST-0001')->update(['custodian_id' => $cust->id]);

    $this->getJson('/api/assets/mine')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.code', 'AST-0001')
        ->assertJsonPath('0.category_name', 'Kendaraan')
        ->assertJsonMissingPath('0.book_value')
        ->assertJsonMissingPath('0.acquisition_cost');
});

it('admin assigns a role to a synced user; email provisioning is gone', function () {
    $admin = makeUser();
    $this->withSession(['ecopa.app_role' => 'admin'])->actingAs($admin);

    $synced = makeUser(); // an already Ecopa-synced user
    $managerRole = Role::query()->whereNull('tenant_id')->where('code', 'asset_manager')->first();

    $this->postJson('/api/role-management/assign', ['user_id' => $synced->id, 'role_id' => $managerRole->id])
        ->assertOk();
    expect($synced->fresh()->localRoleCode())->toBe('asset_manager');

    // The email path no longer provisions a brand-new user.
    $this->postJson('/api/role-management/assign', ['email' => 'baru@example.com', 'role_id' => $managerRole->id])
        ->assertStatus(422);
    expect(User::query()->where('email', 'baru@example.com')->exists())->toBeFalse();

    $this->getJson('/api/role-management')->assertOk()->assertJsonStructure(['users', 'unassigned_users', 'roles']);
});

it('editing the permission matrix changes effective permissions', function () {
    $admin = makeUser();
    $this->withSession(['ecopa.app_role' => 'admin'])->actingAs($admin);

    // Grant asset_user the asset.read permission.
    $this->putJson('/api/permission-matrix/asset_user', ['permissions' => ['asset.read_own', 'asset.read']])
        ->assertOk();

    $role = Role::query()->whereNull('tenant_id')->where('code', 'asset_user')->first();
    expect($role->permissions()->pluck('code')->sort()->values()->all())->toBe(['asset.read', 'asset.read_own']);

    // admin role stays read-only.
    $this->putJson('/api/permission-matrix/admin', ['permissions' => []])->assertStatus(422);
});

it('admin can impersonate a lower role and stop', function () {
    $admin = makeUser();
    $target = makeUser();
    $assignment = assignRole($target, 'asset_manager');
    $this->withSession(['ecopa.app_role' => 'admin'])->actingAs($admin);

    // NB: in tests actingAs() pins the resolved user across requests, so assert the
    // impersonation state on the session (a real browser carries it via cookie).
    $this->postJson("/api/role-management/{$assignment->id}/impersonate")
        ->assertOk()
        ->assertJsonPath('impersonating', $target->name);
    expect(session('impersonator_id'))->toBe($admin->id)
        ->and(session('ecopa.app_role'))->not->toBe('admin');

    $this->postJson('/api/role-management/stop-impersonation')->assertOk();
    expect(session('impersonator_id'))->toBeNull()
        ->and(session('ecopa.app_role'))->toBe('admin');
});

it('can impersonate any user, including a role-less one', function () {
    $admin = makeUser();
    $target = makeUser();
    $app = RbacApp::query()->where('code', 'asetto')->first();
    $assignment = UserAppAssignment::query()->create([
        'id' => (string) Str::ulid(),
        'user_id' => $target->id,
        'app_id' => $app->id,
        'entity_id' => null,
        'role_id' => null,
        'ecopa_role' => 'user',
        'assigned_at' => now(),
    ]);
    $this->withSession(['ecopa.app_role' => 'admin'])->actingAs($admin);

    $this->postJson("/api/role-management/{$assignment->id}/impersonate")
        ->assertOk()
        ->assertJsonPath('impersonating', $target->name);
    expect(session('impersonator_id'))->toBe($admin->id);
});
