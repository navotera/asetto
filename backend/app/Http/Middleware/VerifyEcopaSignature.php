<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\EcopaIntegrationService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Verifies X-Ecopa-Signature against HMAC-SHA256 of the raw request body.
 *
 * Lifecycle events use the permanent webhook secret; registration
 * approval/rejection uses the encrypted one-time Registration Token as a
 * bootstrap trust anchor. Rejects with 401 when missing/mismatched and 503
 * when no verification secret is configured yet.
 */
class VerifyEcopaSignature
{
    public function __construct(private readonly EcopaIntegrationService $integration) {}

    public function handle(Request $request, Closure $next): Response
    {
        $payload = json_decode($request->getContent(), true);
        $event = is_array($payload) && is_string($payload['event'] ?? null)
            ? $payload['event']
            : null;

        $secret = $this->integration->signatureSecretForEvent($event);
        if (! $secret) {
            abort(503, 'Ecopa webhook verification secret not configured');
        }

        $sigHeader = (string) $request->header('X-Ecopa-Signature', '');
        if (! str_starts_with($sigHeader, 'sha256=')) {
            abort(401, 'Missing or malformed X-Ecopa-Signature');
        }

        $providedHash = substr($sigHeader, 7);
        $computedHash = hash_hmac('sha256', $request->getContent(), $secret);

        if (! hash_equals($computedHash, $providedHash)) {
            abort(401, 'Invalid signature');
        }

        return $next($request);
    }
}
