<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use Akunta\Rbac\Models\App as RbacApp;
use Akunta\Rbac\Models\Entity;
use Akunta\Rbac\Models\UserAppAssignment;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Per-entity teams (groups of users). Members must be users already active in
 * the team's entity. A team can later be an asset's responsible party.
 */
class TeamController extends Controller
{
    /** Teams of an entity + the entity's active users (member picker source). */
    public function index(string $entity): JsonResponse
    {
        abort_unless(Entity::query()->whereKey($entity)->exists(), 404);

        return response()->json($this->payload($entity));
    }

    public function store(Request $request, string $entity): JsonResponse
    {
        abort_unless(Entity::query()->whereKey($entity)->exists(), 404);
        $data = $request->validate(['name' => ['required', 'string', 'max:255']]);

        Team::query()->create(['entity_id' => $entity, 'name' => $data['name']]);

        return response()->json($this->payload($entity), 201);
    }

    public function update(Request $request, Team $team): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:255']]);
        $team->update(['name' => $data['name']]);

        return response()->json($this->payload($team->entity_id));
    }

    public function destroy(Team $team): JsonResponse
    {
        $entityId = $team->entity_id;
        $team->delete();

        return response()->json($this->payload($entityId));
    }

    public function addMember(Request $request, Team $team): JsonResponse
    {
        $data = $request->validate(['user_id' => ['required', 'string', 'exists:users,id']]);

        // A member must be a user active in the team's entity.
        $active = UserAppAssignment::query()
            ->where('app_id', $this->app()->id)
            ->where('entity_id', $team->entity_id)
            ->where('user_id', $data['user_id'])
            ->whereNull('revoked_at')
            ->exists();
        abort_unless($active, 422, 'User belum aktif di entitas ini.');

        $team->members()->syncWithoutDetaching([$data['user_id']]);

        return response()->json($this->payload($team->entity_id));
    }

    public function removeMember(Team $team, string $user): JsonResponse
    {
        $team->members()->detach($user);

        return response()->json($this->payload($team->entity_id));
    }

    /** @return array{teams: array<int, mixed>, entity_users: array<int, mixed>} */
    private function payload(string $entityId): array
    {
        $teams = Team::query()
            ->where('entity_id', $entityId)
            ->with('members:id,name,email')
            ->orderBy('name')
            ->get()
            ->map(fn (Team $t) => Present::team($t));

        $entityUsers = UserAppAssignment::query()
            ->where('app_id', $this->app()->id)
            ->where('entity_id', $entityId)
            ->whereNull('revoked_at')
            ->with('user:id,name,email,disabled_at')
            ->get()
            ->filter(fn (UserAppAssignment $a) => $a->user && ! $a->user->disabled_at)
            ->map(fn (UserAppAssignment $a) => ['user_id' => $a->user_id, 'name' => $a->user?->name, 'email' => $a->user?->email])
            ->unique('user_id')
            ->values();

        return ['teams' => $teams->all(), 'entity_users' => $entityUsers->all()];
    }

    private function app(): RbacApp
    {
        return RbacApp::query()->firstOrCreate(
            ['code' => (string) config('ecopa.self_slug', 'asetto')],
            ['name' => (string) config('ecopa.registration_name', 'Asetto'), 'version' => '1.0', 'enabled' => true],
        );
    }
}
