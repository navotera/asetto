<?php

declare(strict_types=1);

use App\Http\Controllers\Auth\EcopaController;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

uses(RefreshDatabase::class);

/** Invoke the protected provisioning hook with fake OIDC claims. */
function provision(array $claims): void
{
    $controller = app(EcopaController::class);
    $m = new ReflectionMethod($controller, 'provisionUser');
    $m->setAccessible(true);
    $m->invoke($controller, $claims);
}

it('blocks login for a user disabled in Ecopa', function () {
    User::query()->create([
        'id' => (string) Str::ulid(),
        'email' => 'budi@example.com',
        'name' => 'Budi',
        'main_tier_user_id' => 'ec-budi',
        'email_verified_at' => now(),
        'disabled_at' => now(), // disabled via the user.disabled webhook
    ]);

    try {
        provision(['email' => 'budi@example.com', 'sub' => 'ec-budi', 'name' => 'Budi', 'app_role' => 'user']);
        $this->fail('Expected a 403 abort for a disabled user.');
    } catch (HttpException $e) {
        expect($e->getStatusCode())->toBe(403);
    }

    // Still disabled — login did not silently re-enable the account.
    expect(User::query()->where('main_tier_user_id', 'ec-budi')->value('disabled_at'))->not->toBeNull();
    expect(auth()->check())->toBeFalse();
});

it('lets an active user log in', function () {
    User::query()->create([
        'id' => (string) Str::ulid(),
        'email' => 'sari@example.com',
        'name' => 'Sari',
        'main_tier_user_id' => 'ec-sari',
        'email_verified_at' => now(),
    ]);

    provision(['email' => 'sari@example.com', 'sub' => 'ec-sari', 'name' => 'Sari', 'app_role' => 'user']);

    expect(auth()->check())->toBeTrue();
    expect(auth()->user()->email)->toBe('sari@example.com');
});
