<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Purchase data for an asset (one record per asset, upserted), including an
 * optional proof document. Image proofs are stored as processed derivatives
 * (web + thumbnail); PDF proofs are stored as-is.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_purchases', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('asset_id')->unique()->constrained('assets')->cascadeOnDelete();
            $table->string('vendor')->nullable();
            $table->string('invoice_no')->nullable();
            $table->date('purchase_date')->nullable();
            $table->decimal('amount', 18, 2)->default(0);
            $table->text('notes')->nullable();
            $table->string('proof_disk', 32)->nullable();
            $table->string('proof_path')->nullable();
            $table->string('proof_thumb_path')->nullable();
            $table->string('proof_type', 16)->nullable(); // image | pdf
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_purchases');
    }
};
