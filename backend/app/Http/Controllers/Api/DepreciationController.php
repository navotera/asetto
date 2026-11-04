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
