<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One receipt per successfully processed Ecopa webhook event_id. Guarantees
 * idempotency: a replayed event_id short-circuits to `already_processed`.
 */
class EcopaWebhookReceipt extends Model
{
    protected $table = 'ecopa_webhook_receipts';

    public $timestamps = false;

    protected $fillable = ['event_id', 'event', 'processed_at'];

    protected $casts = ['processed_at' => 'datetime'];
}
