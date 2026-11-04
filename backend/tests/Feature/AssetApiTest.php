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

it('creates an asset and auto-generates a code', function () {
    $this->postJson('/api/assets', [
        'name' => 'Printer Epson',
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

it('reassigns an asset custodian + location', function () {
    $id = Asset::where('code', 'AST-0002')->value('id');

    $this->postJson("/api/assets/{$id}/reassign", [
        'custodian_id' => 'cus_it',
        'location' => 'Ruang Server — Jakarta',
    ])->assertOk()->assertJsonPath('custodian_id', 'cus_it');
});

it('updates an asset condition', function () {
    $id = Asset::where('code', 'AST-0002')->value('id');

    $this->postJson("/api/assets/{$id}/condition", ['condition' => 'needs_repair'])
        ->assertOk()
        ->assertJsonPath('condition', 'needs_repair');
});
