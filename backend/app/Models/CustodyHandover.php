<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustodyHandover extends Model
{
    use HasUlids;

    protected $table = 'custody_handovers';

    protected $guarded = [];

    protected $casts = [
        'handed_at' => 'datetime',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class, 'asset_id');
    }

    public function fromCustodian(): BelongsTo
    {
        return $this->belongsTo(Custodian::class, 'from_custodian_id');
    }

    public function toCustodian(): BelongsTo
    {
        return $this->belongsTo(Custodian::class, 'to_custodian_id');
    }
}
