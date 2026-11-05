<?php

declare(strict_types=1);

use Akunta\EcopaClient\Exceptions\TokenVerificationException;
use App\Services\AsettoEcopaClient;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;

/** A throwaway RSA test key (not a secret) — avoids openssl key generation. */
function testRsaPrivateKey(): string
{
    return <<<'PEM'
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAwpKcUJaXExh6HuBwlM84nrfRn/niZeN0G8S8S3YxoJtKMn/1
58JtMhnQJR3b8oWF7T+Gxz1Q1DuIXHPbEZ9fUT6O2I8etqLgX/qfwSCrXECKj6pU
qqtz7D9TAbSMLPovHsWqlr/CLC34Y46HRhYRKgpXPMfE3f/7L8+9ePO/VFsezMXQ
Apds/fZUteWh7wD5hQ1CC47hMVaFcqIj+91r4+rFtbvGeRU9/fP/W/09/JPMHEzV
J1iYfVHjd1mFSi2slB+baPcORUlZVXX0oph6d9/z3+VNKKSpnxpfZZ7up2HlJdbt
3PQUYarNTAnr6KCHkvtS+9VhhL2FrXZtKInsjwIDAQABAoIBAQCAT1KJymTiENgn
mHZli6mY8Ttptc3YxwAAd+J8GPttIDrzxnKRXSPJUEB02ZX7/pVs+OGWbhbpfkDU
RwqGOoUO/KQSp37njc1NPecv4q1ebqlxSDABRINznebNTxTJbEq6jjuKofYYUFBm
xszqKQ80nBEfYdWvWGl7BBG8u3DG3Q/0P7lSgUYvK2i76W25TlxMIHwW3YY1U/nj
QVRLkxOHcDoQDed5DjzE6lI2p8wwBw+jlgBKjtQp9jgOk8iW1yqhGcUB5WN/gSPu
8IemPQrXN0FEvNofKWLorUQwSeFfADJ/PWuXH/dGtrlE6Th8wfEib9dTBKcIZCZ5
57B1CeaxAoGBAPklGk62Fg03PQ6F+IEJxw1WHwIskdVI5U9wbvNPYCxDTzaj07yr
pC1Favq01cBH+W+yndAzDvvpBsp7b3zPnR+rI7iJLESg52g5MnA/uDwUJ7l7GPlP
KjSzvDADSS3OlPRZDXm7QEjkiIO306OFe1dojfwipAUJU9097n7YV4u7AoGBAMft
HlPyj1+DVDt+VAVn/fSyyD5Jk9PkBbFpHmbF9r51GGqdhcJTCoHyY5xb1+YBuxiS
1IP8RAcH7ceCEdHrhsSc2nEWJ8EGLNLXT9uufZ+jqzGRXZPVqqNAl/UWjMKznZpz
fEEUfuJZbWWfbZyGMp+JTaNo8YSW7RUecyAmIFM9AoGAQyLYX/V5I76K2WsId90m
olVerbtM4OhvwmRNwYrWI5dPtS2YVPL7nqdiGIS6RMIgWRUMqZnYo9E7Xzy74iof
8PSw/30XTLb/JHqlONIy1x2nRrgBFs1aVjFIuLdp9MoCIYYNt4vZ2sqabsQOZ7YE
cp1eBV9gS2skCi4yIkQx8xkCgYAuyv3dMhmChm9xmUi7FzLmUe3yPjBeWLFIa80U
yuLMgwWa9pF3AQ6liYDs+MYYbHFI+BzLY4DckGuD1ZqsIk8ht4CdFU1qrTJSitiD
F10JvznzWQ2o60qL+TNXxtZdP8L0gnEjnlNwUPP85Aq4puQ0WOOWCpr0qIqG9eCG
NsY8FQKBgQClIc+r01l+rxaJGhLnOOchGWyRjSrA6yFRAUQTWaqUxnEbJ0laGMKH
CjgEK0TaLamOMP5hZWHTxYIGmav9jwyHNyXqle5VG2ckJ+7Ib2ExMt88Iwj9myE5
R3jilX/8+dmfZCORPnb0VqplthMBo+MF55OTKkd8/DVtGS79S+bcrw==
-----END RSA PRIVATE KEY-----
PEM;
}

/**
 * @return array{0: AsettoEcopaClient, 1: string} the client + the signing private key PEM
 */
function makeEcopaClientWithJwks(): array
{
    $privatePem = testRsaPrivateKey();
    $details = openssl_pkey_get_details(openssl_pkey_get_private($privatePem));

    $b64 = fn (string $bin): string => rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
    $jwks = ['keys' => [[
        'kty' => 'RSA',
        'use' => 'sig',
        'alg' => 'RS256',
        'kid' => 'test-key-1',
        'n' => $b64($details['rsa']['n']),
        'e' => $b64($details['rsa']['e']),
    ]]];

    // Inject so fetchJwks()/fetchDiscovery() never hit the network.
    Cache::put('ecopa.jwks', $jwks, 3600);
    Cache::put('ecopa.discovery', ['issuer' => 'ecopa'], 3600);

    $client = new AsettoEcopaClient([
        'url' => 'https://ecopa.test',
        'expected_issuer' => 'ecopa',
        'redirect_uri' => 'https://aset.test/auth/ecopa/callback',
        'client_id' => 'client-123',
        'jwks_cache_seconds' => 3600,
    ]);

    return [$client, $privatePem];
}

function signToken(string $privatePem, array $overrides = []): string
{
    $payload = array_merge([
        'iss' => 'ecopa',
        'aud' => 'https://aset.test',
        'sub' => 'ecopa-user-1',
        'email' => 'user@example.com',
        'name' => 'Test User',
        'iat' => time(),
        'nbf' => time() - 10,
        'exp' => time() + 300,
    ], $overrides);

    return JWT::encode($payload, $privatePem, 'RS256', 'test-key-1');
}

it('accepts a valid RS256 token and returns claims', function () {
    [$client, $priv] = makeEcopaClientWithJwks();

    $claims = $client->verifyIdToken(signToken($priv));

    expect($claims['sub'])->toBe('ecopa-user-1');
    expect($claims['email'])->toBe('user@example.com');
});

it('accepts a token whose aud is the client_id', function () {
    [$client, $priv] = makeEcopaClientWithJwks();

    $claims = $client->verifyIdToken(signToken($priv, ['aud' => 'client-123']));

    expect($claims['sub'])->toBe('ecopa-user-1');
});

it('rejects a non-RS256 token (alg confusion)', function () {
    [$client] = makeEcopaClientWithJwks();

    // Hand-crafted alg=HS256 header; must be rejected before any key use.
    $b64 = fn (string $s): string => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    $forged = $b64('{"alg":"HS256","typ":"JWT","kid":"test-key-1"}')
        .'.'.$b64('{"iss":"ecopa","sub":"x","exp":'.(time() + 300).'}')
        .'.'.$b64('sig');

    expect(fn () => $client->verifyIdToken($forged))->toThrow(TokenVerificationException::class);
});

it('rejects a token with the wrong audience', function () {
    [$client, $priv] = makeEcopaClientWithJwks();

    expect(fn () => $client->verifyIdToken(signToken($priv, ['aud' => 'https://evil.example.com'])))
        ->toThrow(TokenVerificationException::class);
});

it('rejects a token with the wrong issuer', function () {
    [$client, $priv] = makeEcopaClientWithJwks();

    expect(fn () => $client->verifyIdToken(signToken($priv, ['iss' => 'not-ecopa'])))
        ->toThrow(TokenVerificationException::class);
});

it('rejects an expired token', function () {
    [$client, $priv] = makeEcopaClientWithJwks();

    expect(fn () => $client->verifyIdToken(signToken($priv, ['exp' => time() - 600, 'nbf' => time() - 900])))
        ->toThrow(TokenVerificationException::class);
});
