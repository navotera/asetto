<?php

declare(strict_types=1);

use App\Services\EcopaIntegrationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

it('stores the operator base_url and derives redirect_uri + webhook from it', function () {
    Http::fake([
        '*/api/app-registration-requests' => Http::response(['data' => ['id' => 'req_42', 'status' => 'pending']], 202),
    ]);

    $service = app(EcopaIntegrationService::class);
    $status = $service->requestIntegratedRegistration([
        'ecopa_url' => 'https://ecopa.example.com',
        'registration_token' => 'TOKEN-ABC-123',
        'base_url' => 'https://aset.perusahaan.co.id',
    ]);

    expect($status['base_url'])->toBe('https://aset.perusahaan.co.id');
    expect($status['redirect_uri'])->toBe('https://aset.perusahaan.co.id/auth/ecopa/callback');
    expect($status['webhook_url'])->toBe('https://aset.perusahaan.co.id/webhooks/ecopa');
    expect($status['registration_status'])->toBe('pending');

    // The outbound request carried the operator base_url, not APP_URL.
    Http::assertSent(fn ($request) => $request['base_url'] === 'https://aset.perusahaan.co.id');
});

it('falls back to APP_URL when base_url is left blank', function () {
    config()->set('app.url', 'https://fallback.example.com');
    config()->set('ecopa.registration_base_url', null);

    Http::fake([
        '*/api/app-registration-requests' => Http::response(['data' => ['id' => 'req_7', 'status' => 'pending']], 202),
    ]);

    $status = app(EcopaIntegrationService::class)->requestIntegratedRegistration([
        'ecopa_url' => 'https://ecopa.example.com',
        'registration_token' => 'TOKEN-XYZ',
    ]);

    expect($status['base_url'])->toBe('https://fallback.example.com');
    expect($status['webhook_url'])->toBe('https://fallback.example.com/webhooks/ecopa');
});

it('exposes base_url and redirect_uri through the public registration status endpoint', function () {
    $this->getJson('/api/integration/status')
        ->assertOk()
        ->assertJsonStructure(['data' => ['base_url', 'redirect_uri', 'webhook_url', 'ecopa_url', 'configured']]);
});
