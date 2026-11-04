<?php

declare(strict_types=1);

use App\Models\Asset;
use App\Models\DepreciationRun;
use App\Models\JournalOutbox;
use App\Models\User;
use App\Services\SettingsService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DatabaseSeeder::class);
    $this->settings = app(SettingsService::class);
});

/** Auto Mapping ingest events emitted for a given run. */
function depEvents(DepreciationRun $run)
{
    return JournalOutbox::query()->where('source_ref', $run->id)->get();
}

it('auto-posts the scheduled run when mode is auto_post', function () {
    $this->settings->set('depreciation.mode', 'auto_post');
    $before = (float) Asset::where('code', 'AST-0001')->value('accumulated_depreciation');

    Artisan::call('asetto:run-depreciation', ['--period' => '2026-11']);

    $run = DepreciationRun::where('period', '2026-11')->first();
    expect($run?->status)->toBe('posted')
        ->and((float) Asset::where('code', 'AST-0001')->value('accumulated_depreciation'))->toBeGreaterThan($before)
        ->and(depEvents($run)->isNotEmpty())->toBeTrue()
        ->and(depEvents($run)->every(fn ($e) => $e->source_type === 'asetto.depreciation'))->toBeTrue();
});

it('creates a draft (no asset change, no journal) when mode is draft', function () {
    $this->settings->set('depreciation.mode', 'draft');
    $before = (float) Asset::where('code', 'AST-0001')->value('accumulated_depreciation');

    Artisan::call('asetto:run-depreciation', ['--period' => '2026-11']);

    $run = DepreciationRun::where('period', '2026-11')->first();
    expect($run?->status)->toBe('draft')
        ->and((float) Asset::where('code', 'AST-0001')->value('accumulated_depreciation'))->toBe($before)
        ->and(depEvents($run)->isEmpty())->toBeTrue();
});

it('commits a draft run via the API, advancing assets and enqueuing the journal', function () {
    $this->settings->set('depreciation.mode', 'draft');
    Artisan::call('asetto:run-depreciation', ['--period' => '2026-11']);
    $run = DepreciationRun::where('period', '2026-11')->first();

    $user = User::create([
        'id' => (string) Str::ulid(),
        'email' => 'a@example.com', 'name' => 'A', 'main_tier_user_id' => 'x', 'email_verified_at' => now(),
    ]);
    $this->withSession(['ecopa.app_role' => 'admin'])->actingAs($user);

    $this->postJson("/api/depreciation/runs/{$run->id}/commit")
        ->assertOk()
        ->assertJsonPath('status', 'posted');

    expect(depEvents($run->refresh())->isNotEmpty())->toBeTrue();
});

it('flush-outbox delivers queued events via Auto Mapping ingest and retries failed ones', function () {
    config([
        'akunta-api-client.auto_journal.token' => 'test-token',
        'akunta-api-client.auto_journal.base_url' => 'http://akunta.test',
    ]);

    // AutoMappingClient uses the Http facade directly, so Http::fake() intercepts
    // it without any factory rebinding.
    $outbox = JournalOutbox::create([
        'idempotency_key' => 'asetto:dep:ent:2026-11:KMP',
        'source' => 'depreciation',
        'source_type' => 'asetto.depreciation',
        'source_ref' => 'run-x',
        'entity_id' => (string) Str::ulid(),
        'date' => '2026-11-28',
        'memo' => 'test',
        'status' => 'queued',
        'payload' => ['event' => 'depreciation', 'period' => '2026-11', 'category_code' => 'KMP', 'amount' => 100],
    ]);

    // Akunta is offline on the first tick, back online (202 accepted) on the next.
    Http::fakeSequence('*/api/v1/auto-mapping/ingest')
        ->push(['error' => 'down'], 500)
        ->push(['raw_id' => 'raw-1', 'status' => 'accepted'], 202);

    // First tick: Akunta offline -> failed, remains for retry.
    Artisan::call('asetto:flush-outbox');
    expect($outbox->refresh()->status)->toBe('failed');

    // Next tick: Akunta back -> accepted with the raw_id, same idempotency key.
    Artisan::call('asetto:flush-outbox');
    expect($outbox->refresh()->status)->toBe('accepted')
        ->and($outbox->akunta_raw_id)->toBe('raw-1');
});
