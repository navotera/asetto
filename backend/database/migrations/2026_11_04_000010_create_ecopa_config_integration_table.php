<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Key/value store for Ecopa integration state + encrypted SSO/webhook secrets. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ecopa_config_integration', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('value')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ecopa_config_integration');
    }
};
