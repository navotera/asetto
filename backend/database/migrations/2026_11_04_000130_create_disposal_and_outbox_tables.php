<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Asset disposals (sale/write-off) and the journal outbox.
 *
 * The outbox is the durable record of every journal Asetto pushes to Akunta
 * server-to-server via akunta/api-client. `idempotency_key` is unique so a
 * retry (e.g. after a network error) never double-posts in Akunta's ledger.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('disposals', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('asset_id')->index();
            $table->date('date');
            $table->string('type', 16)->default('sale'); // sale | writeoff
            $table->decimal('proceeds', 18, 2)->default(0);
            $table->decimal('book_value_at_disposal', 18, 2)->default(0);
            $table->decimal('gain_loss', 18, 2)->default(0); // positive = gain
            $table->ulid('journal_id')->nullable();
            $table->string('status', 16)->default('posted');
            $table->timestamps();
        });

        Schema::create('journal_outbox', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('idempotency_key')->unique();
            $table->string('source', 32);     // depreciation | disposal
            $table->string('source_ref');     // run id / disposal id
            $table->date('date');
            $table->text('memo');
            $table->string('status', 16)->default('queued'); // queued | posted | failed
            $table->string('akunta_journal_no')->nullable();
            $table->json('lines');
            $table->text('last_error')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_outbox');
        Schema::dropIfExists('disposals');
    }
};
