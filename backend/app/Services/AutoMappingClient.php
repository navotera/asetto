<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Posts a business event to Akunta's Auto Mapping ingest endpoint. Asetto sends
 * raw JSON (no account codes); the Akunta admin maps fields→accounts once per
 * source_type. Returns {raw_id, status} (202, async). Uses the Http facade so
 * tests can Http::fake() it.
 *
 * Entity targeting uses `source_entity_id`: Asetto sends its OWN entity id, and
 * the Akunta admin maps (this app, source_entity_id) → an Akunta entity once via
 * AutoMappingEntityLink. Asetto never needs Akunta's internal entity ULIDs.
 * `idempotency_key` is required on this path. See akunta/docs/auto-mapping.md.
 */
class AutoMappingClient
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function ingest(string $sourceEntityId, string $sourceType, array $payload, string $idempotencyKey): array
    {
        $base = rtrim((string) config('akunta-api-client.auto_journal.base_url'), '/');
        $token = (string) config('akunta-api-client.auto_journal.token');
        $source = (string) (config('asetto.events_source_url') ?: config('app.url'));
        $timeout = (float) config('akunta-api-client.auto_journal.timeout_seconds', 10.0);

        // No per-request retry: resilience is the outbox + asetto:flush-outbox
        // cron loop, which re-sends with the same idempotency key across ticks.
        // Send exactly `source_entity_id` (never also `entity_id`, or ingest 422s).
        $response = Http::withToken($token)
            ->acceptJson()
            ->asJson()
            ->timeout($timeout)
            ->post($base.'/api/v1/auto-mapping/ingest', [
                'source_entity_id' => $sourceEntityId,
                'source_type' => $sourceType,
                'source' => $source,
                'payload' => $payload,
                'idempotency_key' => $idempotencyKey,
            ]);

        if (! $response->successful()) {
            // Carry the HTTP status as the exception code so the outbox can tell
            // a permanent rejection (4xx) from a transient failure (5xx/network).
            throw new RuntimeException(
                'Auto-mapping ingest gagal ('.$response->status().'): '.$response->body(),
                $response->status(),
            );
        }

        return $response->json() ?? [];
    }
}
