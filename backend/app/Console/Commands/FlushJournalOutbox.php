<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\JournalOutbox;
use App\Services\AkuntaPostingService;
use Illuminate\Console\Command;

/**
 * Retries delivering every queued/failed journal to Akunta. This is the queue
 * that makes Asetto resilient to Akunta being offline: anything not yet posted
 * is re-sent on the next scheduled tick, using its stable idempotency key so a
 * retry never double-posts.
 */
class FlushJournalOutbox extends Command
{
    protected $signature = 'asetto:flush-outbox';

    protected $description = 'Retry delivering queued/failed journals to Akunta (idempotent).';

    public function handle(AkuntaPostingService $posting): int
    {
        $pending = JournalOutbox::query()->whereIn('status', ['queued', 'failed'])->get();

        $sent = 0;
        foreach ($pending as $outbox) {
            $posting->push($outbox);
            if ($outbox->refresh()->status === 'accepted') {
                $sent++;
            }
        }

        $this->info("Outbox flush: {$pending->count()} diproses, {$sent} terkirim ke Akunta.");

        return self::SUCCESS;
    }
}
