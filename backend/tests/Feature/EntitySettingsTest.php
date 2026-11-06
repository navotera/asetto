<?php

declare(strict_types=1);

use Akunta\Rbac\Models\Entity;
use Akunta\Rbac\Models\Tenant;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

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
