<?php

declare(strict_types=1);

use App\Models\User;
use App\Services\DepreciationEngine;
use App\Services\DepreciationService;
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

it('reports depreciation grouped by category with lazy per-asset detail', function () {
    // Post one depreciation run so there are lines to report on.
    $period = app(DepreciationEngine::class)->pendingPeriod();
    expect($period)->not->toBeNull();
    app(DepreciationService::class)->runForPeriod($period, commit: true);

    $from = $period.'-01';
    $to = $period.'-28';

    $res = $this->getJson("/api/depreciation/report?from={$from}&to={$to}")
        ->assertOk()
        ->assertJsonPath('from', $from)
        ->assertJsonStructure([
            'from', 'to', 'total_amount',
            'categories' => [['category_id', 'category_name', 'asset_count', 'total_amount']],
        ]);

    expect($res->json('categories'))->not->toBeEmpty();
    expect((float) $res->json('total_amount'))->toBeGreaterThan(0);

    // Lazy category detail (per asset).
    $categoryId = $res->json('categories.0.category_id');
    $this->getJson("/api/depreciation/report/{$categoryId}?from={$from}&to={$to}")
        ->assertOk()
        ->assertJsonStructure([['asset_id', 'asset_code', 'asset_name', 'periods', 'total_amount']]);
});

it('defaults the report range to the current month', function () {
    $this->getJson('/api/depreciation/report')
        ->assertOk()
        ->assertJsonPath('from', now()->startOfMonth()->format('Y-m-d'))
        ->assertJsonPath('to', now()->endOfMonth()->format('Y-m-d'));
});
