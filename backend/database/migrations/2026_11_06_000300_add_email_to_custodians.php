<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Email on person-custodians, used to auto-link them to the matching Ecopa user
 * (so that user sees "Aset Saya" without a manual link step).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('custodians', function (Blueprint $table) {
            $table->string('email')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('custodians', function (Blueprint $table) {
            $table->dropColumn('email');
        });
    }
};
