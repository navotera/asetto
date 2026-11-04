<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DepreciationRun extends Model
{
    use HasUlids;

    protected $table = 'depreciation_runs';

    protected $guarded = [];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'posted_at' => 'datetime',
    ];

    public function lines(): HasMany
    {
        return $this->hasMany(DepreciationLine::class, 'run_id');
    }
}
