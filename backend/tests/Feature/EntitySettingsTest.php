<?php

declare(strict_types=1);

use Akunta\Rbac\Models\App as RbacApp;
use Akunta\Rbac\Models\Entity;
use Akunta\Rbac\Models\Role;
use Akunta\Rbac\Models\Tenant;
use Akunta\Rbac\Models\UserAppAssignment;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

/** Create a synced (membership) user with the given local role code. */
function syncedUser(string $email, string $roleCode = 'operator'): User
{
    $app = RbacApp::query()->where('code', 'asetto')->first();
    $role = Role::query()->whereNull('tenant_id')->where('code', $roleCode)->first();
    $u = User::query()->create([
        'id' => (string) Str::ulid(),
        'email' => $email,
        'name' => Str::before($email, '@'),
        'main_tier_user_id' => (string) Str::ulid(),
        'email_verified_at' => now(),
    ]);
    UserAppAssignment::query()->create([
        'id' => (string) Str::ulid(),
        'user_id' => $u->id,
        'app_id' => $app->id,
        'entity_id' => null,
        'role_id' => $role->id,
        'ecopa_role' => 'user',
        'assigned_at' => now(),
    ]);

    return $u;
}

beforeEach(function () {
    $this->seed(DatabaseSeeder::class);

    $tenant = Tenant::query()->first();
    // A second entity so on/off + default have something to move between.
    Entity::query()->create(['id' => 'ent_kedua', 'name' => 'PT Kedua', 'tenant_id' => $tenant->id]);

    $this->user = User::query()->create([
        'id' => (string) Str::ulid(),
        'email' => 'admin@example.com',
        'name' => 'Admin',
        'main_tier_user_id' => 'ec-admin',
        'email_verified_at' => now(),
    ]);
    $this->withSession(['ecopa.app_role' => 'admin']);
    $this->actingAs($this->user);
});

it('exposes enabled + is_default flags on the entity list', function () {
    $this->getJson('/api/entities')
        ->assertOk()
        ->assertJsonFragment(['id' => 'ent_kedua', 'name' => 'PT Kedua', 'enabled' => true, 'is_default' => false]);
});

it('toggles an entity off so it is no longer enabled', function () {
    $this->patchJson('/api/entities/ent_kedua', ['enabled' => false])
        ->assertOk()
        ->assertJsonFragment(['id' => 'ent_kedua', 'enabled' => false]);
});

it('refuses to disable the last enabled entity', function () {
    // Disable every entity but one, then try to disable that last one.
    $ids = Entity::query()->pluck('id');
    foreach ($ids->slice(0, $ids->count() - 1) as $id) {
        $this->patchJson("/api/entities/{$id}", ['enabled' => false])->assertOk();
    }
    $last = $ids->last();

    $this->patchJson("/api/entities/{$last}", ['enabled' => false])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Minimal satu entitas harus aktif.');
});

it('sets an entity as the default (and enables it)', function () {
    $this->patchJson('/api/entities/ent_kedua', ['enabled' => false])->assertOk();

    $res = $this->postJson('/api/entities/ent_kedua/default')->assertOk();
    $kedua = collect($res->json())->firstWhere('id', 'ent_kedua');
    expect($kedua['is_default'])->toBeTrue();
    expect($kedua['enabled'])->toBeTrue();

    // Only one default at a time.
    expect(collect($res->json())->where('is_default', true))->toHaveCount(1);
});

it('moves the default to another entity when the default is disabled', function () {
    $this->postJson('/api/entities/ent_kedua/default')->assertOk();

    $res = $this->patchJson('/api/entities/ent_kedua', ['enabled' => false])->assertOk();
    $kedua = collect($res->json())->firstWhere('id', 'ent_kedua');
    expect($kedua['is_default'])->toBeFalse();
    // A different, still-enabled entity picked up the default.
    $default = collect($res->json())->firstWhere('is_default', true);
    expect($default)->not->toBeNull();
    expect($default['enabled'])->toBeTrue();
});

it('exposes a user_count per entity', function () {
    $operator = Role::query()->whereNull('tenant_id')->where('code', 'operator')->first();
    $u = syncedUser('op1@example.com');
    $this->postJson('/api/entities/ent_kedua/users', ['user_id' => $u->id, 'role_id' => $operator->id])->assertOk();

    $this->getJson('/api/entities')
        ->assertOk()
        ->assertJsonFragment(['id' => 'ent_kedua', 'user_count' => 1]);
});

it('lists assignable synced users and assigns one to an entity', function () {
    $operator = Role::query()->whereNull('tenant_id')->where('code', 'operator')->first();
    $u = syncedUser('op2@example.com');

    // Assignable before assignment; assigned empty.
    $before = $this->getJson('/api/entities/ent_kedua/users')->assertOk();
    expect(collect($before->json('assignable'))->pluck('user_id'))->toContain($u->id);
    expect($before->json('assigned'))->toBe([]);
    // The admin role is not offered for per-entity assignment.
    expect(collect($before->json('roles'))->pluck('code'))->not->toContain('admin');

    $after = $this->postJson('/api/entities/ent_kedua/users', ['user_id' => $u->id, 'role_id' => $operator->id])->assertOk();
    expect(collect($after->json('assigned'))->pluck('user_id'))->toContain($u->id);
    // Now excluded from assignable.
    expect(collect($after->json('assignable'))->pluck('user_id'))->not->toContain($u->id);
});

it('rejects assigning the admin role to an entity', function () {
    $admin = Role::query()->whereNull('tenant_id')->where('code', 'admin')->first();
    $u = syncedUser('op3@example.com');

    $this->postJson('/api/entities/ent_kedua/users', ['user_id' => $u->id, 'role_id' => $admin->id])
        ->assertStatus(422);
});

it('unassigns a user from an entity', function () {
    $operator = Role::query()->whereNull('tenant_id')->where('code', 'operator')->first();
    $u = syncedUser('op4@example.com');
    $this->postJson('/api/entities/ent_kedua/users', ['user_id' => $u->id, 'role_id' => $operator->id])->assertOk();

    $res = $this->deleteJson("/api/entities/ent_kedua/users/{$u->id}")->assertOk();
    expect(collect($res->json('assigned'))->pluck('user_id'))->not->toContain($u->id);
});

it('scopes the entity list for a non-admin to assigned entities only', function () {
    $operator = Role::query()->whereNull('tenant_id')->where('code', 'operator')->first();
    $u = syncedUser('op5@example.com');
    // Grant only ent_kedua.
    $this->postJson('/api/entities/ent_kedua/users', ['user_id' => $u->id, 'role_id' => $operator->id])->assertOk();

    // Act as that non-admin user.
    $this->withSession(['ecopa.app_role' => 'user'])->actingAs($u->fresh());

    $this->getJson('/api/entities')
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.id', 'ent_kedua');
});
