<?php

declare(strict_types=1);

use App\Models\Asset;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
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
    $this->assetId = Asset::where('code', 'AST-0002')->value('id');
});

it('records custody handover with condition when reassigning', function () {
    $asset = Asset::whereKey($this->assetId)->first();
    $team = \App\Models\Team::query()->create(['entity_id' => $asset->entity_id, 'name' => 'Tim IT']);

    $this->postJson("/api/assets/{$this->assetId}/reassign", [
        'responsible_type' => 'team',
        'responsible_id' => $team->id,
        'location' => 'Ruang Server',
        'condition_at_handover' => 'needs_repair',
        'notes' => 'Kipas berisik',
    ])->assertOk()->assertJsonPath('condition', 'needs_repair');

    $this->getJson("/api/assets/{$this->assetId}/custody-history")
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.condition_at_handover', 'needs_repair')
        ->assertJsonPath('0.to_name', 'Tim IT')
        ->assertJsonPath('0.notes', 'Kipas berisik');
});

it('processes an uploaded photo into web + thumbnail and discards the original', function () {
    Storage::fake('public');

    $this->post("/api/assets/{$this->assetId}/photos", [
        'photo' => UploadedFile::fake()->image('big.jpg', 2400, 1800),
        'caption' => 'Tampak depan',
    ])->assertCreated()
        ->assertJsonPath('caption', 'Tampak depan')
        ->assertJsonStructure(['id', 'url', 'thumb_url', 'width', 'height']);

    $files = Storage::disk('public')->allFiles("assets/{$this->assetId}/photos");
    // Exactly two derivatives (web + thumb); the original is never stored.
    expect($files)->toHaveCount(2);

    $web = collect($files)->first(fn ($f) => ! str_contains($f, '_thumb'));
    [$w, $h] = getimagesizefromstring(Storage::disk('public')->get($web));
    expect(max($w, $h))->toBeLessThanOrEqual(1600);
});

it('deletes a photo and its files', function () {
    Storage::fake('public');
    $create = $this->post("/api/assets/{$this->assetId}/photos", [
        'photo' => UploadedFile::fake()->image('p.jpg', 800, 600),
    ])->assertCreated();
    $photoId = $create->json('id');

    expect(Storage::disk('public')->allFiles("assets/{$this->assetId}/photos"))->toHaveCount(2);

    $this->deleteJson("/api/photos/{$photoId}")->assertOk();
    expect(Storage::disk('public')->allFiles("assets/{$this->assetId}/photos"))->toHaveCount(0);
});

it('upserts purchase data with an image proof', function () {
    Storage::fake('public');

    $this->post("/api/assets/{$this->assetId}/purchase", [
        'vendor' => 'PT Sumber Jaya',
        'invoice_no' => 'INV-001',
        'purchase_date' => '2024-06-01',
        'amount' => 38000000,
        'proof' => UploadedFile::fake()->image('nota.jpg', 1200, 1600),
    ])->assertOk()
        ->assertJsonPath('vendor', 'PT Sumber Jaya')
        ->assertJsonPath('proof_type', 'image');

    $this->getJson("/api/assets/{$this->assetId}/purchase")
        ->assertOk()
        ->assertJsonPath('invoice_no', 'INV-001')
        ->assertJsonPath('amount', 38000000);
});

it('reads and updates settings', function () {
    $this->getJson('/api/settings')
        ->assertOk()
        ->assertJsonPath('mode', 'auto_post')
        ->assertJsonPath('disk', 'public');

    $this->putJson('/api/settings', ['mode' => 'draft'])
        ->assertOk()
        ->assertJsonPath('mode', 'draft');
});

it('creates, updates and deletes a category; blocks delete when in use', function () {
    $this->postJson('/api/categories', [
        'code' => 'XYZ', 'name' => 'Kategori Baru', 'default_method' => 'straight_line',
        'default_useful_life_months' => 48,
    ])->assertCreated()->assertJsonPath('code', 'XYZ');

    $id = \App\Models\AssetCategory::where('code', 'XYZ')->value('id');
    $this->patchJson("/api/categories/{$id}", [
        'code' => 'XYZ', 'name' => 'Diubah', 'default_method' => 'declining_balance',
        'default_useful_life_months' => 24,
    ])->assertOk()->assertJsonPath('name', 'Diubah');

    // Seeded category in use cannot be deleted.
    $this->deleteJson('/api/categories/cat_komputer')->assertStatus(422);
    // Unused one can.
    $this->deleteJson("/api/categories/{$id}")->assertOk();
});
