<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Monthly depreciation runs and their per-asset lines. Posting a run produces a
 * balanced journal to Akunta (Dr depreciation expense / Cr accumulated
 * depreciation, per category) and advances each asset's accumulated total.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('depreciation_runs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('period', 7)->index(); // YYYY-MM
            $table->string('status', 16)->default('draft'); // draft | posted
            $table->decimal('total_amount', 18, 2)->default(0);
            $table->ulid('journal_id')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('depreciation_lines', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('run_id')->constrained('depreciation_runs')->cascadeOnDelete();
            $table->ulid('asset_id')->index();
            $table->decimal('amount', 18, 2)->default(0);
            $table->decimal('book_value_before', 18, 2)->default(0);
            $table->decimal('book_value_after', 18, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('depreciation_lines');
        Schema::dropIfExists('depreciation_runs');
    }
};
