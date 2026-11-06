<?php

declare(strict_types=1);

use App\Models\Custodian;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(DatabaseSeeder::class);
    $this->admin = User::query()->create([
        'id' => (string) Str::ulid(),
        'email' => 'admin@example.com',
        'name' => 'Admin',
        'main_tier_user_id' => 'ec-admin',
        'email_verified_at' => now(),
    ]);
    $this->withSession(['ecopa.app_role' => 'admin'])->actingAs($this->admin);
});

it('auto-links a person-custodian to the Ecopa user with the matching email', function () {
    // A synced user whose email matches the seeded custodian "Budi" (budi@example.com).
    $budi = User::query()->create([
        'id' => (string) Str::ulid(),
        'email' => 'budi@example.com',
        'name' => 'Budi',
        'main_tier_user_id' => 'ec-budi',
        'email_verified_at' => now(),
    ]);

    expect(Custodian::query()->where('code', 'EMP-0012')->value('user_id'))->toBeNull();

    $res = $this->postJson('/api/custodians/auto-link')->assertOk();
    expect($res->json('linked'))->toBe(1);
    expect(Custodian::query()->where('code', 'EMP-0012')->value('user_id'))->toBe($budi->id);
});

it('auto-links a matching custodian when the user is assigned via webhook', function () {
    $this->seed(RolesSeeder::class);
    $secret = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
    config(['ecopa.webhook_secret' => $secret]);
    $payload = json_encode([
        'event' => 'user.assigned',
        'event_id' => 'evt-budi',
        'subject' => ['user_id' => 'ec-budi', 'email' => 'budi@example.com', 'name' => 'Budi', 'app_role' => 'user'],
    ]);
    $sig = 'sha256='.hash_hmac('sha256', $payload, $secret);

    $this->call('POST', '/webhooks/ecopa', [], [], [], ['HTTP_X-Ecopa-Signature' => $sig, 'CONTENT_TYPE' => 'application/json'], $payload)
        ->assertOk();

    $budi = User::query()->where('main_tier_user_id', 'ec-budi')->first();
    expect(Custodian::query()->where('code', 'EMP-0012')->value('user_id'))->toBe($budi->id);
});
