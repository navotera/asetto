<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use Akunta\Rbac\Models\App as RbacApp;
use Akunta\Rbac\Models\Entity;
use Akunta\Rbac\Models\Role;
use Akunta\Rbac\Models\Tenant;
use Akunta\Rbac\Models\UserAppAssignment;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\User;
use App\Services\SettingsService;
use App\Services\UserAccessRevoker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Entities (companies/PT) that assets — and their journals — belong to. These
 * are Asetto's OWN entities (id generated here, or synced from Ecopa for names).
 * The id travels to Akunta as the ingest `source_entity_id`, which the Akunta
 * admin maps once to an Akunta entity via AutoMappingEntityLink; there is no
 * shared-id requirement. The store() endpoint lets an admin add an entity when
 * Ecopa sync isn't wired up.
 */
class EntityController extends Controller
{
    public function index(Request $request, SettingsService $settings): JsonResponse
    {
        $disabled = $settings->entityDisabledIds();
        $defaultId = $settings->entityDefaultId();

        /** @var User $user */
        $user = $request->user();
        $query = Entity::query()->orderBy('name');
        // Non-admins only see entities an admin assigned them to.
        if (! $user->isAssettoAdmin()) {
            $query->whereIn('id', $user->accessibleEntityIds());
        }
        $entities = $query->get();

        $counts = $this->entityUserCounts($entities->pluck('id')->all());

        $out = $entities->map(fn (Entity $e) => [
            'id' => $e->id,
            'name' => $e->name,
            'enabled' => ! in_array($e->id, $disabled, true),
            'is_default' => $e->id === $defaultId,
            'user_count' => $counts[$e->id] ?? 0,
        ]);

        return response()->json($out);
    }

    /**
     * Distinct active non-admin users assigned to each given entity.
     *
     * @param  array<int, string>  $entityIds
     * @return array<string, int>
     */
    private function entityUserCounts(array $entityIds): array
    {
        if ($entityIds === []) {
            return [];
        }

        return UserAppAssignment::query()
            ->where('app_id', $this->app()->id)
            ->whereNull('revoked_at')
            ->whereIn('entity_id', $entityIds)
            ->get(['entity_id', 'user_id'])
            ->groupBy('entity_id')
            ->map(fn ($rows) => $rows->pluck('user_id')->unique()->count())
            ->all();
    }

    /**
     * Responsible-party candidates for an entity: its active users + its teams.
     * Accessible to anyone who can read assets of the entity (not admin-only),
     * for the asset form / pelimpahan picker.
     */
    public function responsibles(Request $request, string $entity): JsonResponse
    {
        abort_unless(Entity::query()->whereKey($entity)->exists(), 404);
        /** @var User $user */
        $user = $request->user();
        abort_unless($user->isAssettoAdmin() || $user->accessibleEntityIds()->contains($entity), 403);

        $app = $this->app();
        $users = UserAppAssignment::query()
            ->where('app_id', $app->id)
            ->where('entity_id', $entity)
            ->whereNull('revoked_at')
            ->with('user:id,name,email,disabled_at')
            ->get()
            ->filter(fn (UserAppAssignment $a) => $a->user && ! $a->user->disabled_at)
            ->map(fn (UserAppAssignment $a) => ['user_id' => $a->user_id, 'name' => $a->user?->name, 'email' => $a->user?->email])
            ->unique('user_id')
            ->values();

        $teams = Team::query()->where('entity_id', $entity)->orderBy('name')->get(['id', 'name'])
            ->map(fn (Team $t) => ['id' => $t->id, 'name' => $t->name])
            ->values();

        return response()->json(['users' => $users, 'teams' => $teams]);
    }

    /** Users assigned to an entity, plus assignable Ecopa-synced users + roles. */
    public function users(string $entity): JsonResponse
    {
        abort_unless(Entity::query()->whereKey($entity)->exists(), 404);
        $app = $this->app();

        $assigned = UserAppAssignment::query()
            ->where('app_id', $app->id)
            ->where('entity_id', $entity)
            ->whereNull('revoked_at')
            ->with(['user:id,name,email,disabled_at', 'role:id,code,name'])
            ->get()
            ->map(fn (UserAppAssignment $a) => [
                'assignment_id' => $a->id,
                'user_id' => $a->user_id,
                'name' => $a->user?->name,
                'email' => $a->user?->email,
                'role_id' => $a->role_id,
                'role_code' => $a->role?->code,
                'role_name' => $a->role?->name,
                'disabled_at' => $a->user?->disabled_at?->toIso8601String(),
            ])
            ->values();

        $assignedIds = $assigned->pluck('user_id')->all();

        // Assignable = Ecopa-synced members (active app-wide membership) not yet
        // assigned to this entity, and not disabled.
        $assignable = UserAppAssignment::query()
            ->where('app_id', $app->id)
            ->whereNull('entity_id')
            ->whereNull('revoked_at')
            ->with('user:id,name,email,disabled_at')
            ->get()
            ->filter(fn (UserAppAssignment $a) => $a->user && ! $a->user->disabled_at && ! in_array($a->user_id, $assignedIds, true))
            ->map(fn (UserAppAssignment $a) => [
                'user_id' => $a->user_id,
                'name' => $a->user?->name,
                'email' => $a->user?->email,
            ])
            ->values();

        return response()->json([
            'assigned' => $assigned,
            'assignable' => $assignable,
            'roles' => $this->entityRoles()->map(fn (Role $r) => ['id' => $r->id, 'code' => $r->code, 'name' => $r->name])->values(),
        ]);
    }

    /** Assign a synced user to an entity with a (non-admin) role. */
    public function assignUser(Request $request, UserAccessRevoker $revoker, string $entity): JsonResponse
    {
        abort_unless(Entity::query()->whereKey($entity)->exists(), 404);
        $data = $request->validate([
            'user_id' => ['required', 'string', 'exists:users,id'],
            'role_id' => ['required', 'string', Rule::in($this->entityRoles()->pluck('id'))],
        ]);

        $app = $this->app();
        $assignment = UserAppAssignment::query()
            ->where('app_id', $app->id)
            ->where('user_id', $data['user_id'])
            ->where('entity_id', $entity)
            ->first();

        if (! $assignment) {
            $assignment = new UserAppAssignment;
            $assignment->id = (string) Str::ulid();
            $assignment->user_id = $data['user_id'];
            $assignment->app_id = $app->id;
            $assignment->entity_id = $entity;
            $assignment->assigned_at = now();
        }
        $assignment->role_id = $data['role_id'];
        $assignment->assigned_by = Auth::id();
        $assignment->revoked_at = null;
        $assignment->save();

        if ($user = User::query()->find($data['user_id'])) {
            $revoker->revokeSessionsAndTokens($user);
        }

        return $this->users($entity);
    }

    /** Remove a user's access to an entity. */
    public function unassignUser(UserAccessRevoker $revoker, string $entity, string $user): JsonResponse
    {
        abort_unless(Entity::query()->whereKey($entity)->exists(), 404);
        UserAppAssignment::query()
            ->where('app_id', $this->app()->id)
            ->where('entity_id', $entity)
            ->where('user_id', $user)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);

        if ($model = User::query()->find($user)) {
            $revoker->revokeSessionsAndTokens($model);
        }

        return $this->users($entity);
    }

    private function app(): RbacApp
    {
        return RbacApp::query()->firstOrCreate(
            ['code' => (string) config('ecopa.self_slug', 'asetto')],
            ['name' => (string) config('ecopa.registration_name', 'Asetto'), 'version' => '1.0', 'enabled' => true],
        );
    }

    /** Roles assignable to a user within an entity — everything below admin. */
    private function entityRoles()
    {
        $codes = array_values(array_filter(
            array_keys(config('asetto_permissions.roles', [])),
            fn (string $code) => $code !== 'admin',
        ));

        return Role::query()->whereNull('tenant_id')->whereIn('code', $codes)->get();
    }

    /**
     * Toggle whether an entity is selectable in the switcher (on/off).
     *
     * Entity ids are custom slugs, not ULIDs, so implicit route-model binding
     * (HasUlids) would 404 — resolve the id manually instead.
     */
    public function setEnabled(Request $request, SettingsService $settings, string $entity): JsonResponse
    {
        abort_unless(Entity::query()->whereKey($entity)->exists(), 404);
        $enabled = (bool) $request->validate(['enabled' => ['required', 'boolean']])['enabled'];
        $disabled = $settings->entityDisabledIds();

        if ($enabled) {
            $disabled = array_values(array_diff($disabled, [$entity]));
        } else {
            $allIds = Entity::query()->pluck('id')->all();
            $enabledCount = count(array_diff($allIds, $disabled));
            if (! in_array($entity, $disabled, true) && $enabledCount <= 1) {
                return response()->json(['message' => 'Minimal satu entitas harus aktif.'], 422);
            }
            $disabled = array_values(array_unique([...$disabled, $entity]));
            // Disabling the default → move the default to the first still-enabled entity.
            if ($settings->entityDefaultId() === $entity) {
                $next = collect($allIds)->first(fn ($id) => ! in_array($id, $disabled, true));
                $settings->setEntityDefaultId($next);
            }
        }

        $settings->setEntityDisabledIds($disabled);

        return $this->index(request(), $settings);
    }

    /** Make an entity the default selection (and ensure it is enabled). */
    public function setDefault(SettingsService $settings, string $entity): JsonResponse
    {
        abort_unless(Entity::query()->whereKey($entity)->exists(), 404);
        $settings->setEntityDisabledIds(array_values(array_diff($settings->entityDisabledIds(), [$entity])));
        $settings->setEntityDefaultId($entity);

        return $this->index(request(), $settings);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $tenant = Tenant::query()->first() ?? Tenant::query()->create(['name' => 'Default', 'slug' => 'default']);
        $entity = Entity::query()->create([
            'id' => $this->makeEntityId($data['name']),
            'name' => $data['name'],
            'tenant_id' => $tenant->id,
        ]);

        // New entities are enabled and non-default by default.
        return response()->json(['id' => $entity->id, 'name' => $entity->name, 'enabled' => true, 'is_default' => false], 201);
    }

    /**
     * A human-readable, unique entity id derived from the name — e.g.
     * "PT Guna Dharma" → "ent_guna_dharma_x7k2". Kept within the 26-char id
     * column (rbac entities.id is a ULID column), so the slug is capped and a
     * short random suffix keeps it unique.
     */
    private function makeEntityId(string $name): string
    {
        $slug = Str::of($name)
            ->lower()
            ->replaceMatches('/\b(pt|cv|ud|pd|tbk|persero)\b\.?/u', ' ') // drop legal-form words
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->limit(17, '')
            ->trim('_')
            ->value();
        $slug = $slug !== '' ? $slug : 'entitas';

        do {
            $id = 'ent_'.$slug.'_'.Str::lower(Str::random(4));
        } while (Entity::query()->whereKey($id)->exists());

        return $id;
    }
}
