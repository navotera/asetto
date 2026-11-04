<?php

declare(strict_types=1);

use App\Models\Asset;
use App\Models\DepreciationRun;
use App\Models\JournalOutbox;
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

it('reports a pending depreciation period from the seeded assets', function () {
    // Seeded assets were last depreciated 2026-10, so 2026-11 is next due.
    $this->getJson('/api/depreciation/pending')
        ->assertOk()
        ->assertJsonPath('period', '2026-11');
});

it('previews a run without mutating assets', function () {
    $before = Asset::sum('accumulated_depreciation');

    $this->getJson('/api/depreciation/preview?period=2026-11')
        ->assertOk()
        ->assertJsonPath('period', '2026-11')
        ->assertJsonStructure(['period', 'total_amount', 'lines' => [['asset_id', 'amount', 'book_value_before', 'book_value_after']]]);

    expect((float) Asset::sum('accumulated_depreciation'))->toBe((float) $before);
});

it('posts a run, advances accumulated depreciation, and enqueues a balanced journal', function () {
    $assetId = Asset::where('code', 'AST-0001')->value('id');
    $before = (float) Asset::find($assetId)->accumulated_depreciation;

    $this->postJson('/api/depreciation/runs', ['period' => '2026-11'])
        ->assertCreated()
        ->assertJsonPath('status', 'posted')
        ->assertJsonPath('period', '2026-11');

    $run = DepreciationRun::query()->where('period', '2026-11')->first();
    expect($run)->not->toBeNull()
        ->and($run->lines()->count())->toBeGreaterThan(0)
        ->and((float) Asset::find($assetId)->accumulated_depreciation)->toBeGreaterThan($before);

    // The journal lands in the outbox with the period-stable idempotency key.
    $journal = JournalOutbox::query()->where('idempotency_key', 'dep:2026-11')->first();
    expect($journal)->not->toBeNull()->and($journal->status)->toBe('queued');

    // Journal is balanced: total debits == total credits.
    $debit = collect($journal->lines)->sum('debit');
    $credit = collect($journal->lines)->sum('credit');
    expect(round($debit, 2))->toBe(round($credit, 2));
});

it('refuses to post the same period twice', function () {
    $this->postJson('/api/depreciation/runs', ['period' => '2026-11'])->assertCreated();
    $this->postJson('/api/depreciation/runs', ['period' => '2026-11'])->assertStatus(422);
});
