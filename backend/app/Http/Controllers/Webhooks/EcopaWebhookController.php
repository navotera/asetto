<?php

declare(strict_types=1);

namespace App\Http\Controllers\Webhooks;

use Akunta\Rbac\Models\App as RbacApp;
use Akunta\Rbac\Models\Entity;
use Akunta\Rbac\Models\Tenant;
use App\Exceptions\EcopaRegistrationException;
use App\Http\Controllers\Controller;
use App\Models\EcopaWebhookReceipt;
use App\Models\User;
use App\Services\EcopaIntegrationService;
use App\Services\UserAccessRevoker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Single webhook endpoint for HMAC-verified, idempotent Ecopa events.
 *
 * Implements the six standard events from docs CHILD_APP_REGISTRATION_GUIDE.md:
 *   - app.registration.approved / rejected  (bootstrap-secret signed)
 *   - user.assigned / user.updated / user.revoked / user.deleted
 * (plus legacy user.disabled/enabled for compatibility).
 *
 * Idempotency: one receipt per event_id. Retryable/pending outcomes release
 * the receipt so Ecopa can safely retry with the same event_id.
 */
class EcopaWebhookController extends Controller
{
    public function __construct(
        private readonly UserAccessRevoker $accessRevoker,
        private readonly EcopaIntegrationService $integration,
    ) {}

    public function handle(Request $request): JsonResponse
    {
        $data = $request->validate([
            'event' => ['required', 'string', 'max:80'],
            'event_id' => ['required', 'string', 'max:120'],
            'subject' => ['sometimes', 'array'],
        ]);

        $event = $data['event'];
        $eventId = $data['event_id'];
        $subject = $data['subject'] ?? [];

        if (EcopaWebhookReceipt::query()->where('event_id', $eventId)->exists()) {
            return $this->alreadyProcessed($event, $eventId);
        }

        $result = DB::transaction(function () use ($event, $eventId, $subject): ?array {
            $reserved = EcopaWebhookReceipt::query()->insertOrIgnore([
                'event_id' => $eventId,
                'event' => $event,
                'processed_at' => now(),
            ]);
            if ($reserved === 0) {
                return ['duplicate' => true];
            }

            try {
                $result = match (true) {
                    $event === 'app.registration.approved' => $this->onRegistrationApproved($subject),
                    $event === 'app.registration.rejected' => $this->onRegistrationRejected($subject),
                    $event === 'user.assigned' => $this->onUserAssigned($subject),
                    $event === 'user.updated' => $this->onUserUpdated($subject),
                    $event === 'user.revoked' => $this->onUserRevoked($subject),
                    $event === 'user.deleted' => $this->onUserDisabled($subject),
                    $event === 'user.disabled' => $this->onUserDisabled($subject),
                    $event === 'user.enabled' => $this->onUserEnabled($subject),
                    str_starts_with($event, 'entity.') => $this->onEntity($event, $subject),
                    default => $this->rejected('unknown_event', "Event Ecopa [{$event}] tidak didukung."),
                };
            } catch (EcopaRegistrationException $exception) {
                $result = $this->rejected('invalid_registration_event', $exception->getMessage());
            }

            // Release the receipt so a retryable/rejected event can be re-sent.
            if (($result['retryable'] ?? false) === true || ($result['status'] ?? null) === 'rejected') {
                EcopaWebhookReceipt::query()->where('event_id', $eventId)->delete();
            }

            return $result;
        });

        if (($result['duplicate'] ?? false) === true) {
            return $this->alreadyProcessed($event, $eventId);
        }

        Log::info('Ecopa webhook processed', compact('event', 'eventId'));

        $httpStatus = match ($result['status'] ?? null) {
            'pending' => 409,
            'rejected' => 422,
            default => 200,
        };

        return response()->json(array_merge(
            ['status' => 'received', 'event' => $event, 'event_id' => $eventId],
            $result ?? [],
        ), $httpStatus);
    }

    private function onRegistrationApproved(array $subject): array
    {
        $status = $this->integration->activateFromApproval($subject);

        return [
            'status' => 'applied',
            'code' => 'registration_activated',
            'registration_status' => $status['registration_status'] ?? 'active',
        ];
    }

    private function onRegistrationRejected(array $subject): array
    {
        $this->integration->rejectRegistration($subject);

        return ['status' => 'applied', 'code' => 'registration_rejected'];
    }

    private function onUserAssigned(array $subject): array
    {
        $ecopaId = (string) ($subject['user_id'] ?? $subject['id'] ?? '');
        $email = (string) ($subject['email'] ?? '');

        if ($ecopaId === '' || $email === '') {
            return $this->rejected('missing_user_keys', 'user.assigned membutuhkan user_id dan email.');
        }

        $user = User::query()->where('main_tier_user_id', $ecopaId)->first()
            ?? User::query()->where('email', $email)->first()
            ?? new User;

        if (! $user->exists) {
            $user->id = (string) Str::ulid();
            $user->password_hash = null;
        }

        $user->forceFill([
            'main_tier_user_id' => $ecopaId,
            'email' => $email,
            'name' => $subject['name'] ?? Str::before($email, '@'),
            'email_verified_at' => $user->email_verified_at ?? now(),
            'disabled_at' => null,
        ])->save();

        $app = $this->selfApp();
        $entityId = ! empty($subject['entity_id']) ? (string) $subject['entity_id'] : null;

        $assignment = $user->assignments()
            ->where('app_id', $app->id)
            ->where(fn ($q) => $entityId === null ? $q->whereNull('entity_id') : $q->where('entity_id', $entityId))
            ->first();

        if (! $assignment) {
            $assignment = $user->assignments()->make([
                'id' => (string) Str::ulid(),
                'app_id' => $app->id,
                'entity_id' => $entityId,
                'assigned_at' => now(),
            ]);
        }

        $ecopaRole = $subject['ecopa_role'] ?? $subject['app_role'] ?? null;
        $assignment->ecopa_role = is_string($ecopaRole) ? $ecopaRole : $assignment->ecopa_role;
        $assignment->revoked_at = null;
        // role_id (detailed Asetto role) is intentionally left for a local admin to choose.
        $assignment->save();

        return ['status' => 'applied', 'code' => 'user_access_assigned'];
    }

    private function onUserUpdated(array $subject): array
    {
        $user = $this->findUser($subject);
        if (! $user) {
            return ['status' => 'applied', 'code' => 'user_not_provisioned'];
        }

        $user->fill(array_filter([
            'name' => $subject['name'] ?? null,
            'email' => $subject['email'] ?? null,
        ], fn (mixed $value): bool => is_string($value) && $value !== ''))->save();

        return ['status' => 'applied', 'code' => 'user_updated'];
    }

    private function onUserRevoked(array $subject): array
    {
        $user = $this->findUser($subject);
        $app = $this->selfApp();
        if ($user) {
            $user->assignments()
                ->where('app_id', $app->id)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now(), 'ecopa_role' => null]);
            $this->accessRevoker->revokeSessionsAndTokens($user);
        }

        return ['status' => 'applied', 'code' => 'user_access_revoked'];
    }

    private function onUserDisabled(array $subject): array
    {
        $user = $this->findUser($subject);
        if ($user) {
            $this->accessRevoker->disable($user);
        }

        return ['status' => 'applied', 'code' => 'user_disabled'];
    }

    private function onUserEnabled(array $subject): array
    {
        $user = $this->findUser($subject);
        if ($user) {
            $this->accessRevoker->enable($user);
        }

        return ['status' => 'applied', 'code' => 'user_enabled'];
    }

    /**
     * Keep Asetto's own entity list in sync with Ecopa (names/ids for the asset
     * form). These ids are Asetto's own; Akunta maps each to an Akunta entity via
     * AutoMappingEntityLink — there is no shared-id requirement across apps.
     */
    private function onEntity(string $event, array $subject): array
    {
        $id = (string) ($subject['id'] ?? '');
        if ($id === '') {
            return $this->rejected('missing_entity_id', 'Event entity membutuhkan id.');
        }

        if ($event === 'entity.deleted') {
            Entity::query()->whereKey($id)->update(['is_active' => false]);

            return ['status' => 'applied', 'code' => 'entity_deactivated'];
        }

        $tenant = Tenant::query()->first() ?? Tenant::query()->create(['name' => 'Default', 'slug' => 'default']);
        Entity::query()->updateOrCreate(
            ['id' => $id],
            array_filter([
                'tenant_id' => $tenant->id,
                'name' => $subject['name'] ?? null,
                'npwp' => $subject['npwp'] ?? null,
                'address' => is_array($subject['address'] ?? null) ? $subject['address'] : null,
            ], fn (mixed $value): bool => $value !== null),
        );

        return ['status' => 'applied', 'code' => 'entity_mirrored'];
    }

    private function selfApp(): RbacApp
    {
        $code = (string) config('ecopa.self_slug', 'asetto');

        return RbacApp::query()->firstOrCreate(
            ['code' => $code],
            ['name' => (string) config('ecopa.registration_name', 'Asetto'), 'version' => '1.0', 'enabled' => true],
        );
    }

    private function findUser(array $subject): ?User
    {
        $ecopaId = (string) ($subject['user_id'] ?? $subject['id'] ?? '');
        if ($ecopaId !== '') {
            $user = User::query()->where('main_tier_user_id', $ecopaId)->first();
            if ($user) {
                return $user;
            }
        }

        $email = $subject['email'] ?? null;

        return is_string($email) && $email !== ''
            ? User::query()->where('email', $email)->first()
            : null;
    }

    private function alreadyProcessed(string $event, string $eventId): JsonResponse
    {
        return response()->json([
            'status' => 'already_processed',
            'event' => $event,
            'event_id' => $eventId,
        ]);
    }

    private function rejected(string $code, string $message): array
    {
        return ['status' => 'rejected', 'code' => $code, 'message' => $message, 'retryable' => false];
    }
}
