<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetAuditLog;
use App\Models\AssetCategory;
use App\Models\Custodian;
use App\Models\CustodyHandover;
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

    public function index(Request $request): JsonResponse
    {
        $withValues = (bool) $request->user()?->hasPermission('asset.view_value');
        $assets = Asset::query()->orderBy('code')->get()
            ->map(fn (Asset $a) => Present::asset($a, $withValues));

        return response()->json($assets);
    }

    public function show(Request $request, Asset $asset): JsonResponse
    {
        $withValues = (bool) $request->user()?->hasPermission('asset.view_value');

        return response()->json(Present::asset($asset, $withValues));
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

        $data['code'] ??= $this->nextCode();
        $data['category_id'] ??= AssetCategory::query()->value('id');
        $data['status'] = 'active';
        $data['accumulated_depreciation'] = 0;

        $asset = Asset::query()->create($data);
        AssetAudit::log($asset->id, 'created', 'Aset dibuat.');

        return response()->json(Present::asset($asset), 201);
    }

    public function update(Request $request, Asset $asset): JsonResponse
    {
        $data = $this->validatePayload($request, creating: false);
        $asset->fill($data)->save();
        AssetAudit::log($asset->id, 'updated', 'Data aset diperbarui.');

        return response()->json(Present::asset($asset->refresh()));
    }

    public function destroy(Asset $asset): JsonResponse
    {
        if ((float) $asset->accumulated_depreciation > 0) {
            return response()->json([
                'message' => 'Aset sudah terdepresiasi — gunakan pelepasan, bukan hapus.',
            ], 422);
        }

        $asset->delete();

        return response()->json(['ok' => true]);
    }

    public function setCondition(Request $request, Asset $asset): JsonResponse
    {
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
        ]);
    }

    private function nextCode(): string
    {
        $n = Asset::query()->count() + 1;

        return 'AST-'.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
    }
}
