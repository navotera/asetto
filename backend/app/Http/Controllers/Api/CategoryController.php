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

class CategoryController extends Controller
{
    private const METHODS = ['straight_line', 'declining_balance', 'none'];

    public function index(): JsonResponse
    {
        $categories = AssetCategory::query()->withCount('assets')->orderBy('code')->get()
            ->map(fn (AssetCategory $c) => Present::category($c));

        return response()->json($categories);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatePayload($request, null);
        $category = AssetCategory::query()->create($data);

        return response()->json(Present::category($category), 201);
    }

    public function update(Request $request, AssetCategory $category): JsonResponse
    {
        $data = $this->validatePayload($request, $category->id);
        $category->fill($data)->save();

        return response()->json(Present::category($category->refresh()));
    }

    public function destroy(AssetCategory $category): JsonResponse
    {
        if (Asset::query()->where('category_id', $category->id)->exists()) {
            return response()->json(['message' => 'Kategori masih dipakai aset — tidak dapat dihapus.'], 422);
        }

        $category->delete();

        return response()->json(['ok' => true]);
    }

    /** @return array<string, mixed> */
    private function validatePayload(Request $request, ?string $ignoreId): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:32', Rule::unique('asset_categories', 'code')->ignore($ignoreId)],
            'name' => ['required', 'string', 'max:255'],
            'default_method' => ['required', Rule::in(self::METHODS)],
            'default_useful_life_months' => ['required', 'integer', 'min:1'],
        ]);
    }
}
