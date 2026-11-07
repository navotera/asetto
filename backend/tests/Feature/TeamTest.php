<?php

declare(strict_types=1);

use Akunta\Rbac\Models\App as RbacApp;
use Akunta\Rbac\Models\Role;
use Akunta\Rbac\Models\UserAppAssignment;
use App\Models\Team;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DatabaseSeeder::class);
    $this->entityId = \Akunta\Rbac\Models\Entity::query()->value('id');

    $this->admin = User::query()->create([
        'id' => (string) Str::ulid(), 'email' => 'admin@example.com', 'name' => 'Admin',
        'main_tier_user_id' => 'ec-admin', 'email_verified_at' => now(),
    ]);
    $this->withSession(['ecopa.app_role' => 'admin'])->actingAs($this->admin);
});

/** A user active in $this->entityId (entity-scoped assignment). */
function memberUser(string $entityId, string $email): User
{
    $app = RbacApp::query()->where('code', 'asetto')->first();
    $operator = Role::query()->whereNull('tenant_id')->where('code', 'operator')->first();
    $u = User::query()->create([
        'id' => (string) Str::ulid(), 'email' => $email, 'name' => Str::before($email, '@'),
        'main_tier_user_id' => (string) Str::ulid(), 'email_verified_at' => now(),
    ]);
    UserAppAssignment::query()->create([
        'id' => (string) Str::ulid(), 'user_id' => $u->id, 'app_id' => $app->id,
        'entity_id' => $entityId, 'role_id' => $operator->id, 'assigned_at' => now(),
    ]);

    return $u;
}

it('creates a team scoped to an entity', function () {
    $res = $this->postJson("/api/entities/{$this->entityId}/teams", ['name' => 'Tim Operasional'])->assertCreated();
    expect(collect($res->json('teams'))->pluck('name'))->toContain('Tim Operasional');
    expect(Team::query()->where('entity_id', $this->entityId)->where('name', 'Tim Operasional')->exists())->toBeTrue();
});

it('adds and removes a member who is active in the entity', function () {
    $team = Team::query()->create(['entity_id' => $this->entityId, 'name' => 'Tim A']);
    $u = memberUser($this->entityId, 'budi@example.com');

    $res = $this->postJson("/api/teams/{$team->id}/members", ['user_id' => $u->id])->assertOk();
    $t = collect($res->json('teams'))->firstWhere('id', $team->id);
    expect(collect($t['members'])->pluck('user_id'))->toContain($u->id);
    expect($t['member_count'])->toBe(1);

    $res2 = $this->deleteJson("/api/teams/{$team->id}/members/{$u->id}")->assertOk();
    $t2 = collect($res2->json('teams'))->firstWhere('id', $team->id);
    expect(collect($t2['members'])->pluck('user_id'))->not->toContain($u->id);
});

it('refuses a member who is not active in the entity', function () {
    $team = Team::query()->create(['entity_id' => $this->entityId, 'name' => 'Tim B']);
    // User exists but has no assignment to this entity.
    $outsider = User::query()->create([
        'id' => (string) Str::ulid(), 'email' => 'x@example.com', 'name' => 'X',
        'main_tier_user_id' => (string) Str::ulid(), 'email_verified_at' => now(),
    ]);

    $this->postJson("/api/teams/{$team->id}/members", ['user_id' => $outsider->id])
        ->assertStatus(422);
});

it('renames and deletes a team', function () {
    $team = Team::query()->create(['entity_id' => $this->entityId, 'name' => 'Lama']);

    $this->patchJson("/api/teams/{$team->id}", ['name' => 'Baru'])->assertOk();
    expect(Team::query()->whereKey($team->id)->value('name'))->toBe('Baru');

    $this->deleteJson("/api/teams/{$team->id}")->assertOk();
    expect(Team::query()->whereKey($team->id)->exists())->toBeFalse();
});
