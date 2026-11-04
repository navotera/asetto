<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

class AssetAuditLog extends Model
{
    use HasUlids;

    public $timestamps = false;

    protected $table = 'asset_audit_logs';

    protected $guarded = [];

    protected $casts = [
        'created_at' => 'datetime',
    ];
}
