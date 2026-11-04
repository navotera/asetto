<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\Disposal;
use App\Services\AkuntaPostingService;
use App\Support\AssetAudit;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DisposalController extends Controller
{
    public function __construct(private readonly AkuntaPostingService $posting) {}

    public function index(): JsonResponse
    {
        $disposals = Disposal::query()->latest('created_at')->get()
            ->map(fn (Disposal $d) => Present::disposal($d));

        return response()->json($disposals);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asset_id' => ['required', 'string', 'exists:assets,id'],
            'date' => ['required', 'date'],
            'type' => ['required', Rule::in(['sale', 'writeoff'])],
            'proceeds' => ['nullable', 'numeric', 'min:0'],
        ]);

        $asset = Asset::query()->findOrFail($data['asset_id']);
        if ($asset->status === 'disposed') {
            return response()->json(['message' => 'Aset sudah dilepas.'], 422);
        }

        $bookValue = max(0.0, (float) $asset->acquisition_cost - (float) $asset->accumulated_depreciation);
        $proceeds = $data['type'] === 'writeoff' ? 0.0 : (float) ($data['proceeds'] ?? 0);
        $gainLoss = $proceeds - $bookValue;

        $disposal = DB::transaction(function () use ($asset, $data, $bookValue, $proceeds, $gainLoss): Disposal {
            $disposal = Disposal::query()->create([
                'asset_id' => $asset->id,
                'date' => $data['date'],
                'type' => $data['type'],
                'proceeds' => $proceeds,
                'book_value_at_disposal' => $bookValue,
                'gain_loss' => $gainLoss,
                'status' => 'posted',
            ]);

            $asset->status = 'disposed';
            $asset->condition = 'idle';
            $asset->save();

            return $disposal;
        });

        $journal = $this->posting->postDisposal($disposal, $asset);
        $disposal->forceFill(['journal_id' => $journal?->id])->save();
        AssetAudit::log($asset->id, 'disposed', $data['type'] === 'sale' ? 'Aset dijual (pelepasan).' : 'Aset dihapuskan (write-off).');

        return response()->json(Present::disposal($disposal->refresh()), 201);
    }
}
