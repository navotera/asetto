<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Append-only activity log per asset, shown on the asset detail page. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_audit_logs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->string('action', 48);
            $table->text('description')->nullable();
            $table->ulid('actor_user_id')->nullable();
            $table->string('actor_name')->nullable();
            $table->timestamp('created_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_audit_logs');
    }
};
