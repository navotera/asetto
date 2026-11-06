<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use Akunta\EcopaClient\Http\EcopaAuthController;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

/**
 * Ecopa = authoritative identity store for Asetto.
 *
 * Provisioning rules (mirror Akunta / POSO):
 *   1. Match by main_tier_user_id  → login.
 *   2. Fallback by email → link main_tier_user_id, login.
 *   3. No match + app_role=admin → auto-create shadow user.
 *   4. No match + non-admin → reject (must be assigned to Asetto in Ecopa first).
 *
 * Detailed Asetto roles are NOT set here — they are chosen locally per
 * assignment. Only the Ecopa app_role (admin|user) is kept in the session.
 */
class EcopaController extends EcopaAuthController
{
    protected function provisionUser(array $claims): void
    {
        $email = $claims['email'] ?? null;
        $ecopaSub = (string) ($claims['sub'] ?? '');
        $name = $claims['name'] ?? null;
        $appRole = $claims['app_role'] ?? null;
        $appScopes = $claims['app_scopes'] ?? [];
        $divisions = $claims['divisions'] ?? [];

        if (! $email || ! $ecopaSub) {
            abort(422, 'Ecopa claims missing email/sub');
        }

        if (! $appRole) {
            abort(403, 'Akun belum di-assign ke Asetto. Hubungi admin Ecopa.');
        }

        $user = User::query()->where('main_tier_user_id', $ecopaSub)->first();

        if (! $user) {
            $user = User::query()->where('email', $email)->first();
            if ($user) {
                $user->main_tier_user_id = $ecopaSub;
                $user->email_verified_at ??= now();
            }
        }

        // A user disabled in Ecopa (via the user.disabled webhook) cannot log in.
        // Re-enabling only happens through a user.enabled / user.assigned webhook,
        // never by logging in — so we never silently clear disabled_at here.
        if ($user && $user->disabled_at) {
            abort(403, 'Akun Anda dinonaktifkan. Hubungi admin Ecopa.');
        }

        if (! $user) {
            if ($appRole !== 'admin') {
                abort(403, 'Akun belum di-assign ke Asetto. Hubungi admin Ecopa.');
            }
            $user = new User;
            $user->id = (string) Str::ulid();
            $user->email = $email;
            $user->name = $name ?? Str::before($email, '@');
            $user->main_tier_user_id = $ecopaSub;
            $user->email_verified_at = now();
        }

        if ($name && $user->name !== $name) {
            $user->name = $name;
        }
        $user->last_login_at = now();
        $user->save();

        session([
            'ecopa.app_role' => $appRole,
            'ecopa.app_scopes' => $appScopes,
            'ecopa.divisions' => $divisions,
            'ecopa.access_token' => $claims['access_token'] ?? null,
            'ecopa.token_expires_at' => isset($claims['token_expires_in'])
                ? now()->addSeconds((int) $claims['token_expires_in'])->timestamp
                : null,
        ]);

        Auth::guard('web')->login($user, remember: true);
    }

    protected function successRedirect(): string
    {
        return url('/');
    }

    protected function failureRedirect(): string
    {
        return url('/login');
    }
}
