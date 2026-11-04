<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Disposal;
use App\Models\JournalOutbox;
use App\Services\DepreciationEngine;
use App\Support\Present;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __construct(private readonly DepreciationEngine $engine) {}

    /** Shape: web/src/api/types.ts `DashboardSummary`. */
    public function show(): JsonResponse
    {
        $assets = Asset::query()->get();
        $active = $assets->where('status', 'active');
        $categoryNames = AssetCategory::query()->pluck('name', 'id');

        $conditionBreakdown = ['good' => 0, 'needs_repair' => 0, 'broken' => 0, 'idle' => 0];
        $bookByCategory = [];
        $totalCost = 0.0;
        $totalBook = 0.0;
        $totalAccum = 0.0;

        foreach ($active as $a) {
            $cost = (float) $a->acquisition_cost;
            $accum = (float) $a->accumulated_depreciation;
            $book = max(0.0, $cost - $accum);
            $totalCost += $cost;
            $totalBook += $book;
            $totalAccum += $accum;
            if (isset($conditionBreakdown[$a->condition])) {
                $conditionBreakdown[$a->condition]++;
            }
            $catName = $categoryNames[$a->category_id] ?? '—';
            $bookByCategory[$catName] = ($bookByCategory[$catName] ?? 0.0) + $book;
        }

        $thisYear = (int) now()->format('Y');
        $disposedThisYear = Disposal::query()
            ->whereYear('date', $thisYear)
            ->count();

        $recent = JournalOutbox::query()->latest('created_at')->limit(5)->get()
            ->map(fn (JournalOutbox $j) => Present::journal($j))->all();

        return response()->json([
            'asset_count' => $assets->count(),
            'active_count' => $active->count(),
            'total_acquisition_cost' => $totalCost,
            'total_book_value' => $totalBook,
            'total_accumulated_depreciation' => $totalAccum,
            'disposed_this_year' => $disposedThisYear,
            'condition_breakdown' => $conditionBreakdown,
            'pending_depreciation_period' => $this->engine->pendingPeriod(),
            'akunta_queued' => JournalOutbox::query()->where('status', '!=', 'posted')->count(),
            'recent_journals' => $recent,
            'book_value_by_category' => collect($bookByCategory)
                ->map(fn ($book, $category) => ['category' => $category, 'book_value' => $book])
                ->values()
                ->all(),
        ]);
    }
}
