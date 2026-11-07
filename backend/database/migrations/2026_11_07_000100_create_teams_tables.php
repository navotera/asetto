<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Teams: per-entity groups of users. A team can later be an asset's responsible
 * party (replacing the department-type custodian). Membership is a user↔team
 * pivot; both are scoped by the team's entity.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teams', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('entity_id')->constrained('entities')->cascadeOnDelete();
            $table->string('name');
            $table->timestamps();
            $table->index('entity_id');
        });

        Schema::create('team_user', function (Blueprint $table) {
            $table->foreignUlid('team_id')->constrained('teams')->cascadeOnDelete();
            $table->ulid('user_id');
            $table->timestamps();
            $table->primary(['team_id', 'user_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_user');
        Schema::dropIfExists('teams');
    }
};
