<?php

declare(strict_types=1);

use App\Models\Asset;
use App\Models\JournalOutbox;
use App\Models\User;
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
    $this->withSession(['ecopa.app_role' => 'admin'])->actingAs($this->user);
});

it('emits an acquisition event when purchase data is entered', function () {
    $assetId = Asset::where('code', 'AST-0002')->value('id');

    $this->postJson("/api/assets/{$assetId}/purchase", [
        'vendor' => 'PT Sumber Jaya',
        'purchase_date' => '2024-06-01',
        'amount' => 38_000_000,
    ])->assertOk();

    $event = JournalOutbox::where('idempotency_key', 'asetto:acq:'.$assetId)->first();
    expect($event)->not->toBeNull()
        ->and($event->source_type)->toBe('asetto.acquisition')
        ->and($event->status)->toBe('queued') // no Akunta token in tests
        ->and($event->entity_id)->not->toBeEmpty()
        ->and($event->payload['event'])->toBe('acquisition')
        ->and((float) $event->payload['amount'])->toBe(38_000_000.0)
        ->and($event->payload['category_code'])->toBe('KMP');
});

it('does not emit an acquisition when purchase amount is zero', function () {
    $assetId = Asset::where('code', 'AST-0002')->value('id');

    $this->postJson("/api/assets/{$assetId}/purchase", [
        'vendor' => 'Tanpa nilai',
        'amount' => 0,
    ])->assertOk();

    expect(JournalOutbox::where('idempotency_key', 'asetto:acq:'.$assetId)->exists())->toBeFalse();
});

it('ingests the acquisition and marks it accepted when Akunta is configured', function () {
    config([
        'akunta-api-client.auto_journal.token' => 'test-token',
        'akunta-api-client.auto_journal.base_url' => 'http://akunta.test',
    ]);
    Http::fake(['*/api/v1/auto-mapping/ingest' => Http::response(['raw_id' => 'raw-9', 'status' => 'accepted'], 202)]);

    $assetId = Asset::where('code', 'AST-0002')->value('id');
    $this->postJson("/api/assets/{$assetId}/purchase", ['amount' => 12_000_000])->assertOk();

    $event = JournalOutbox::where('idempotency_key', 'asetto:acq:'.$assetId)->first();
    expect($event->status)->toBe('accepted')->and($event->akunta_raw_id)->toBe('raw-9');

    Http::assertSent(fn ($request) => $request['source_type'] === 'asetto.acquisition'
        && $request['idempotency_key'] === 'asetto:acq:'.$assetId
        && ! empty($request['source_entity_id'])
        && ! isset($request['entity_id']) // never send both — ingest 422s otherwise
        && (float) $request['payload']['amount'] === 12_000_000.0);
});

it('emits a sale disposal with a gain leg and no zero-value fields', function () {
    // AST-0003: cost 45M, accumulated ~36.83M -> book value ~8.17M; sell for 12M -> gain.
    $assetId = Asset::where('code', 'AST-0003')->value('id');

    $this->postJson('/api/disposals', [
        'asset_id' => $assetId,
        'date' => '2026-11-10',
        'type' => 'sale',
        'proceeds' => 12_000_000,
    ])->assertCreated();

    $event = JournalOutbox::where('source', 'disposal')->where('source_ref', '!=', null)->latest('created_at')->first();
    expect($event->source_type)->toBe('asetto.disposal')
        ->and($event->payload['scenario'])->toBe('sale_gain')
        ->and($event->payload)->toHaveKeys(['cost', 'accumulated', 'proceeds', 'gain'])
        ->and($event->payload)->not->toHaveKey('loss')
        ->and((float) $event->payload['gain'])->toBeGreaterThan(0)
        ->and((float) $event->payload['proceeds'])->toBe(12_000_000.0);
});

it('emits a write-off disposal with a loss leg and no proceeds', function () {
    $assetId = Asset::where('code', 'AST-0003')->value('id');

    $this->postJson('/api/disposals', [
        'asset_id' => $assetId,
        'date' => '2026-11-10',
        'type' => 'writeoff',
    ])->assertCreated();

    $event = JournalOutbox::where('source', 'disposal')->latest('created_at')->first();
    expect($event->payload['scenario'])->toBe('writeoff')
        ->and($event->payload)->not->toHaveKey('proceeds')
        ->and($event->payload)->not->toHaveKey('gain')
        ->and($event->payload)->toHaveKey('loss')
        ->and((float) $event->payload['loss'])->toBeGreaterThan(0);
});
