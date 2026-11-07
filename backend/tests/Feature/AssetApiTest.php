<?php

declare(strict_types=1);

use App\Models\Asset;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DatabaseSeeder::class);
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

it('requires authentication', function () {
    auth()->logout();
    $this->getJson('/api/assets')->assertStatus(401);
});

it('returns the current user from /api/me', function () {
    $this->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('email', 'admin@example.com')
        ->assertJsonPath('app_role', 'admin');
});

it('lists seeded assets sorted by code with a derived book value', function () {
    $this->getJson('/api/assets')
        ->assertOk()
        ->assertJsonCount(6)
        ->assertJsonPath('0.code', 'AST-0001')
        ->assertJsonPath('0.book_value', 168000000); // 240M cost − 72M accumulated
});

it('paginates assets when page params are given', function () {
    $res = $this->getJson('/api/assets?page=1&per_page=2&sort=code&dir=asc')
        ->assertOk()
        ->assertJsonPath('page', 1)
        ->assertJsonPath('per_page', 2)
        ->assertJsonPath('total', 6)
        ->assertJsonPath('last_page', 3)
        ->assertJsonPath('items.0.code', 'AST-0001');

    expect($res->json('items'))->toHaveCount(2);

    // Page 2 continues the sequence.
    $this->getJson('/api/assets?page=2&per_page=2&sort=code&dir=asc')
        ->assertOk()
        ->assertJsonPath('items.0.code', 'AST-0003');
});

it('filters the paginated list by search', function () {
    $this->getJson('/api/assets?page=1&per_page=25&search=MacBook')
        ->assertOk()
        ->assertJsonPath('total', 1)
        ->assertJsonPath('items.0.code', 'AST-0002');
});

it('creates an asset and auto-generates a code', function () {
    $this->postJson('/api/assets', [
        'name' => 'Printer Epson',
        'entity_id' => \Akunta\Rbac\Models\Entity::query()->value('id'),
        'category_id' => 'cat_komputer',
        'acquisition_date' => '2026-01-10',
        'acquisition_cost' => 5_000_000,
        'salvage_value' => 500_000,
        'useful_life_months' => 48,
        'method' => 'straight_line',
    ])->assertCreated()->assertJsonPath('status', 'active');

    expect(Asset::query()->where('name', 'Printer Epson')->exists())->toBeTrue();
});

it('blocks deleting a depreciated asset', function () {
    $id = Asset::where('code', 'AST-0001')->value('id');

    $this->deleteJson("/api/assets/{$id}")
        ->assertStatus(422)
        ->assertJsonPath('message', 'Aset sudah terdepresiasi — gunakan pelepasan, bukan hapus.');
});

it('reassigns an asset to a team (responsible)', function () {
    $asset = Asset::where('code', 'AST-0002')->first();
    $team = \App\Models\Team::query()->create(['entity_id' => $asset->entity_id, 'name' => 'Tim Server']);

    $this->postJson("/api/assets/{$asset->id}/reassign", [
        'responsible_type' => 'team',
        'responsible_id' => $team->id,
        'location' => 'Ruang Server — Jakarta',
    ])->assertOk()
        ->assertJsonPath('responsible_type', 'team')
        ->assertJsonPath('responsible_team_id', $team->id)
        ->assertJsonPath('responsible_name', 'Tim Server');
});

it('updates an asset condition', function () {
    $id = Asset::where('code', 'AST-0002')->value('id');

    $this->postJson("/api/assets/{$id}/condition", ['condition' => 'needs_repair'])
        ->assertOk()
        ->assertJsonPath('condition', 'needs_repair');
});

it('returns per-tab counts on the paginated list', function () {
    // One disposed asset → inactive tab; the rest stay active.
    Asset::where('code', 'AST-0002')->update(['status' => 'disposed']);

    $this->getJson('/api/assets?page=1&per_page=25')
        ->assertOk()
        ->assertJsonPath('counts.active', 5)
        ->assertJsonPath('counts.inactive', 1)
        ->assertJsonPath('counts.trashed', 0)
        ->assertJsonPath('total', 5); // default tab = active
});

it('lists disposed assets only under the inactive tab', function () {
    Asset::where('code', 'AST-0002')->update(['status' => 'disposed']);

    $res = $this->getJson('/api/assets?page=1&per_page=25&tab=inactive')->assertOk();
    expect($res->json('items'))->toHaveCount(1);
    expect($res->json('items.0.code'))->toBe('AST-0002');
});

it('soft-deletes an asset into the trashed tab', function () {
    // Fresh asset has zero accumulated depreciation, so delete is allowed.
    $id = $this->postJson('/api/assets', [
        'name' => 'Kursi Lipat',
        'entity_id' => \Akunta\Rbac\Models\Entity::query()->value('id'),
        'category_id' => 'cat_mebel',
        'acquisition_date' => '2026-02-01',
        'acquisition_cost' => 1_000_000,
    ])->assertCreated()->json('id');

    $this->deleteJson("/api/assets/{$id}")->assertOk();

    // Gone from the active tab, present (and flagged) in the trashed tab.
    expect($this->getJson('/api/assets?page=1&per_page=50&tab=active')->json('total'))->toBe(6);
    $trashed = $this->getJson('/api/assets?page=1&per_page=50&tab=trashed')->assertOk();
    expect($trashed->json('counts.trashed'))->toBe(1);
    expect(collect($trashed->json('items'))->pluck('id'))->toContain($id);
    expect($trashed->json('items.0.trashed'))->toBeTrue();
    $this->assertSoftDeleted('assets', ['id' => $id]);
});

it('restores a trashed asset back to the active tab', function () {
    $id = $this->postJson('/api/assets', [
        'name' => 'Kipas Angin',
        'entity_id' => \Akunta\Rbac\Models\Entity::query()->value('id'),
        'category_id' => 'cat_mebel',
        'acquisition_date' => '2026-03-01',
        'acquisition_cost' => 500_000,
    ])->assertCreated()->json('id');

    $this->deleteJson("/api/assets/{$id}")->assertOk();
    $this->postJson("/api/assets/{$id}/restore")->assertOk()->assertJsonPath('trashed', false);

    expect($this->getJson('/api/assets?page=1&per_page=50&tab=active')->json('total'))->toBe(7);
    $this->assertNotSoftDeleted('assets', ['id' => $id]);
});
