<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Company assets. book_value is derived (acquisition_cost minus
 * accumulated_depreciation) and never stored. entity_id scopes an asset to an
 * Ecopa-synced entity (nullable until multi-entity scoping is wired).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('entity_id')->nullable()->index();
            $table->string('code')->unique();
            $table->string('name');
            $table->ulid('category_id')->index();
            $table->date('acquisition_date');
            $table->decimal('acquisition_cost', 18, 2)->default(0);
            $table->decimal('salvage_value', 18, 2)->default(0);
            $table->unsignedInteger('useful_life_months')->default(60);
            $table->string('method', 32)->default('straight_line');
            $table->string('condition', 32)->default('good');
            $table->ulid('custodian_id')->nullable()->index();
            $table->string('location')->default('');
            $table->string('serial_number')->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 16)->default('active'); // active | disposed
            $table->decimal('accumulated_depreciation', 18, 2)->default(0);
            $table->string('last_depreciated_period', 7)->nullable(); // YYYY-MM
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assets');
    }
};
