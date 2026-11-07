<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Final custodian removal. Backfills asset responsibility from the remaining
 * custodian links (person → responsible user, department → a per-entity team),
 * then drops the custodian column/table. Uses raw queries so it does not depend
 * on the (now deleted) Custodian model.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('assets', 'custodian_id') && Schema::hasTable('custodians')) {
            $assets = DB::table('assets')
                ->whereNotNull('custodian_id')
                ->whereNull('responsible_user_id')
                ->whereNull('responsible_team_id')
                ->get(['id', 'entity_id', 'custodian_id']);

            $teamCache = []; // "entity|name" => team_id
            foreach ($assets as $a) {
                $c = DB::table('custodians')->where('id', $a->custodian_id)->first();
                if (! $c) {
                    continue;
                }
                if ($c->type === 'person' && $c->user_id) {
                    DB::table('assets')->where('id', $a->id)->update(['responsible_user_id' => $c->user_id]);
                } elseif ($c->type === 'entity' && $a->entity_id) {
                    $key = $a->entity_id.'|'.$c->name;
                    if (! isset($teamCache[$key])) {
                        $existing = DB::table('teams')->where('entity_id', $a->entity_id)->where('name', $c->name)->first();
                        if ($existing) {
                            $teamCache[$key] = $existing->id;
                        } else {
                            $tid = (string) Str::ulid();
                            DB::table('teams')->insert([
                                'id' => $tid, 'entity_id' => $a->entity_id, 'name' => $c->name,
                                'created_at' => now(), 'updated_at' => now(),
                            ]);
                            $teamCache[$key] = $tid;
                        }
                    }
                    DB::table('assets')->where('id', $a->id)->update(['responsible_team_id' => $teamCache[$key]]);
                }
            }
        }

        if (Schema::hasColumn('assets', 'custodian_id')) {
            Schema::table('assets', function (Blueprint $t) {
                $t->dropIndex('assets_custodian_id_index');
                $t->dropColumn('custodian_id');
            });
        }
        if (Schema::hasColumn('custody_handovers', 'from_custodian_id')) {
            Schema::table('custody_handovers', fn (Blueprint $t) => $t->dropColumn(['from_custodian_id', 'to_custodian_id']));
        }
        Schema::dropIfExists('custodians');
    }

    public function down(): void
    {
        // Best-effort restore of the structure (data is not recovered).
        Schema::create('custodians', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('type', 16)->default('person');
            $table->string('code')->unique();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('department')->nullable();
            $table->ulid('user_id')->nullable()->index();
            $table->timestamps();
        });
        Schema::table('assets', fn (Blueprint $t) => $t->ulid('custodian_id')->nullable()->index());
        Schema::table('custody_handovers', function (Blueprint $t) {
            $t->ulid('from_custodian_id')->nullable();
            $t->ulid('to_custodian_id')->nullable();
        });
    }
};
