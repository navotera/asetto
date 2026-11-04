<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Exceptions\EcopaRegistrationException;
use App\Http\Controllers\Controller;
use App\Services\EcopaIntegrationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public first-access wizard. The SPA shows this before login when the
 * integration is not active yet. The browser submits only the Ecopa URL +
 * Registration Token; the token never comes back in any response.
 */
class EcopaRegistrationController extends Controller
{
    public function __construct(private readonly EcopaIntegrationService $integration) {}

    public function status(): JsonResponse
    {
        return response()->json(['data' => $this->publicStatus()]);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ecopa_url' => ['required', 'string', 'max:255'],
            'registration_token' => ['required', 'string', 'max:255'],
        ]);

        try {
            $this->integration->requestIntegratedRegistration($data);
        } catch (EcopaRegistrationException $e) {
            return response()->json([
                'errors' => [['code' => 'registration_failed', 'message' => $e->getMessage()]],
            ], $e->status());
        }

        return response()->json(['data' => $this->publicStatus()], 202);
    }

    public function cancel(): JsonResponse
    {
        $this->integration->cancelPendingRegistration();

        return response()->json(['data' => $this->publicStatus()]);
    }

    /**
     * Status without any secret-bearing fields.
     *
     * @return array<string, mixed>
     */
    private function publicStatus(): array
    {
        $status = $this->integration->status();

        return [
            'configured' => $status['configured'],
            'integration_status' => $status['integration_status'],
            'registration_status' => $status['registration_status'],
            'registration_message' => $status['registration_message'],
            'name' => $status['name'],
            'slug' => $status['slug'],
            'ecopa_url' => $status['ecopa_url'],
            'webhook_url' => $status['webhook_url'],
            'sso_ready' => $status['sso_ready'],
            'webhook_ready' => $status['webhook_ready'],
        ];
    }
}
