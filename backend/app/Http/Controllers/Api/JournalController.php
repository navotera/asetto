<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JournalOutbox;
use App\Services\AkuntaPostingService;
use App\Support\Present;
use Illuminate\Http\JsonResponse;

/** The Akunta journal outbox — what Asetto has pushed (or queued) to the ledger. */
class JournalController extends Controller
{
    public function __construct(private readonly AkuntaPostingService $posting) {}

    public function index(): JsonResponse
    {
        $journals = JournalOutbox::query()->latest('created_at')->get()
            ->map(fn (JournalOutbox $j) => Present::journal($j));

        return response()->json($journals);
    }

    public function show(JournalOutbox $journal): JsonResponse
    {
        return response()->json(Present::journal($journal));
    }

    public function retry(JournalOutbox $journal): JsonResponse
    {
        if ($journal->status !== 'accepted') {
            $this->posting->push($journal);
        }

        return response()->json(Present::journal($journal->refresh()));
    }

    /** Move an unsuccessful queue item to Trashed (pruned by cron per retention). */
    public function trash(JournalOutbox $journal): JsonResponse
    {
        if ($journal->status !== 'accepted') {
            $journal->forceFill(['status' => 'trashed'])->save();
        }

        return response()->json(Present::journal($journal->refresh()));
    }
}
