<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reference data for the asset sub-ledger: categories (the `code` is the single
 * key the Akunta admin maps to GL accounts via Auto Mapping — Asetto itself
 * holds no account codes) and custodians (office entities or personnel that
 * responsibility for an asset can be delegated to).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_categories', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('default_method', 32)->default('straight_line');
            $table->unsignedInteger('default_useful_life_months')->default(60);
            $table->timestamps();
        });

        Schema::create('custodians', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('type', 16)->default('person'); // entity | person
            $table->string('code')->unique();
            $table->string('name');
            $table->string('department')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('custodians');
        Schema::dropIfExists('asset_categories');
    }
};
