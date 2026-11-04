<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;

/**
 * Processes an uploaded image into stored derivatives: a web-sized version and
 * a square thumbnail. The uploaded full-resolution original is NEVER stored —
 * only the re-encoded derivatives are written to the target disk. EXIF
 * orientation is applied and metadata stripped on re-encode.
 */
class ImagePipeline
{
    private ImageManager $manager;

    public function __construct()
    {
        $this->manager = new ImageManager(new Driver);
    }

    /**
     * @return array{disk:string, path:string, thumb_path:string, width:int, height:int}
     */
    public function store(
        UploadedFile $file,
        string $disk,
        string $dir,
        int $maxSide = 1600,
        int $thumbSide = 480,
    ): array {
        $base = trim($dir, '/').'/'.Str::ulid();
        $source = $file->getRealPath();

        // Web-sized version — fit within a box, never upscaling.
        $web = $this->manager->read($source)->orient()->scaleDown($maxSide, $maxSide);
        $path = $base.'.jpg';
        Storage::disk($disk)->put($path, (string) $web->toJpeg(quality: 82));

        // Square thumbnail (cropped to fill).
        $thumb = $this->manager->read($source)->orient()->cover($thumbSide, $thumbSide);
        $thumbPath = $base.'_thumb.jpg';
        Storage::disk($disk)->put($thumbPath, (string) $thumb->toJpeg(quality: 80));

        return [
            'disk' => $disk,
            'path' => $path,
            'thumb_path' => $thumbPath,
            'width' => $web->width(),
            'height' => $web->height(),
        ];
    }

    public function isImage(UploadedFile $file): bool
    {
        return str_starts_with((string) $file->getMimeType(), 'image/');
    }
}
