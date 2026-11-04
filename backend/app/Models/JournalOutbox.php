<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;

/**
 * Durable record of every business event Asetto emits to Akunta's Auto Mapping
 * ingest endpoint. `idempotency_key` is unique so a retry after a transient
 * failure never double-posts. `payload` holds the raw business JSON (no account
 * codes — the Akunta admin maps fields → accounts once per `source_type`).
 */
class JournalOutbox extends Model
{
    use HasUlids;

    protected $table = 'journal_outbox';

    protected $guarded = [];

    protected $casts = [
        'date' => 'date:Y-m-d',
        'payload' => 'array',
        'posted_at' => 'datetime',
    ];
}
