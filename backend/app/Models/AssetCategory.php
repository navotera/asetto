<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class AssetCategory extends Model
{
    protected $table = 'asset_categories';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected $casts = [
        'default_useful_life_months' => 'integer',
    ];

    // ULID id for new rows, while still allowing arbitrary (seeded) string ids
    // so route-model binding works for `cat_*` seeds.
    protected static function booted(): void
    {
        static::creating(function (self $m) {
            if (empty($m->id)) {
                $m->id = (string) Str::ulid();
            }
        });
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class, 'category_id');
    }
}
