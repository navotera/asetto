<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route guard: `->middleware('perm:asset.manage')`. Aborts 403 unless the
 * authenticated user holds the permission (admins bypass inside hasPermission).
 */
class CheckPermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        abort_unless(
            (bool) $request->user()?->hasPermission($permission),
            403,
            'Anda tidak memiliki izin untuk tindakan ini.',
        );

        return $next($request);
    }
}
