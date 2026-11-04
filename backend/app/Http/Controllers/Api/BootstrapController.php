<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BootstrapController extends Controller
{
    /** The signed-in shadow user. Shape: web/src/api/types.ts `Me`. */
    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $roles = $user->assignments()
            ->whereNull('revoked_at')
            ->with('role:id,name')
            ->get()
            ->map(fn ($a) => $a->role?->name)
            ->filter()
            ->unique()
            ->values()
            ->all();

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'app_role' => session('ecopa.app_role', $user->isSsoAdmin() ? 'admin' : 'user'),
            'roles' => $roles,
        ]);
    }
}
