<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Revokes active access for a shadow user without deleting historical records
 * (assignments, audit trail, asset custody history are preserved — see the
 * lifecycle table in docs CHILD_APP_REGISTRATION_GUIDE.md).
 */
class UserAccessRevoker
{
    public function disable(User $user): void
    {
        $user->forceFill(['disabled_at' => now()])->save();
        $this->revokeSessionsAndTokens($user);
    }

    public function enable(User $user): void
    {
        $user->forceFill(['disabled_at' => null])->save();
    }

    public function revokeSessionsAndTokens(User $user): void
    {
        // Sanctum personal access tokens (API clients), if any.
        if (method_exists($user, 'tokens') && Schema::hasTable('personal_access_tokens')) {
            $user->tokens()->delete();
        }

        // Database-driver web sessions for this user.
        if (config('session.driver') === 'database' && Schema::hasTable(config('session.table', 'sessions'))) {
            DB::table(config('session.table', 'sessions'))
                ->where('user_id', $user->id)
                ->delete();
        }
    }
}
