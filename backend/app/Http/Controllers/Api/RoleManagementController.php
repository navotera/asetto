<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use Akunta\Rbac\Models\App as RbacApp;
use Akunta\Rbac\Models\Role;
use Akunta\Rbac\Models\UserAppAssignment;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\UserAccessRevoker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Admin screen: assign Asetto's 3 preset roles to Ecopa-synced users, plus
 * impersonation. App-wide (entity_id null). Identity key = Ecopa user UUID
 * (users.main_tier_user_id); email is only a fallback for not-yet-synced users.
 */
class RoleManagementController extends Controller
{
    public function __construct(private readonly UserAccessRevoker $accessRevoker) {}

    public function index(): JsonResponse
    {
        $app = $this->app();

        $assignments = UserAppAssignment::query()
            ->where('app_id', $app->id)
            ->whereNull('entity_id')
            ->whereNull('revoked_at')
            ->with(['user:id,name,email,main_tier_user_id,disabled_at', 'role:id,code,name'])
            ->get();

        $meId = Auth::id();

        $users = $assignments->whereNotNull('role_id')->map(fn (UserAppAssignment $a) => [
            'assignment_id' => $a->id,
            'user_id' => $a->user_id,
            'ecopa_user_id' => $a->user?->main_tier_user_id,
            'name' => $a->user?->name,
            'email' => $a->user?->email,
            'ecopa_role' => $a->ecopa_role,
            'role_id' => $a->role_id,
            'role_code' => $a->role?->code,
            'role_name' => $a->role?->name,
            'disabled_at' => $a->user?->disabled_at?->toIso8601String(),
            'can_update_role' => $a->user_id !== $meId, // cannot change your own role
            // Impersonation is available for every user except yourself (and disabled ones).
            'can_impersonate' => $a->user_id !== $meId && ! $a->user?->disabled_at,
        ])->values();

        $unassigned = $assignments->whereNull('role_id')->map(fn (UserAppAssignment $a) => [
            'assignment_id' => $a->id,
            'user_id' => $a->user_id,
            'ecopa_user_id' => $a->user?->main_tier_user_id,
            'name' => $a->user?->name,
            'email' => $a->user?->email,
            'can_impersonate' => $a->user_id !== $meId && ! $a->user?->disabled_at,
        ])->values();

        return response()->json([
            'users' => $users,
            'unassigned_users' => $unassigned,
            'roles' => $this->assignableRoles()->map(fn (Role $r) => ['id' => $r->id, 'code' => $r->code, 'name' => $r->name])->values(),
        ]);
    }

    public function assign(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['nullable', 'string'],
            'ecopa_user_id' => ['nullable', 'string'],
            'role_id' => ['required', 'string', Rule::in($this->assignableRoles()->pluck('id'))],
        ]);

        $user = $this->resolveUser($data);
        if (! $user) {
            return response()->json(['message' => 'User tidak ditemukan. Sediakan user_id atau ecopa_user_id dari pengguna yang sudah di-assign Ecopa.'], 422);
        }

        $app = $this->app();
        $assignment = UserAppAssignment::query()
            ->where('app_id', $app->id)->where('user_id', $user->id)->whereNull('entity_id')->first();

        if (! $assignment) {
            $assignment = new UserAppAssignment;
            $assignment->id = (string) Str::ulid();
            $assignment->user_id = $user->id;
            $assignment->app_id = $app->id;
            $assignment->entity_id = null;
            $assignment->assigned_at = now();
        }
        $assignment->role_id = $data['role_id'];
        $assignment->assigned_by = Auth::id();
        $assignment->revoked_at = null;
        $assignment->save();

        $this->accessRevoker->revokeSessionsAndTokens($user);

        return response()->json(['assignment_id' => $assignment->id, 'user_id' => $user->id, 'role_id' => $assignment->role_id]);
    }

    public function update(Request $request, string $assignmentId): JsonResponse
    {
        $data = $request->validate([
            'role_id' => ['nullable', 'string', Rule::in($this->assignableRoles()->pluck('id'))],
        ]);

        $assignment = UserAppAssignment::query()->where('app_id', $this->app()->id)->findOrFail($assignmentId);

        if ($assignment->user_id === Auth::id()) {
            return response()->json(['message' => 'Anda tidak dapat mengubah role Anda sendiri.'], 422);
        }

        $assignment->role_id = $data['role_id'] ?? null;
        $assignment->assigned_by = Auth::id();
        $assignment->save();

        if ($user = User::query()->find($assignment->user_id)) {
            $this->accessRevoker->revokeSessionsAndTokens($user);
        }

        return response()->json(['assignment_id' => $assignment->id, 'role_id' => $assignment->role_id]);
    }

    public function impersonate(Request $request, string $assignmentId): JsonResponse
    {
        $assignment = UserAppAssignment::query()
            ->where('app_id', $this->app()->id)
            ->with(['user', 'role:id,code'])
            ->findOrFail($assignmentId);

        $target = $assignment->user;
        abort_if(! $target || $target->disabled_at, 422, 'User target tidak aktif.');
        abort_if($target->id === Auth::id(), 422, 'Tidak dapat impersonate diri sendiri.');

        $request->session()->put('impersonator_id', Auth::id());
        $request->session()->put('impersonator.app_role', session('ecopa.app_role'));

        Auth::guard('web')->login($target);
        // Act exactly as the target: admin level only if the target is itself an admin,
        // otherwise a plain user so permissions follow the target's local role.
        $targetIsAdmin = $assignment->ecopa_role === 'admin' || $assignment->role?->code === 'admin';
        session(['ecopa.app_role' => $targetIsAdmin ? 'admin' : 'user']);

        return response()->json(['ok' => true, 'impersonating' => $target->name]);
    }

    public function stopImpersonation(Request $request): JsonResponse
    {
        $impersonatorId = $request->session()->pull('impersonator_id');
        $appRole = $request->session()->pull('impersonator.app_role');
        if (! $impersonatorId) {
            return response()->json(['message' => 'Tidak sedang impersonate.'], 422);
        }

        if ($admin = User::query()->find($impersonatorId)) {
            Auth::guard('web')->login($admin);
        }
        session(['ecopa.app_role' => $appRole ?? 'admin']);

        return response()->json(['ok' => true]);
    }

    private function app(): RbacApp
    {
        return RbacApp::query()->firstOrCreate(
            ['code' => (string) config('ecopa.self_slug', 'asetto')],
            ['name' => (string) config('ecopa.registration_name', 'Asetto'), 'version' => '1.0', 'enabled' => true],
        );
    }

    /** @return Collection<int, Role> */
    private function assignableRoles()
    {
        $codes = array_keys(config('asetto_permissions.roles', []));

        return Role::query()->whereNull('tenant_id')->whereIn('code', $codes)->get();
    }

    /**
     * Resolve the target user. Only users already synced from Ecopa can be
     * assigned a role — there is no provision-by-email path.
     *
     * @param array<string, mixed> $data
     */
    private function resolveUser(array $data): ?User
    {
        if (! empty($data['user_id'])) {
            return User::query()->find($data['user_id']);
        }
        if (! empty($data['ecopa_user_id'])) {
            return User::query()->where('main_tier_user_id', $data['ecopa_user_id'])->first();
        }

        return null;
    }
}
