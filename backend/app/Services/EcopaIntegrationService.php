<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\EcopaRegistrationException;
use App\Models\EcopaConfigIntegration;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Owns Asetto's first-access registration + integration state with Ecopa.
 *
 * Only this backend talks to Ecopa; the Registration Token never reaches the
 * SPA. SSO client credentials and the permanent webhook secret arrive through
 * the signed approval callback and are stored encrypted. See AGENTS.md §5 and
 * docs CHILD_APP_REGISTRATION_GUIDE.md (in the Akunta repo).
 */
class EcopaIntegrationService
{
    public const STATUS_ON = 'on';

    public const STATUS_OFF = 'off';

    private const REGISTRATION_EVENTS = [
        'app.registration.approved',
        'app.registration.rejected',
    ];

    /** @return array<string, mixed> */
    public function status(): array
    {
        $values = $this->values();
        $integrationStatus = $values->get('integration_status');

        if ($integrationStatus === null && filled(config('ecopa.client_id')) && $this->keyIntegration() !== null) {
            $integrationStatus = self::STATUS_ON;
        }

        return [
            'configured' => in_array($integrationStatus, [self::STATUS_ON, self::STATUS_OFF], true),
            'integration_status' => $integrationStatus,
            'registration_status' => $values->get('registration_status')
                ?? ($integrationStatus === self::STATUS_ON ? 'active' : null),
            'registration_request_id' => $values->get('registration_request_id'),
            'registration_message' => $values->get('registration_message'),
            'name' => $values->get('app_name', (string) config('ecopa.registration_name', 'Asetto')),
            'slug' => $values->get('app_slug', (string) config('ecopa.self_slug', 'asetto')),
            'base_url' => $values->get('base_url', $this->configuredBaseUrl()),
            'ecopa_url' => $values->get('ecopa_url', rtrim((string) config('ecopa.url'), '/')),
            'webhook_url' => $values->get('webhook_url', $this->webhookUrl()),
            'sso_ready' => $this->clientId() !== null && $this->clientSecret() !== null,
            'webhook_ready' => $this->keyIntegration() !== null,
        ];
    }

    /**
     * The browser submits only Ecopa URL + Registration Token; this backend
     * calls Ecopa and the token is never returned to the SPA.
     *
     * @param  array{ecopa_url: string, registration_token: string}  $input
     * @return array<string, mixed>
     */
    public function requestIntegratedRegistration(array $input): array
    {
        $current = $this->status();
        if ($current['integration_status'] === self::STATUS_ON || $current['registration_status'] === 'pending') {
            return $current;
        }

        $ecopaUrl = rtrim(trim($input['ecopa_url']), '/');
        $token = trim($input['registration_token']);
        $baseUrl = $this->configuredBaseUrl();

        $this->assertAllowedUrl($ecopaUrl, 'Ecopa URL', rejectPrivateHosts: true);
        $this->assertAllowedUrl($baseUrl, 'Base URL Asetto');
        if ($token === '') {
            throw new EcopaRegistrationException('Registration Token wajib diisi.', 422);
        }

        $webhookSecret = $this->registrationWebhookSecret();
        $payload = [
            'name' => (string) config('ecopa.registration_name', 'Asetto'),
            'slug' => (string) config('ecopa.self_slug', 'asetto'),
            'base_url' => $baseUrl,
            'webhook_secret' => $webhookSecret,
        ];

        $response = $this->http($ecopaUrl, $token)->post('/api/app-registration-requests', $payload);
        if (! in_array($response->status(), [200, 202], true)) {
            throw new EcopaRegistrationException(
                $this->registrationErrorMessage($response->status(), $response->json()),
                $response->status(),
            );
        }

        $requestId = data_get($response->json(), 'data.id');
        DB::transaction(function () use ($payload, $ecopaUrl, $token, $requestId): void {
            $this->putMany([
                'app_name' => $payload['name'],
                'app_slug' => $payload['slug'],
                'base_url' => $payload['base_url'],
                'ecopa_url' => $ecopaUrl,
                'webhook_url' => $this->webhookUrl($payload['base_url']),
                'registration_status' => 'pending',
                'registration_request_id' => $requestId === null ? null : (string) $requestId,
                'registration_message' => null,
                // Retained encrypted so approval/rejection retries remain verifiable.
                'registration_verification_secret' => Crypt::encryptString($token),
            ]);
        });

        return $this->status();
    }

    /** @return array<string, mixed> */
    public function cancelPendingRegistration(): array
    {
        $current = $this->status();
        if ($current['registration_status'] !== 'pending') {
            return $current;
        }

        EcopaConfigIntegration::query()
            ->whereIn('name', [
                'app_name', 'app_slug', 'base_url', 'ecopa_url', 'webhook_url',
                'registration_status', 'registration_request_id', 'registration_message',
                'registration_verification_secret', 'key_integration',
            ])
            ->delete();

        return $this->status();
    }

    /**
     * @param  array<string, mixed>  $subject
     * @return array<string, mixed>
     */
    public function activateFromApproval(array $subject): array
    {
        $this->assertMatchingRequest($subject);
        if (! $this->hasValidLocalWebhookSecret()) {
            throw new EcopaRegistrationException('Webhook secret lokal Asetto belum dikonfigurasi dengan benar.', 503);
        }
        if ($this->value('integration_status') === self::STATUS_ON) {
            // Idempotent replay: never rotate credentials from a second event.
            return $this->status();
        }

        $clientId = trim((string) ($subject['client_id'] ?? ''));
        $clientSecret = trim((string) ($subject['client_secret'] ?? ''));
        if ($clientId === '' || $clientSecret === '') {
            throw new EcopaRegistrationException('Approval Ecopa wajib menyertakan client_id dan client_secret.', 422);
        }

        $expectedSlug = (string) config('ecopa.self_slug', 'asetto');
        $appSlug = trim((string) ($subject['app_slug'] ?? $expectedSlug));
        if (! hash_equals($expectedSlug, $appSlug)) {
            throw new EcopaRegistrationException('Slug approval Ecopa tidak sesuai dengan aplikasi Asetto.', 422);
        }

        DB::transaction(function () use ($clientId, $clientSecret, $subject): void {
            $this->putMany([
                'client_id' => Crypt::encryptString($clientId),
                'client_secret' => Crypt::encryptString($clientSecret),
                'api_token' => filled($subject['api_token'] ?? null)
                    ? Crypt::encryptString((string) $subject['api_token'])
                    : null,
                'redirect_uri' => $this->callbackUrl(),
                'integration_status' => self::STATUS_ON,
                'registration_status' => 'active',
                'registration_message' => null,
                'webhook_url' => $this->webhookUrl(),
            ]);
        });

        $this->applyRuntimeConfiguration();

        return ['registration_status' => 'active'] + $this->status();
    }

    /** @param array<string, mixed> $subject */
    public function rejectRegistration(array $subject): array
    {
        $this->assertMatchingRequest($subject);
        if ($this->value('integration_status') === self::STATUS_ON) {
            return $this->status();
        }

        $message = trim((string) ($subject['reason'] ?? 'Request registrasi ditolak oleh administrator Ecopa.'));
        $this->putMany([
            'registration_status' => 'rejected',
            'registration_message' => $message,
        ]);

        return $this->status();
    }

    public function signatureSecretForEvent(?string $event): ?string
    {
        if (is_string($event) && in_array($event, self::REGISTRATION_EVENTS, true)) {
            return $this->encryptedValue('registration_verification_secret');
        }

        return $this->keyIntegration();
    }

    /** Apply encrypted DB values before the EcopaClient singleton is resolved. */
    public function applyRuntimeConfiguration(): void
    {
        if (! Schema::hasTable('ecopa_config_integration')) {
            return;
        }

        $values = array_filter([
            'ecopa.url' => $this->value('ecopa_url'),
            'ecopa.client_id' => $this->clientId(),
            'ecopa.client_secret' => $this->clientSecret(),
            'ecopa.api_token' => $this->encryptedValue('api_token'),
            'ecopa.redirect_uri' => $this->value('redirect_uri') ?: $this->callbackUrl(),
            'ecopa.webhook_secret' => $this->keyIntegration(),
        ], fn (mixed $value): bool => is_string($value) && $value !== '');

        config()->set($values);
    }

    public function keyIntegration(): ?string
    {
        return $this->encryptedValue('key_integration') ?? $this->nonEmptyConfig('ecopa.webhook_secret');
    }

    public function clientId(): ?string
    {
        return $this->encryptedValue('client_id') ?? $this->nonEmptyConfig('ecopa.client_id');
    }

    public function clientSecret(): ?string
    {
        return $this->encryptedValue('client_secret') ?? $this->nonEmptyConfig('ecopa.client_secret');
    }

    private function http(string $ecopaUrl, string $token): PendingRequest
    {
        return Http::baseUrl($ecopaUrl)
            ->acceptJson()
            ->asJson()
            ->withHeaders(['X-Ecopa-Registration-Token' => $token])
            ->timeout((int) config('ecopa.http_timeout', 8));
    }

    /** @return Collection<string, string|null> */
    private function values(): Collection
    {
        return Schema::hasTable('ecopa_config_integration')
            ? EcopaConfigIntegration::query()->pluck('value', 'name')
            : collect();
    }

    private function value(string $name): ?string
    {
        if (! Schema::hasTable('ecopa_config_integration')) {
            return null;
        }

        $value = EcopaConfigIntegration::query()->where('name', $name)->value('value');

        return is_string($value) && $value !== '' ? $value : null;
    }

    private function encryptedValue(string $name): ?string
    {
        $stored = $this->value($name);
        if ($stored === null) {
            return null;
        }

        try {
            return Crypt::decryptString($stored);
        } catch (Throwable) {
            return $stored;
        }
    }

    /** @param array<string, string|null> $values */
    private function putMany(array $values): void
    {
        foreach ($values as $name => $value) {
            EcopaConfigIntegration::query()->updateOrCreate(['name' => $name], ['value' => $value]);
        }
    }

    private function configuredBaseUrl(): string
    {
        return rtrim((string) (config('ecopa.registration_base_url') ?: config('app.url')), '/');
    }

    private function callbackUrl(): string
    {
        return $this->configuredBaseUrl().'/auth/ecopa/callback';
    }

    private function webhookUrl(?string $baseUrl = null): string
    {
        $baseUrl ??= $this->value('base_url') ?: $this->configuredBaseUrl();

        return rtrim($baseUrl, '/').'/webhooks/ecopa';
    }

    private function registrationWebhookSecret(): string
    {
        $secret = $this->encryptedValue('key_integration');
        if ($secret !== null) {
            if (! $this->isValidWebhookSecret($secret)) {
                throw new EcopaRegistrationException('Webhook secret lokal Asetto belum dikonfigurasi dengan benar.', 503);
            }

            return $secret;
        }

        $secret = bin2hex(random_bytes(32));
        $this->putMany(['key_integration' => Crypt::encryptString($secret)]);

        return $secret;
    }

    private function hasValidLocalWebhookSecret(): bool
    {
        $secret = $this->encryptedValue('key_integration');

        return $secret !== null && $this->isValidWebhookSecret($secret);
    }

    private function isValidWebhookSecret(string $secret): bool
    {
        return preg_match('/\A[0-9a-f]{64}\z/D', $secret) === 1;
    }

    private function nonEmptyConfig(string $key): ?string
    {
        $value = trim((string) config($key));

        return $value !== '' ? $value : null;
    }

    /** @param array<string, mixed> $subject */
    private function assertMatchingRequest(array $subject): void
    {
        $requestId = trim((string) ($subject['registration_request_id'] ?? $subject['request_id'] ?? ''));
        $storedRequestId = trim((string) $this->value('registration_request_id'));
        if ($requestId === '' || $storedRequestId === '' || ! hash_equals($storedRequestId, $requestId)) {
            throw new EcopaRegistrationException('Registration request ID tidak sesuai.', 422);
        }
    }

    private function assertAllowedUrl(string $url, string $field, bool $rejectPrivateHosts = false): void
    {
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        $host = (string) parse_url($url, PHP_URL_HOST);
        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new EcopaRegistrationException("{$field} harus berupa URL HTTP/HTTPS yang valid.", 422);
        }

        $isLocalhost = strtolower(rtrim($host, '.')) === 'localhost';
        if (app()->environment('production') && $scheme !== 'https' && ! $isLocalhost) {
            throw new EcopaRegistrationException("{$field} wajib menggunakan HTTPS di production.", 422);
        }
        if ($isLocalhost || ! $rejectPrivateHosts || app()->environment(['local', 'testing'])) {
            return;
        }

        $addresses = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
        if ($addresses === []) {
            throw new EcopaRegistrationException("Host {$field} tidak dapat di-resolve.", 422);
        }
        foreach ($addresses as $address) {
            if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
                throw new EcopaRegistrationException("{$field} tidak boleh mengarah ke jaringan private/reserved.", 422);
            }
        }
    }

    private function registrationErrorMessage(int $status, mixed $body): string
    {
        $upstream = is_array($body) ? data_get($body, 'message') : null;
        if (is_string($upstream) && $upstream !== '') {
            return $upstream;
        }

        return match ($status) {
            401 => 'Registration Token Ecopa tidak valid atau sudah digunakan. Ambil token terbaru dari dashboard Ecopa.',
            409 => 'Slug Asetto sudah digunakan atau mempunyai request pending dengan metadata berbeda. Hubungi administrator Ecopa.',
            422 => 'Metadata aplikasi ditolak Ecopa. Periksa Ecopa URL dan konfigurasi APP_URL Asetto.',
            429 => 'Ecopa membatasi request registrasi. Coba lagi kemudian.',
            503 => 'Registration Token belum tersedia di Ecopa. Minta administrator membuka dashboard Ecopa.',
            default => 'Registrasi aplikasi ke Ecopa gagal. Coba lagi atau hubungi administrator Ecopa.',
        };
    }
}
