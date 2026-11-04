<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * History of custody delegation (pelimpahan tanggung jawab). Each reassignment
 * records who held the asset before/after, where, and the asset's condition at
 * the moment of handover.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('custody_handovers', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->ulid('from_custodian_id')->nullable();
            $table->ulid('to_custodian_id')->nullable();
            $table->string('from_location')->nullable();
            $table->string('to_location')->nullable();
            $table->string('condition_at_handover', 32)->nullable();
            $table->text('notes')->nullable();
            $table->ulid('handed_by_user_id')->nullable();
            $table->timestamp('handed_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('custody_handovers');
    }
};
