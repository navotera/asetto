<?php

declare(strict_types=1);

namespace App\Services;

use Akunta\EcopaClient\EcopaClient;
use Akunta\EcopaClient\Exceptions\TokenVerificationException;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Hardened ID-token verification for Asetto, layered on the shared ecopa-client
 * without modifying it. Overrides EcopaClient::verifyIdToken to:
 *   - pin the JWT algorithm to RS256 (block alg-confusion / "none" / HS256),
 *   - resolve the signing key by `kid` with one bounded JWKS refresh,
 *   - take the expected issuer from the OIDC discovery document (fallback config),
 *   - verify audience against the registered redirect-URI origin or client_id,
 *   - verify exp and nbf (with clock-skew leeway) and a non-empty sub.
 *
 * Bound over the package's EcopaClient via AppServiceProvider::register().
 */
class AsettoEcopaClient extends EcopaClient
{
    /** Clock-skew tolerance (seconds) for exp/nbf. */
    private const LEEWAY = 60;

    public function verifyIdToken(string $idToken): array
    {
        $header = $this->decodeHeader($idToken);

        // 1. Pin RS256 BEFORE touching keys — blocks alg=none/HS256 confusion.
        if (($header['alg'] ?? null) !== 'RS256') {
            $got = is_string($header['alg'] ?? null) ? $header['alg'] : 'none';
            throw new TokenVerificationException("Unexpected JWT alg \"{$got}\" (expected RS256).");
        }

        // 2. Resolve RS256 keys, refreshing JWKS once if the kid is unknown.
        $keys = $this->resolveKeys($header['kid'] ?? null);

        // 3. Verify signature (+ exp/nbf via the library) with leeway.
        JWT::$leeway = self::LEEWAY;
        try {
            $decoded = JWT::decode($idToken, $keys);
        } catch (Throwable $e) {
            throw new TokenVerificationException('Invalid id_token signature: '.$e->getMessage(), previous: $e);
        }
        /** @var array<string, mixed> $claims */
        $claims = json_decode(json_encode($decoded), true);

        // 4. Issuer — prefer the discovery document's issuer.
        $expectedIssuer = $this->expectedIssuer();
        if (($claims['iss'] ?? null) !== $expectedIssuer) {
            $got = is_string($claims['iss'] ?? null) ? $claims['iss'] : 'null';
            throw new TokenVerificationException("Issuer mismatch: got {$got}, expected {$expectedIssuer}.");
        }

        // 5. Audience — must name this app (redirect origin or client_id).
        $this->assertAudience($claims['aud'] ?? null);

        // 6. Explicit exp / nbf (belt-and-suspenders over the library checks).
        if (! isset($claims['exp']) || (int) $claims['exp'] < time() - self::LEEWAY) {
            throw new TokenVerificationException('Token expired.');
        }
        if (isset($claims['nbf']) && (int) $claims['nbf'] > time() + self::LEEWAY) {
            throw new TokenVerificationException('Token not yet valid (nbf).');
        }

        // 7. Non-empty, stable subject.
        if (trim((string) ($claims['sub'] ?? '')) === '') {
            throw new TokenVerificationException('Token missing a non-empty sub.');
        }

        return $claims;
    }

    /**
     * @return array<string, Key>
     */
    private function resolveKeys(?string $kid): array
    {
        $keys = $this->parseRs256Keys($this->fetchJwks());

        if ($kid !== null && ! isset($keys[$kid])) {
            // Unknown kid: Ecopa may have rotated — one bounded refresh.
            Cache::forget('ecopa.jwks');
            $keys = $this->parseRs256Keys($this->fetchJwks());
        }

        if ($keys === []) {
            throw new TokenVerificationException('No usable RS256 keys in Ecopa JWKS.');
        }

        return $keys;
    }

    /**
     * @param  array<string, mixed>  $jwks
     * @return array<string, Key>
     */
    private function parseRs256Keys(array $jwks): array
    {
        $rsa = array_values(array_filter(
            $jwks['keys'] ?? [],
            fn ($k): bool => is_array($k) && ($k['kty'] ?? null) === 'RSA',
        ));
        if ($rsa === []) {
            return [];
        }

        // Default alg RS256 pins keys that omit "alg"; only RSA keys are kept.
        return JWK::parseKeySet(['keys' => $rsa], 'RS256');
    }

    private function expectedIssuer(): string
    {
        try {
            $issuer = $this->fetchDiscovery()['issuer'] ?? null;
            if (is_string($issuer) && $issuer !== '') {
                return $issuer;
            }
        } catch (Throwable) {
            // Discovery unavailable — fall back to the configured issuer.
        }

        return (string) ($this->config['expected_issuer'] ?? 'ecopa');
    }

    private function assertAudience(mixed $aud): void
    {
        $expected = array_values(array_filter([
            $this->redirectOrigin(),
            is_string($this->config['client_id'] ?? null) && $this->config['client_id'] !== ''
                ? (string) $this->config['client_id']
                : null,
        ]));

        // Nothing to compare against (unconfigured) — don't lock users out.
        if ($expected === []) {
            return;
        }

        foreach (is_array($aud) ? $aud : [$aud] as $candidate) {
            if (is_string($candidate) && in_array($candidate, $expected, true)) {
                return;
            }
        }

        throw new TokenVerificationException('Token audience does not match this application.');
    }

    private function redirectOrigin(): ?string
    {
        $uri = $this->config['redirect_uri'] ?? null;
        if (! is_string($uri) || $uri === '') {
            return null;
        }

        $parts = parse_url($uri);
        if (empty($parts['scheme']) || empty($parts['host'])) {
            return null;
        }

        $origin = $parts['scheme'].'://'.$parts['host'];
        if (! empty($parts['port'])) {
            $origin .= ':'.$parts['port'];
        }

        return $origin;
    }

    /**
     * Decode the JWT header segment without verifying the signature.
     *
     * @return array<string, mixed>
     */
    private function decodeHeader(string $jwt): array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            throw new TokenVerificationException('Malformed JWT.');
        }

        $json = base64_decode(strtr($parts[0], '-_', '+/'), true);
        $header = $json === false ? null : json_decode($json, true);
        if (! is_array($header)) {
            throw new TokenVerificationException('Malformed JWT header.');
        }

        return $header;
    }
}
