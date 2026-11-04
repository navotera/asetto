<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class AssetPurchase extends Model
{
    use HasUlids;

    protected $table = 'asset_purchases';

    protected $guarded = [];

    protected $casts = [
        'purchase_date' => 'date:Y-m-d',
        'amount' => 'decimal:2',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class, 'asset_id');
    }

    public function proofUrl(): ?string
    {
        return $this->proof_path ? Storage::disk($this->proof_disk)->url($this->proof_path) : null;
    }

    public function proofThumbUrl(): ?string
    {
        if ($this->proof_thumb_path) {
            return Storage::disk($this->proof_disk)->url($this->proof_thumb_path);
        }

        return $this->proof_type === 'image' ? $this->proofUrl() : null;
    }
}
