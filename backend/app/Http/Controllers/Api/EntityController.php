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
            'id' => $this->makeEntityId($data['name']),
            'name' => $data['name'],
            'tenant_id' => $tenant->id,
        ]);

        return response()->json(['id' => $entity->id, 'name' => $entity->name], 201);
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
