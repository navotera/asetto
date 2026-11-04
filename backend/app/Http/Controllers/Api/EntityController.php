<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use Akunta\Rbac\Models\Entity;
use Akunta\Rbac\Models\Tenant;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

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
    public function index(): JsonResponse
    {
        $entities = Entity::query()->orderBy('name')->get()
            ->map(fn (Entity $e) => ['id' => $e->id, 'name' => $e->name]);

        return response()->json($entities);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $tenant = Tenant::query()->first() ?? Tenant::query()->create(['name' => 'Default', 'slug' => 'default']);
        $entity = Entity::query()->create([
            'id' => (string) Str::ulid(),
            'name' => $data['name'],
            'tenant_id' => $tenant->id,
        ]);

        return response()->json(['id' => $entity->id, 'name' => $entity->name], 201);
    }
}
