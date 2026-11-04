<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * Durable record of every journal Asetto pushes to Akunta's general ledger via
 * akunta/api-client. `idempotency_key` is unique so a retry after a transient
 * failure never double-posts. `lines` holds the balanced Dr/Cr entries.
 */
class JournalOutbox extends Model
{
    use HasUlids;

    protected $table = 'journal_outbox';

    protected $guarded = [];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'lines' => 'array',
        'posted_at' => 'datetime',
    ];
}
