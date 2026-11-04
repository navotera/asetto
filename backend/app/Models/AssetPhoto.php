<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class AssetPhoto extends Model
{
    use HasUlids;

    protected $table = 'asset_photos';

    protected $guarded = [];

    protected $casts = [
        'taken_at' => 'datetime',
        'width' => 'integer',
        'height' => 'integer',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class, 'asset_id');
    }

    public function url(): ?string
    {
        return $this->path ? Storage::disk($this->disk)->url($this->path) : null;
    }

    public function thumbUrl(): ?string
    {
        return $this->thumb_path ? Storage::disk($this->disk)->url($this->thumb_path) : $this->url();
    }
}
