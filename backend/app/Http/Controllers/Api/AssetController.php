<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AssetController extends Controller
{
    private const METHODS = ['straight_line', 'declining_balance', 'none'];

    private const CONDITIONS = ['good', 'needs_repair', 'broken', 'idle'];

    public function index(): JsonResponse
    {
        $assets = Asset::query()->orderBy('code')->get()
            ->map(fn (Asset $a) => Present::asset($a));

        return response()->json($assets);
    }

    public function show(Asset $asset): JsonResponse
    {
        return response()->json(Present::asset($asset));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request, creating: true);

        $data['code'] ??= $this->nextCode();
        $data['category_id'] ??= AssetCategory::query()->value('id');
        $data['status'] = 'active';
        $data['accumulated_depreciation'] = 0;

        $asset = Asset::query()->create($data);

        return response()->json(Present::asset($asset), 201);
    }

    public function update(Request $request, Asset $asset): JsonResponse
    {
        $data = $this->validatePayload($request, creating: false);
        $asset->fill($data)->save();

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

        return response()->json(Present::asset($asset));
    }

    public function reassign(Request $request, Asset $asset): JsonResponse
    {
        $data = $request->validate([
            'custodian_id' => ['nullable', 'string', 'exists:custodians,id'],
            'location' => ['nullable', 'string', 'max:255'],
        ]);

        $asset->custodian_id = $data['custodian_id'] ?? null;
        if (! empty($data['location'])) {
            $asset->location = $data['location'];
        }
        $asset->save();

        return response()->json(Present::asset($asset));
    }

    /** @return array<string, mixed> */
    private function validatePayload(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'code' => ['sometimes', 'nullable', 'string', 'max:64'],
            'name' => [$required, 'string', 'max:255'],
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
