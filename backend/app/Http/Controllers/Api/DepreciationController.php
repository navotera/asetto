<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DepreciationLine;
use App\Models\DepreciationRun;
use App\Services\AkuntaPostingService;
use App\Services\DepreciationEngine;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DepreciationController extends Controller
{
    public function __construct(
        private readonly DepreciationEngine $engine,
        private readonly AkuntaPostingService $posting,
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
        ]);
        $period = $data['period'];

        if (DepreciationRun::query()->where('period', $period)->where('status', 'posted')->exists()) {
            return response()->json(['message' => "Periode {$period} sudah pernah diposting."], 422);
        }

        $rows = $this->engine->buildLines($period);
        if ($rows === []) {
            return response()->json(['message' => "Tidak ada aset yang perlu didepresiasi untuk {$period}."], 422);
        }

        $run = DB::transaction(function () use ($period, $rows): DepreciationRun {
            $total = 0.0;
            $run = DepreciationRun::query()->create([
                'period' => $period,
                'status' => 'posted',
                'total_amount' => 0,
                'posted_at' => now(),
            ]);

            foreach ($rows as $row) {
                $asset = $row['asset'];
                DepreciationLine::query()->create([
                    'run_id' => $run->id,
                    'asset_id' => $asset->id,
                    'amount' => $row['amount'],
                    'book_value_before' => $row['book_value_before'],
                    'book_value_after' => $row['book_value_after'],
                ]);
                $asset->accumulated_depreciation = (float) $asset->accumulated_depreciation + $row['amount'];
                $asset->last_depreciated_period = $period;
                $asset->save();
                $total += $row['amount'];
            }

            $run->total_amount = $total;
            $run->save();

            return $run;
        });

        // Push the balanced journal to Akunta (outbox-first, idempotent).
        $journal = $this->posting->postDepreciationRun($run->load('lines'));
        $run->forceFill(['journal_id' => $journal->id])->save();

        return response()->json(Present::run($run->refresh()), 201);
    }
}
