<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DepreciationRun;
use App\Services\DepreciationEngine;
use App\Services\DepreciationService;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DepreciationController extends Controller
{
    public function __construct(
        private readonly DepreciationEngine $engine,
        private readonly DepreciationService $depreciation,
    ) {}

    public function pending(): JsonResponse
    {
        return response()->json(['period' => $this->engine->pendingPeriod()]);
    }

    /**
     * Depreciation report grouped by category over a date range (default: this
     * month). `total_amount` is the depreciation expense WITHIN the range (not
     * accumulated); `book_value` is the current remaining value (nilai sisa) of
     * the distinct assets depreciated in the range.
     */
    public function report(Request $request): JsonResponse
    {
        [$fromMonth, $toMonth, $from, $to] = $this->range($request);

        $lines = DB::table('depreciation_lines')
            ->join('depreciation_runs', 'depreciation_lines.run_id', '=', 'depreciation_runs.id')
            ->join('assets', 'depreciation_lines.asset_id', '=', 'assets.id')
            ->leftJoin('asset_categories', 'assets.category_id', '=', 'asset_categories.id')
            ->where('depreciation_runs.status', 'posted')
            ->whereBetween('depreciation_runs.period', [$fromMonth, $toMonth])
            ->selectRaw('depreciation_lines.amount as amount, depreciation_lines.asset_id as asset_id, assets.category_id as category_id, asset_categories.code as category_code, asset_categories.name as category_name, assets.acquisition_cost as acquisition_cost, assets.accumulated_depreciation as accumulated_depreciation')
            ->get();

        $groups = [];
        foreach ($lines as $l) {
            $key = (string) ($l->category_id ?? 'none');
            $groups[$key] ??= [
                'category_id' => $l->category_id,
                'category_code' => $l->category_code,
                'category_name' => $l->category_name ?? 'Tanpa kategori',
                'assets' => [],
                'total_amount' => 0.0,
                'acquisition_cost' => 0.0,
                'accumulated' => 0.0,
                'book_value' => 0.0,
            ];
            $groups[$key]['total_amount'] += (float) $l->amount;
            if (! isset($groups[$key]['assets'][$l->asset_id])) {
                $groups[$key]['assets'][$l->asset_id] = true;
                $groups[$key]['acquisition_cost'] += (float) $l->acquisition_cost;
                $groups[$key]['accumulated'] += (float) $l->accumulated_depreciation;
                $groups[$key]['book_value'] += max(0.0, (float) $l->acquisition_cost - (float) $l->accumulated_depreciation);
            }
        }

        $categories = collect($groups)
            ->map(fn (array $g): array => [
                'category_id' => $g['category_id'],
                'category_code' => $g['category_code'],
                'category_name' => $g['category_name'],
                'asset_count' => count($g['assets']),
                'acquisition_cost' => round($g['acquisition_cost'], 2),
                'accumulated' => round($g['accumulated'], 2),
                'total_amount' => round($g['total_amount'], 2),
                'book_value' => round($g['book_value'], 2),
            ])
            ->sortByDesc('total_amount')
            ->values();

        return response()->json([
            'from' => $from,
            'to' => $to,
            'total_acquisition_cost' => round((float) $categories->sum('acquisition_cost'), 2),
            'total_accumulated' => round((float) $categories->sum('accumulated'), 2),
            'total_amount' => round((float) $categories->sum('total_amount'), 2),
            'total_book_value' => round((float) $categories->sum('book_value'), 2),
            'categories' => $categories,
        ]);
    }

    /** Per-asset depreciation within one category over the range (lazy, on expand). */
    public function reportCategory(Request $request, string $category): JsonResponse
    {
        [$fromMonth, $toMonth] = $this->range($request);

        $rows = DB::table('depreciation_lines')
            ->join('depreciation_runs', 'depreciation_lines.run_id', '=', 'depreciation_runs.id')
            ->join('assets', 'depreciation_lines.asset_id', '=', 'assets.id')
            ->where('depreciation_runs.status', 'posted')
            ->whereBetween('depreciation_runs.period', [$fromMonth, $toMonth])
            ->where('assets.category_id', $category)
            ->groupBy('assets.id', 'assets.code', 'assets.name', 'assets.acquisition_cost', 'assets.accumulated_depreciation')
            ->selectRaw('assets.id as asset_id, assets.code as asset_code, assets.name as asset_name, assets.acquisition_cost as acquisition_cost, assets.accumulated_depreciation as accumulated_depreciation, COUNT(*) as periods, SUM(depreciation_lines.amount) as total_amount')
            ->orderBy('assets.code')
            ->get();

        return response()->json($rows->map(fn ($r): array => [
            'asset_id' => $r->asset_id,
            'asset_code' => $r->asset_code,
            'asset_name' => $r->asset_name,
            'periods' => (int) $r->periods,
            'acquisition_cost' => round((float) $r->acquisition_cost, 2),
            'accumulated' => round((float) $r->accumulated_depreciation, 2),
            'total_amount' => round((float) $r->total_amount, 2),
            'book_value' => round(max(0.0, (float) $r->acquisition_cost - (float) $r->accumulated_depreciation), 2),
        ])->values());
    }

    /**
     * Resolve the from/to range; defaults to the current month.
     *
     * @return array{0: string, 1: string, 2: string, 3: string} [fromMonth, toMonth, fromDate, toDate]
     */
    private function range(Request $request): array
    {
        $from = $request->query('from') ? Carbon::parse((string) $request->query('from')) : now()->startOfMonth();
        $to = $request->query('to') ? Carbon::parse((string) $request->query('to')) : now()->endOfMonth();
        if ($to->lt($from)) {
            [$from, $to] = [$to, $from];
        }

        return [$from->format('Y-m'), $to->format('Y-m'), $from->format('Y-m-d'), $to->format('Y-m-d')];
    }

    public function preview(Request $request): JsonResponse
    {
        $period = (string) ($request->query('period') ?: $this->engine->pendingPeriod() ?: '');

        $lines = [];
        $total = 0.0;
        foreach ($this->engine->buildLines($period) as $row) {
            $asset = $row['asset'];
            $total += $row['amount'];
            $lines[] = [
                'asset_id' => $asset->id,
                'asset_code' => $asset->code,
                'asset_name' => $asset->name,
                'category_name' => $asset->category?->name,
                'amount' => (float) $row['amount'],
                'book_value_before' => (float) $row['book_value_before'],
                'book_value_after' => (float) $row['book_value_after'],
            ];
        }

        return response()->json(['period' => $period, 'lines' => $lines, 'total_amount' => $total]);
    }

    public function index(): JsonResponse
    {
        $runs = DepreciationRun::query()->latest('created_at')->get()
            ->map(fn (DepreciationRun $r) => Present::run($r));

        return response()->json($runs);
    }

    public function show(DepreciationRun $run): JsonResponse
    {
        return response()->json(Present::run($run));
    }

    public function post(Request $request): JsonResponse
    {
        $data = $request->validate([
            'period' => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'commit' => ['sometimes', 'boolean'],
        ]);
        $period = $data['period'];
        $commit = $data['commit'] ?? true;

        if ($this->depreciation->alreadyPosted($period)) {
            return response()->json(['message' => "Periode {$period} sudah pernah diposting."], 422);
        }

        $run = $this->depreciation->runForPeriod($period, $commit);
        if (! $run) {
            return response()->json(['message' => "Tidak ada aset yang perlu didepresiasi untuk {$period}."], 422);
        }

        return response()->json(Present::run($run->refresh()), 201);
    }

    /** Approve + post a previously created draft run. */
    public function commit(DepreciationRun $run): JsonResponse
    {
        if ($run->status === 'posted') {
            return response()->json(['message' => 'Run sudah diposting.'], 422);
        }

        $run = $this->depreciation->commitRun($run);

        return response()->json(Present::run($run->refresh()));
    }
}
