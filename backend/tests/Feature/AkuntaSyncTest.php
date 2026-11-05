<?php

declare(strict_types=1);

use App\Models\Asset;
use App\Models\JournalOutbox;
use App\Models\User;
use App\Services\AkuntaPostingService;
use App\Services\SettingsService;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
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
    // A token so push() actually attempts ingest (instead of staying queued).
    config()->set('akunta-api-client.auto_journal.token', 'test-token');
});

function makeOutbox(array $overrides = []): JournalOutbox
{
    return JournalOutbox::query()->create(array_merge([
        'idempotency_key' => 'k:'.Str::ulid(),
        'source' => 'acquisition',
        'source_type' => 'asetto.acquisition',
        'source_ref' => 'ast_x',
        'entity_id' => 'ent_1',
        'date' => '2026-11-01',
        'memo' => 'test',
        'status' => 'queued',
        'payload' => ['event' => 'acquisition', 'amount' => 1000],
    ], $overrides));
}

it('marks a 4xx ingest as rejected (permanent)', function () {
    Http::fake(['*auto-mapping/ingest*' => Http::response(['error' => 'bad mapping'], 422)]);

    $outbox = makeOutbox();
    app(AkuntaPostingService::class)->push($outbox);

    expect($outbox->refresh()->status)->toBe('rejected');
});

it('marks a 5xx ingest as failed (transient)', function () {
    Http::fake(['*auto-mapping/ingest*' => Http::response('server error', 500)]);

    $outbox = makeOutbox();
    app(AkuntaPostingService::class)->push($outbox);

    expect($outbox->refresh()->status)->toBe('failed');
});

it('does not emit an event whose sync is disabled', function () {
    app(SettingsService::class)->set('sync.acquisition', '0');

    $asset = Asset::query()->where('code', 'AST-0002')->first();
    $asset->purchase()->create(['amount' => 5_000_000, 'purchase_date' => '2026-10-01', 'vendor' => 'PT X']);

    $out = app(AkuntaPostingService::class)->postAcquisition($asset->fresh(['purchase', 'category']));

    expect($out)->toBeNull();
    expect(JournalOutbox::query()->where('source', 'acquisition')->count())->toBe(0);
});

it('returns the per-asset journal log', function () {
    $asset = Asset::query()->where('code', 'AST-0001')->first();
    makeOutbox(['source_ref' => $asset->id, 'source' => 'disposal', 'source_type' => 'asetto.disposal']);
    makeOutbox(['source_ref' => 'other-asset']);

    $this->getJson("/api/assets/{$asset->id}/journals")
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonPath('0.source', 'disposal');
});

it('exposes and updates per-event sync settings', function () {
    $this->getJson('/api/settings')
        ->assertOk()
        ->assertJsonPath('sync.acquisition', true)
        ->assertJsonPath('sync.disposal', true);

    $this->putJson('/api/settings', ['sync' => ['acquisition' => false]])
        ->assertOk()
        ->assertJsonPath('sync.acquisition', false)
        ->assertJsonPath('sync.depreciation', true);

    expect(app(SettingsService::class)->syncEnabled('acquisition'))->toBeFalse();
});
