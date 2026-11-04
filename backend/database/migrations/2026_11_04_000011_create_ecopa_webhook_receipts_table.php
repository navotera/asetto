<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** One receipt per processed Ecopa event_id — the idempotency guard. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ecopa_webhook_receipts', function (Blueprint $table) {
            $table->id();
            $table->string('event_id', 120)->unique();
            $table->string('event', 80);
            $table->timestamp('processed_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ecopa_webhook_receipts');
    }
};
