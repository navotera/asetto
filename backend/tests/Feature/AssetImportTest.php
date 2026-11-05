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

function importRow(array $overrides = []): array
{
    return array_merge([
        'code' => '',
        'name' => 'Proyektor Epson',
        'entity' => 'PT Contoh Asetto',
        'category' => 'KMP',
        'acquisition_date' => '2026-02-01',
        'acquisition_cost' => '7.500.000',
        'salvage_value' => '500000',
        'useful_life_months' => '48',
        'method' => 'Garis Lurus',
        'condition' => 'Baik',
        'custodian' => 'DEPT-IT',
        'location' => 'Kantor Pusat',
        'serial_number' => 'EPS-001',
        'notes' => '',
    ], $overrides);
}

it('previews rows without writing, resolving names and flagging bad rows', function () {
    $before = Asset::query()->count();

    $res = $this->postJson('/api/assets/import', [
        'commit' => false,
        'rows' => [
            importRow(),
            importRow(['name' => '', 'category' => 'TIDAK-ADA']), // two errors
        ],
    ])->assertOk();

    $res->assertJsonPath('committed', false)
        ->assertJsonPath('summary.total', 2)
        ->assertJsonPath('summary.valid', 1)
        ->assertJsonPath('summary.invalid', 1)
        ->assertJsonPath('rows.0.valid', true)
        ->assertJsonPath('rows.0.resolved.category_id', 'cat_komputer')
        ->assertJsonPath('rows.0.resolved.custodian_id', 'cus_it')
        ->assertJsonPath('rows.0.resolved.acquisition_cost', 7500000)
        ->assertJsonPath('rows.1.valid', false);

    expect($res->json('rows.1.errors'))->toHaveCount(2);
    expect(Asset::query()->count())->toBe($before); // nothing written
});

it('commits valid rows and skips invalid ones', function () {
    $before = Asset::query()->count();

    $this->postJson('/api/assets/import', [
        'commit' => true,
        'rows' => [
            importRow(['name' => 'Kamera CCTV', 'code' => '']),
            importRow(['name' => '', 'category' => 'KMP']), // invalid: no name
        ],
    ])->assertOk()
        ->assertJsonPath('committed', true)
        ->assertJsonPath('created', 1)
        ->assertJsonPath('skipped', 1);

    expect(Asset::query()->count())->toBe($before + 1);
    $asset = Asset::query()->where('name', 'Kamera CCTV')->first();
    expect($asset)->not->toBeNull();
    expect($asset->category_id)->toBe('cat_komputer');
    expect((float) $asset->acquisition_cost)->toBe(7500000.0);
    expect($asset->code)->toStartWith('AST-');
});

it('flags a code that already exists', function () {
    $this->postJson('/api/assets/import', [
        'commit' => false,
        'rows' => [importRow(['code' => 'AST-0001'])],
    ])->assertOk()
        ->assertJsonPath('rows.0.valid', false);
});

it('flags a duplicate code within the uploaded batch', function () {
    $res = $this->postJson('/api/assets/import', [
        'commit' => false,
        'rows' => [
            importRow(['code' => 'AST-9000']),
            importRow(['code' => 'AST-9000']),
        ],
    ])->assertOk();

    $res->assertJsonPath('rows.0.valid', true)
        ->assertJsonPath('rows.1.valid', false);
});

it('forbids import without the asset.manage permission', function () {
    // A plain user (no admin session role) lacks asset.manage.
    $this->withSession(['ecopa.app_role' => 'user']);

    $this->postJson('/api/assets/import', [
        'commit' => true,
        'rows' => [importRow()],
    ])->assertStatus(403);
});
