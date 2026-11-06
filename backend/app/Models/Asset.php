<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A company asset. `book_value` is always derived (acquisition_cost minus
 * accumulated_depreciation) and is appended to array/JSON output so the SPA
 * never has to recompute it.
 */
class Asset extends Model
{
    use HasUlids;
    use SoftDeletes;

    protected $table = 'assets';

    protected $guarded = [];

    protected $appends = ['book_value'];

    protected $casts = [
        'acquisition_date' => 'date:Y-m-d',
        'acquisition_cost' => 'decimal:2',
        'salvage_value' => 'decimal:2',
        'useful_life_months' => 'integer',
        'accumulated_depreciation' => 'decimal:2',
        'sync_akunta' => 'boolean',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(AssetCategory::class, 'category_id');
    }

    public function custodian(): BelongsTo
    {
        return $this->belongsTo(Custodian::class, 'custodian_id');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(AssetPhoto::class, 'asset_id')->latest('created_at');
    }

    public function custodyHandovers(): HasMany
    {
        return $this->hasMany(CustodyHandover::class, 'asset_id')->latest('handed_at');
    }

    public function purchase(): HasOne
    {
        return $this->hasOne(AssetPurchase::class, 'asset_id');
    }

    public function depreciationLines(): HasMany
    {
        return $this->hasMany(DepreciationLine::class, 'asset_id');
    }

    public function getBookValueAttribute(): string
    {
        return number_format(
            max(0, (float) $this->acquisition_cost - (float) $this->accumulated_depreciation),
            2,
            '.',
            '',
        );
    }

    /** Remaining depreciable base above salvage value, before this period. */
    public function depreciableRemaining(): float
    {
        $depreciableBase = (float) $this->acquisition_cost - (float) $this->salvage_value;

        return max(0, $depreciableBase - (float) $this->accumulated_depreciation);
    }
}
