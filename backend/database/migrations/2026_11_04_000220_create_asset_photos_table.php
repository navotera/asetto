<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Asset photos. Only processed derivatives are stored: a web-sized version
 * (`path`) and a thumbnail (`thumb_path`). The uploaded full-resolution
 * original is never kept.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_photos', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->string('disk', 32)->default('public');
            $table->string('path');
            $table->string('thumb_path')->nullable();
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->string('caption')->nullable();
            $table->timestamp('taken_at')->nullable();
            $table->ulid('uploaded_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_photos');
    }
};
