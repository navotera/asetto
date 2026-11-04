<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetPhoto;
use App\Services\ImagePipeline;
use App\Services\SettingsService;
use App\Support\AssetAudit;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PhotoController extends Controller
{
    public function __construct(
        private readonly SettingsService $settings,
        private readonly ImagePipeline $pipeline,
    ) {}

    public function index(Asset $asset): JsonResponse
    {
        return response()->json(
            $asset->photos()->get()->map(fn (AssetPhoto $p) => Present::photo($p))
        );
    }

    public function store(Request $request, Asset $asset): JsonResponse
    {
        $data = $request->validate([
            'photo' => ['required', 'file', 'image', 'max:15360'], // 15 MB
            'caption' => ['nullable', 'string', 'max:255'],
            'taken_at' => ['nullable', 'date'],
        ]);

        $disk = $this->settings->storageDisk();
        $meta = $this->pipeline->store($request->file('photo'), $disk, "assets/{$asset->id}/photos");

        $photo = $asset->photos()->create([
            'id' => (string) Str::ulid(),
            'disk' => $meta['disk'],
            'path' => $meta['path'],
            'thumb_path' => $meta['thumb_path'],
            'width' => $meta['width'],
            'height' => $meta['height'],
            'caption' => $data['caption'] ?? null,
            'taken_at' => $data['taken_at'] ?? now(),
            'uploaded_by' => Auth::id(),
        ]);
        $caption = $data['caption'] ?? null;
        AssetAudit::log($asset->id, 'photo_added', $caption ? "Foto ditambahkan: {$caption}" : 'Foto ditambahkan.');

        return response()->json(Present::photo($photo), 201);
    }

    public function destroy(AssetPhoto $photo): JsonResponse
    {
        Storage::disk($photo->disk)->delete(array_values(array_filter([$photo->path, $photo->thumb_path])));
        $assetId = $photo->asset_id;
        $photo->delete();
        AssetAudit::log($assetId, 'photo_removed', 'Foto dihapus.');

        return response()->json(['ok' => true]);
    }
}
