<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use Akunta\Rbac\Models\App as RbacApp;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

/**
 * LOCAL-ONLY Ecopa bypass. Logs in a seeded dev admin shadow user so the whole
 * app can be exercised without a running Ecopa. There is no password — this is
 * a no-credential dev shim, hard-disabled unless config('asetto.dev_login')
 * is on AND the app is not in production. Turn the flag off (and configure
 * Ecopa) to restore real SSO. See AGENTS.md §8.2.
 */
class DevLoginController extends Controller
{
    public function login(): RedirectResponse
    {
        abort_unless(config('asetto.dev_login.enabled'), 404);

        $email = (string) config('asetto.dev_login.email', 'dev@asetto.test');

        $user = User::query()->firstOrNew(['email' => $email]);
        if (! $user->exists) {
            $user->id = (string) Str::ulid();
        }
        $user->forceFill([
            'name' => (string) config('asetto.dev_login.name', 'Dev Admin'),
            'main_tier_user_id' => $user->main_tier_user_id ?: 'dev-local',
            'email_verified_at' => $user->email_verified_at ?? now(),
            'disabled_at' => null,
            'last_login_at' => now(),
        ])->save();

        // App-wide active assignment (role_id null — pick a detailed role later).
        $app = RbacApp::query()->firstOrCreate(
            ['code' => (string) config('ecopa.self_slug', 'asetto')],
            ['name' => (string) config('ecopa.registration_name', 'Asetto'), 'version' => '1.0', 'enabled' => true],
        );
        $assignment = $user->assignments()->where('app_id', $app->id)->whereNull('entity_id')->first();
        if (! $assignment) {
            $assignment = $user->assignments()->make([
                'id' => (string) Str::ulid(),
                'app_id' => $app->id,
                'entity_id' => null,
                'assigned_at' => now(),
            ]);
        }
        $assignment->ecopa_role = 'admin';
        $assignment->revoked_at = null;
        $assignment->save();

        session([
            'ecopa.app_role' => 'admin',
            'ecopa.app_scopes' => [],
            'ecopa.divisions' => [],
            'ecopa.dev_login' => true,
        ]);

        Auth::guard('web')->login($user, remember: true);

        return redirect()->intended((string) config('asetto.spa_url') ?: '/');
    }
}
