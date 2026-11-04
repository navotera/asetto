<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('returns 404 when the dev bypass is disabled', function () {
    config(['asetto.dev_login.enabled' => false]);

    $this->get('/auth/dev-login')->assertNotFound();
});

it('logs in a dev admin and redirects to the SPA when enabled', function () {
    config([
        'asetto.dev_login.enabled' => true,
        'asetto.dev_login.email' => 'dev@asetto.test',
        'asetto.spa_url' => 'http://localhost:5180',
    ]);

    $this->get('/auth/dev-login')->assertRedirect('http://localhost:5180');

    $user = User::query()->where('email', 'dev@asetto.test')->first();
    expect($user)->not->toBeNull()
        ->and($user->assignments()->whereNull('revoked_at')->count())->toBe(1);

    // The session is now authenticated — the SPA's /api/me works without Ecopa.
    $this->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('email', 'dev@asetto.test')
        ->assertJsonPath('app_role', 'admin');
});
