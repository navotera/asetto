<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Asset responsible party = a user OR a team (replaces custodian). Exactly one of
 * responsible_user_id / responsible_team_id is set (or none = unassigned). Custody
 * handovers also record the responsible before/after. custodian_* columns stay for
 * now; the dept→team data migration + custodian removal happens in a later phase.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->ulid('responsible_user_id')->nullable()->index()->after('custodian_id');
            $table->ulid('responsible_team_id')->nullable()->index()->after('responsible_user_id');
        });

        Schema::table('custody_handovers', function (Blueprint $table) {
            $table->ulid('from_user_id')->nullable()->after('to_custodian_id');
            $table->ulid('to_user_id')->nullable()->after('from_user_id');
            $table->ulid('from_team_id')->nullable()->after('to_user_id');
            $table->ulid('to_team_id')->nullable()->after('from_team_id');
        });

        // Safe backfill: person-custodian linked to a user → responsible_user_id.
        // Department / unlinked custodians are left null (handled in the dept→team phase).
        DB::statement(
            'UPDATE assets SET responsible_user_id = ('
            ."SELECT c.user_id FROM custodians c WHERE c.id = assets.custodian_id AND c.type = 'person' AND c.user_id IS NOT NULL"
            .') WHERE custodian_id IS NOT NULL'
        );
    }

    public function down(): void
    {
        Schema::table('custody_handovers', function (Blueprint $table) {
            $table->dropColumn(['from_user_id', 'to_user_id', 'from_team_id', 'to_team_id']);
        });
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn(['responsible_user_id', 'responsible_team_id']);
        });
    }
};
