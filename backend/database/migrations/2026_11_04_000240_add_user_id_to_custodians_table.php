<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Link a person-custodian to a shadow user so the User role can see the assets
 * delegated to them ("Aset Saya"). The canonical identity is the Ecopa user
 * UUID carried on users.main_tier_user_id; user_id references the local user row.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('custodians', function (Blueprint $table) {
            $table->ulid('user_id')->nullable()->index()->after('department');
        });
    }

    public function down(): void
    {
        Schema::table('custodians', function (Blueprint $table) {
            $table->dropColumn('user_id');
        });
    }
};
