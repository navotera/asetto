<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetAuditLog;
use App\Models\AssetCategory;
use App\Models\Custodian;
use App\Models\CustodyHandover;
use App\Models\JournalOutbox;
use App\Models\User;
use App\Support\AssetAudit;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AssetController extends Controller
{
    private const METHODS = ['straight_line', 'declining_balance', 'none'];

    private const CONDITIONS = ['good', 'needs_repair', 'broken', 'idle'];

    /**
     * Asset list. Without pagination params it returns the full array (used by
     * reports and asset pickers). With `page`/`per_page` it applies the filters
     * + sort and returns a paginated envelope { items, page, per_page, total,
     * last_page }. The mock store (web/src/api/mock/db.ts) mirrors this exactly.
     */
    public function index(Request $request): JsonResponse
    {
        $withValues = (bool) $request->user()?->hasPermission('asset.view_value');
        $paginated = $request->has('page') || $request->has('per_page');

        $query = Asset::query()
            ->leftJoin('asset_categories', 'assets.category_id', '=', 'asset_categories.id')
            ->leftJoin('custodians', 'assets.custodian_id', '=', 'custodians.id')
            ->select('assets.*');

        // Entity scoping: non-admins only see assets of entities assigned to them.
        /** @var User $user */
        $user = $request->user();
        if (! $user->isAssettoAdmin()) {
            $query->whereIn('assets.entity_id', $user->accessibleEntityIds());
        }

        // Filters.
        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $query->where(function ($w) use ($search) {
                $w->where('assets.name', 'like', "%{$search}%")
                    ->orWhere('assets.code', 'like', "%{$search}%");
            });
        }
        foreach ([
            'category_id' => 'assets.category_id',
            'condition' => 'assets.condition',
            'custodian_id' => 'assets.custodian_id',
            'entity_id' => 'assets.entity_id',
        ] as $param => $column) {
            $value = trim((string) $request->query($param, ''));
            if ($value !== '') {
                $query->where($column, $value);
            }
        }

        // Tab = active (status active) | inactive (disposed) | trashed (soft-deleted).
        // Counts are computed against the filtered base (before the tab is applied)
        // so each tab badge reflects the current search/filters.
        $tab = (string) $request->query('tab', 'active');
        $tab = in_array($tab, ['active', 'inactive', 'trashed'], true) ? $tab : 'active';
        $counts = [
            'active' => (clone $query)->where('assets.status', 'active')->count('assets.id'),
            'inactive' => (clone $query)->where('assets.status', 'disposed')->count('assets.id'),
            'trashed' => (clone $query)->onlyTrashed()->count('assets.id'),
        ];
        if ($tab === 'trashed') {
            $query->onlyTrashed();
        } elseif ($tab === 'inactive') {
            $query->where('assets.status', 'disposed');
        } else {
            $query->where('assets.status', 'active');
        }

        // Sorting.
        $sortColumns = [
            'code' => 'assets.code',
            'name' => 'assets.name',
            'category' => 'asset_categories.name',
            'custodian' => 'custodians.name',
            'acquisition_date' => 'assets.acquisition_date',
            'acquisition_cost' => 'assets.acquisition_cost',
            'condition' => 'assets.condition',
            'status' => 'assets.status',
        ];
        $sort = (string) $request->query('sort', 'code');
        $dir = strtolower((string) $request->query('dir', 'asc')) === 'desc' ? 'desc' : 'asc';
        if ($sort === 'book_value') {
            $query->orderByRaw('(assets.acquisition_cost - assets.accumulated_depreciation) '.$dir);
        } else {
            $query->orderBy($sortColumns[$sort] ?? 'assets.code', $dir);
        }

        if (! $paginated) {
            $assets = $query->get()->map(fn (Asset $a) => Present::asset($a, $withValues));

            return response()->json($assets);
        }

        $perPage = min(100, max(1, (int) $request->query('per_page', 25)));
        $page = max(1, (int) $request->query('page', 1));
        $p = $query->paginate($perPage, ['assets.*'], 'page', $page);

        return response()->json([
            'items' => collect($p->items())->map(fn (Asset $a) => Present::asset($a, $withValues))->values(),
            'page' => $p->currentPage(),
            'per_page' => $p->perPage(),
            'total' => $p->total(),
            'last_page' => $p->lastPage(),
            'counts' => $counts,
        ]);
    }

    public function show(Request $request, Asset $asset): JsonResponse
    {
        $this->authorizeEntity($asset);
        $withValues = (bool) $request->user()?->hasPermission('asset.view_value');

        return response()->json(Present::asset($asset, $withValues));
    }

    /** Non-admins may only touch assets of entities assigned to them. */
    private function authorizeEntity(Asset $asset): void
    {
        /** @var User|null $user */
        $user = Auth::user();
        abort_unless(
            $user && ($user->isAssettoAdmin() || $user->accessibleEntityIds()->contains($asset->entity_id)),
            403,
            'Tidak memiliki akses ke entitas aset ini.',
        );
    }

    /** Assets delegated to the current user (custodian linked to them), without values. */
    public function mine(Request $request): JsonResponse
    {
        $custodianIds = Custodian::query()
            ->where('user_id', $request->user()?->id)
            ->pluck('id');

        $assets = Asset::query()
            ->with('category:id,name')
            ->whereIn('custodian_id', $custodianIds)
            ->orderBy('code')
            ->get()
            ->map(fn (Asset $a) => [
                'id' => $a->id,
                'code' => $a->code,
                'name' => $a->name,
                'category_name' => $a->category?->name,
                'condition' => $a->condition,
                'location' => $a->location,
                'status' => $a->status,
                'acquisition_date' => $a->acquisition_date?->format('Y-m-d'),
            ]);

        return response()->json($assets);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request, creating: true);

        /** @var User|null $user */
        $user = $request->user();
        if ($user && ! $user->isAssettoAdmin() && ! $user->accessibleEntityIds()->contains($data['entity_id'])) {
            abort(403, 'Tidak memiliki akses ke entitas ini.');
        }

        $data['code'] ??= $this->nextCode();
        $data['category_id'] ??= AssetCategory::query()->value('id');
        $data['status'] = 'active';
        $data['accumulated_depreciation'] = 0;
        $data['sync_akunta'] ??= true;

        $asset = Asset::query()->create($data);
        AssetAudit::log($asset->id, 'created', 'Aset dibuat.');

        return response()->json(Present::asset($asset), 201);
    }

    public function update(Request $request, Asset $asset): JsonResponse
    {
        $this->authorizeEntity($asset);
        $data = $this->validatePayload($request, creating: false);
        $asset->fill($data)->save();
        AssetAudit::log($asset->id, 'updated', 'Data aset diperbarui.');

        return response()->json(Present::asset($asset->refresh()));
    }

    public function destroy(Asset $asset): JsonResponse
    {
        $this->authorizeEntity($asset);
        if ((float) $asset->accumulated_depreciation > 0) {
            return response()->json([
                'message' => 'Aset sudah terdepresiasi — gunakan pelepasan, bukan hapus.',
            ], 422);
        }

        $asset->delete();
        AssetAudit::log($asset->id, 'trashed', 'Aset dipindahkan ke sampah.');

        return response()->json(['ok' => true]);
    }

    /** Restore a soft-deleted (trashed) asset back to its tab. */
    public function restore(Asset $asset): JsonResponse
    {
        $this->authorizeEntity($asset);
        $asset->restore();
        AssetAudit::log($asset->id, 'restored', 'Aset dipulihkan dari sampah.');

        return response()->json(Present::asset($asset->refresh()));
    }

    public function setCondition(Request $request, Asset $asset): JsonResponse
    {
        $this->authorizeEntity($asset);
        $data = $request->validate([
            'condition' => ['required', Rule::in(self::CONDITIONS)],
        ]);

        $asset->condition = $data['condition'];
        $asset->save();
        AssetAudit::log($asset->id, 'condition', "Kondisi diubah menjadi {$data['condition']}.");

        return response()->json(Present::asset($asset));
    }

    public function reassign(Request $request, Asset $asset): JsonResponse
    {
        $this->authorizeEntity($asset);
        $data = $request->validate([
            'custodian_id' => ['nullable', 'string', 'exists:custodians,id'],
            'location' => ['nullable', 'string', 'max:255'],
            'condition_at_handover' => ['nullable', Rule::in(self::CONDITIONS)],
            'notes' => ['nullable', 'string'],
        ]);

        DB::transaction(function () use ($asset, $data) {
            // Record the handover history before mutating the asset.
            CustodyHandover::query()->create([
                'id' => (string) Str::ulid(),
                'asset_id' => $asset->id,
                'from_custodian_id' => $asset->custodian_id,
                'to_custodian_id' => $data['custodian_id'] ?? null,
                'from_location' => $asset->location,
                'to_location' => $data['location'] ?? $asset->location,
                'condition_at_handover' => $data['condition_at_handover'] ?? $asset->condition,
                'notes' => $data['notes'] ?? null,
                'handed_by_user_id' => Auth::id(),
                'handed_at' => now(),
            ]);

            $asset->custodian_id = $data['custodian_id'] ?? null;
            if (! empty($data['location'])) {
                $asset->location = $data['location'];
            }
            if (! empty($data['condition_at_handover'])) {
                $asset->condition = $data['condition_at_handover'];
            }
            $asset->save();
        });

        $condNote = ! empty($data['condition_at_handover']) ? " · kondisi {$data['condition_at_handover']}" : '';
        AssetAudit::log($asset->id, 'reassigned', "Tanggung jawab dilimpahkan{$condNote}.");

        return response()->json(Present::asset($asset->refresh()));
    }

    /** Append-only activity/audit trail for an asset (newest first). */
    public function auditTrail(Asset $asset): JsonResponse
    {
        $rows = AssetAuditLog::query()
            ->where('asset_id', $asset->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'action' => $r->action,
                'description' => $r->description,
                'actor_name' => $r->actor_name,
                'created_at' => $r->created_at?->toIso8601String(),
            ]);

        return response()->json($rows);
    }

    /** Economic-event journals that point at this asset (acquisition + disposal). */
    public function journals(Asset $asset): JsonResponse
    {
        $rows = JournalOutbox::query()
            ->where('source_ref', $asset->id)
            ->latest('created_at')
            ->get()
            ->map(fn (JournalOutbox $j) => Present::journal($j));

        return response()->json($rows);
    }

    /** Custody delegation history for an asset (newest first). */
    public function custodyHistory(Asset $asset): JsonResponse
    {
        $rows = $asset->custodyHandovers()->with(['fromCustodian:id,name', 'toCustodian:id,name'])->get()
            ->map(fn (CustodyHandover $h) => Present::custodyHandover($h));

        return response()->json($rows);
    }

    /** Per-asset depreciation history (periods applied to this asset). */
    public function depreciationHistory(Asset $asset): JsonResponse
    {
        $rows = $asset->depreciationLines()
            ->with('run:id,period,status,journal_id,posted_at')
            ->get()
            ->sortByDesc(fn ($line) => $line->run?->period)
            ->values()
            ->map(fn ($line) => Present::assetDepreciationLine($line));

        return response()->json($rows);
    }

    /** @return array<string, mixed> */
    private function validatePayload(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'code' => ['sometimes', 'nullable', 'string', 'max:64'],
            'name' => [$required, 'string', 'max:255'],
            'entity_id' => [$creating ? 'required' : 'sometimes', 'string', 'exists:entities,id'],
            'category_id' => ['sometimes', 'nullable', 'string', 'exists:asset_categories,id'],
            'acquisition_date' => [$required, 'date'],
            'acquisition_cost' => [$required, 'numeric', 'min:0'],
            'salvage_value' => ['sometimes', 'numeric', 'min:0'],
            'useful_life_months' => ['sometimes', 'integer', 'min:1'],
            'method' => ['sometimes', Rule::in(self::METHODS)],
            'condition' => ['sometimes', Rule::in(self::CONDITIONS)],
            'custodian_id' => ['sometimes', 'nullable', 'string', 'exists:custodians,id'],
            'location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'serial_number' => ['sometimes', 'nullable', 'string', 'max:255'],
            'notes' => ['sometimes', 'nullable', 'string'],
            'sync_akunta' => ['sometimes', 'boolean'],
        ]);
    }

    private function nextCode(): string
    {
        $n = Asset::query()->count() + 1;

        return 'AST-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
    }
}
