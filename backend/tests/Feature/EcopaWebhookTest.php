<?php

declare(strict_types=1);

use App\Models\EcopaWebhookReceipt;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

/** Permanent lifecycle webhook secret (64 hex chars, as Ecopa issues). */
const WEBHOOK_SECRET = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

function signedWebhook(array $payload): TestResponse
{
    config(['ecopa.webhook_secret' => WEBHOOK_SECRET]);
    $raw = json_encode($payload);
    $signature = 'sha256='.hash_hmac('sha256', $raw, WEBHOOK_SECRET);

    return test()->call(
        'POST',
        '/webhooks/ecopa',
        [],
        [],
        [],
        ['HTTP_X-Ecopa-Signature' => $signature, 'CONTENT_TYPE' => 'application/json'],
        $raw,
    );
}

it('rejects a webhook with a missing signature', function () {
    config(['ecopa.webhook_secret' => WEBHOOK_SECRET]);

    $this->postJson('/webhooks/ecopa', [
        'event' => 'user.assigned',
        'event_id' => 'evt-1',
        'subject' => ['user_id' => 'ec-1', 'email' => 'a@example.com'],
    ])->assertStatus(401);
});

it('rejects a webhook with an invalid signature', function () {
    config(['ecopa.webhook_secret' => WEBHOOK_SECRET]);

    $this->call('POST', '/webhooks/ecopa', [], [], [],
        ['HTTP_X-Ecopa-Signature' => 'sha256=deadbeef', 'CONTENT_TYPE' => 'application/json'],
        json_encode(['event' => 'user.assigned', 'event_id' => 'evt-x', 'subject' => []]),
    )->assertStatus(401);
});

it('provisions a shadow user + assignment on user.assigned', function () {
    signedWebhook([
        'event' => 'user.assigned',
        'event_id' => 'evt-assign-1',
        'subject' => ['user_id' => 'ec-42', 'email' => 'budi@example.com', 'name' => 'Budi', 'app_role' => 'user'],
    ])->assertOk()->assertJsonPath('status', 'applied');

    $user = User::query()->where('main_tier_user_id', 'ec-42')->first();
    expect($user)->not->toBeNull()
        ->and($user->email)->toBe('budi@example.com')
        ->and($user->assignments()->whereNull('revoked_at')->count())->toBe(1);
});

it('is idempotent — a replayed event_id is not processed twice', function () {
    $payload = [
        'event' => 'user.assigned',
        'event_id' => 'evt-dup-1',
        'subject' => ['user_id' => 'ec-99', 'email' => 'sari@example.com', 'name' => 'Sari', 'app_role' => 'user'],
    ];

    signedWebhook($payload)->assertOk()->assertJsonPath('status', 'applied');
    signedWebhook($payload)->assertOk()->assertJsonPath('status', 'already_processed');

    expect(User::query()->where('main_tier_user_id', 'ec-99')->count())->toBe(1);
    expect(EcopaWebhookReceipt::query()->where('event_id', 'evt-dup-1')->count())->toBe(1);
});

it('mirrors an Ecopa entity so journals can reference the shared id', function () {
    $id = (string) \Illuminate\Support\Str::ulid();

    signedWebhook([
        'event' => 'entity.created',
        'event_id' => 'evt-ent-1',
        'subject' => ['id' => $id, 'name' => 'PT Maju Jaya', 'npwp' => '01.234.567.8-901.000'],
    ])->assertOk()->assertJsonPath('status', 'applied');

    $entity = \Akunta\Rbac\Models\Entity::query()->whereKey($id)->first();
    expect($entity)->not->toBeNull()
        ->and($entity->name)->toBe('PT Maju Jaya');

    // Asetto exposes active entities for the asset form.
    $user = User::query()->create([
        'id' => (string) \Illuminate\Support\Str::ulid(),
        'email' => 'adm@example.com', 'name' => 'Adm', 'main_tier_user_id' => 'ec-adm', 'email_verified_at' => now(),
    ]);
    $this->withSession(['ecopa.app_role' => 'admin'])->actingAs($user)
        ->getJson('/api/entities')->assertOk()
        ->assertJsonFragment(['id' => $id, 'name' => 'PT Maju Jaya']);
});

it('revokes assignments on user.revoked but keeps the user row', function () {
    signedWebhook([
        'event' => 'user.assigned',
        'event_id' => 'evt-a',
        'subject' => ['user_id' => 'ec-7', 'email' => 'x@example.com', 'app_role' => 'user'],
    ])->assertOk();

    signedWebhook([
        'event' => 'user.revoked',
        'event_id' => 'evt-r',
        'subject' => ['user_id' => 'ec-7', 'email' => 'x@example.com'],
    ])->assertOk();

    $user = User::query()->where('main_tier_user_id', 'ec-7')->first();
    expect($user)->not->toBeNull()
        ->and($user->assignments()->whereNull('revoked_at')->count())->toBe(0);
});
