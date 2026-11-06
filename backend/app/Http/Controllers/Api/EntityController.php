<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use Akunta\Rbac\Models\Entity;
use Akunta\Rbac\Models\Tenant;
use App\Http\Controllers\Controller;
use App\Services\SettingsService;
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
    public function index(SettingsService $settings): JsonResponse
    {
        $disabled = $settings->entityDisabledIds();
        $defaultId = $settings->entityDefaultId();

        $entities = Entity::query()->orderBy('name')->get()
            ->map(fn (Entity $e) => [
                'id' => $e->id,
                'name' => $e->name,
                'enabled' => ! in_array($e->id, $disabled, true),
                'is_default' => $e->id === $defaultId,
            ]);

        return response()->json($entities);
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

        return $this->index($settings);
    }

    /** Make an entity the default selection (and ensure it is enabled). */
    public function setDefault(SettingsService $settings, string $entity): JsonResponse
    {
        abort_unless(Entity::query()->whereKey($entity)->exists(), 404);
        $settings->setEntityDisabledIds(array_values(array_diff($settings->entityDisabledIds(), [$entity])));
        $settings->setEntityDefaultId($entity);

        return $this->index($settings);
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
