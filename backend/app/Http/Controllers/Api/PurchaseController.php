<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Services\AkuntaPostingService;
use App\Services\ImagePipeline;
use App\Services\SettingsService;
use App\Support\AssetAudit;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PurchaseController extends Controller
{
    public function __construct(
        private readonly SettingsService $settings,
        private readonly ImagePipeline $pipeline,
        private readonly AkuntaPostingService $posting,
    ) {}

    public function show(Asset $asset): JsonResponse
    {
        return response()->json(Present::purchase($asset->purchase));
    }

    public function upsert(Request $request, Asset $asset): JsonResponse
    {
        $data = $request->validate([
            'vendor' => ['nullable', 'string', 'max:255'],
            'invoice_no' => ['nullable', 'string', 'max:255'],
            'purchase_date' => ['nullable', 'date'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'proof' => ['nullable', 'file', 'max:15360', 'mimetypes:image/jpeg,image/png,image/webp,application/pdf'],
        ]);

        $purchase = $asset->purchase()->firstOrNew([]);
        if (! $purchase->exists) {
            $purchase->id = (string) Str::ulid();
            $purchase->asset_id = $asset->id;
        }

        $purchase->fill([
            'vendor' => $data['vendor'] ?? $purchase->vendor,
            'invoice_no' => $data['invoice_no'] ?? $purchase->invoice_no,
            'purchase_date' => $data['purchase_date'] ?? $purchase->purchase_date,
            'amount' => $data['amount'] ?? $purchase->amount ?? 0,
            'notes' => $data['notes'] ?? $purchase->notes,
        ]);

        if ($request->hasFile('proof')) {
            // Remove the previous proof derivatives, if any.
            if ($purchase->proof_path) {
                Storage::disk((string) $purchase->proof_disk)
                    ->delete(array_values(array_filter([$purchase->proof_path, $purchase->proof_thumb_path])));
            }

            $file = $request->file('proof');
            $disk = $this->settings->storageDisk();

            if ($this->pipeline->isImage($file)) {
                $meta = $this->pipeline->store($file, $disk, "assets/{$asset->id}/purchase");
                $purchase->proof_disk = $disk;
                $purchase->proof_path = $meta['path'];
                $purchase->proof_thumb_path = $meta['thumb_path'];
                $purchase->proof_type = 'image';
            } else {
                // PDF (or other allowed non-image) — stored as-is, no thumbnail.
                $path = $file->store("assets/{$asset->id}/purchase", $disk);
                $purchase->proof_disk = $disk;
                $purchase->proof_path = $path;
                $purchase->proof_thumb_path = null;
                $purchase->proof_type = 'pdf';
            }
        }

        $purchase->save();
        AssetAudit::log($asset->id, 'purchase', 'Data pembelian diperbarui.');

        // Acquisition journal (B) is emitted when purchase data is entered. The
        // idempotency key is per-asset, so editing the purchase re-sends the
        // same key and Akunta never double-posts.
        $this->posting->postAcquisition($asset->refresh());

        return response()->json(Present::purchase($purchase->refresh()));
    }
}
