<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Disposal extends Model
{
    use HasUlids;

    protected $table = 'disposals';

    protected $guarded = [];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'proceeds' => 'decimal:2',
        'book_value_at_disposal' => 'decimal:2',
        'gain_loss' => 'decimal:2',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class, 'asset_id');
    }
}
