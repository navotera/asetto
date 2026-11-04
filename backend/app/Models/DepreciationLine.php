<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DepreciationLine extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $table = 'depreciation_lines';

    protected $guarded = [];

    protected $casts = [
        'amount' => 'decimal:2',
        'book_value_before' => 'decimal:2',
        'book_value_after' => 'decimal:2',
    ];

    public function run(): BelongsTo
    {
        return $this->belongsTo(DepreciationRun::class, 'run_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class, 'asset_id');
    }
}
