<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AssetCategory;
use App\Support\Present;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = AssetCategory::query()->orderBy('code')->get()
            ->map(fn (AssetCategory $c) => Present::category($c));

        return response()->json($categories);
    }
}
