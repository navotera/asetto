# Asetto Backend (Laravel)

API backend for **Asetto** — a company **asset-management** app and a third-tier
child app in the Akunta ecosystem. It serves the React SPA in [`../web`](../web)
over Sanctum cookie auth, delegates all identity to **Ecopa** (SSO), and posts
economic events (depreciation, disposals) as **journals to Akunta** server-to-server.

See [`../AGENTS.md`](../AGENTS.md) for the full ecosystem contract.

## Two separate axes (do not mix)

| Axis | Centre | Mechanism |
|---|---|---|
| **Identity / login** | **Ecopa** (IdP) | OIDC via `akunta/ecopa-client` — silent SSO, no password in Asetto |
| **Accounting data** | **Akunta** (general ledger) | REST via `akunta/api-client` — balanced journals, idempotency keys |

The SPA talks only to this backend; this backend talks to Ecopa (identity) and
Akunta (journals). The browser never posts a journal.

## Stack

- **Laravel 11** · PHP 8.3+ · **Sanctum** (SPA cookie sessions)
- **Pest** for tests · **Pint** for formatting
- Shared ecosystem packages: `akunta/ecopa-client`, `akunta/api-client`,
  `akunta/rbac`, `akunta/core`, `akunta/audit`

## Ecosystem packages — how they're pulled (AGENTS.md §4)

Asetto is a **separate repo**, but the shared modules currently live as
subdirectories of the Akunta monorepo (they are not individual git repos). The
lightest thing that works today — and the chosen starting point — is a Composer
**path repository** pointing at a sibling Akunta checkout:

```jsonc
// composer.json
"repositories": [
  { "type": "path", "url": "../../akunta/modules/ecopa-client", "options": { "symlink": true } },
  { "type": "path", "url": "../../akunta/modules/api-client",   "options": { "symlink": true } }
  // + core, rbac, audit
]
```

This assumes the layout `www/asetto` and `www/akunta` side by side. **Migration
to true Composer VCS** (the §4 recommendation) is a one-line-per-repo change once
the modules are split into their own git repos: swap each `"type": "path"` for
`"type": "vcs"` with the module's git URL. The `require` entries stay the same.

## Setup

```bash
composer install
cp .env.example .env   # already present after create-project
php artisan key:generate
php artisan migrate --seed   # SQLite by default (database/database.sqlite)
php artisan serve            # http://localhost:8000
```

Point the SPA at this backend by setting its env (`../web/.env`):

```
VITE_API_MODE=live
VITE_API_BASE=http://localhost:8000
```

## Auth & integration flow

1. **First access** — if Ecopa isn't configured, the SPA shows a wizard that
   submits only `Ecopa URL` + `Registration Token` to
   `POST /api/integration/register`. The backend registers Asetto with Ecopa; the
   token never returns to the browser.
2. **Approval** — Ecopa calls `POST /webhooks/ecopa` with
   `app.registration.approved` (signed with the Registration Token). The backend
   stores the SSO client credentials + permanent webhook secret **encrypted**.
3. **Login** — the SPA redirects to `/auth/ecopa/redirect`; the OIDC dance runs
   in `akunta/ecopa-client`; `EcopaController::provisionUser()` upserts a shadow
   user and logs them in. No password ever touches Asetto.
4. **Lifecycle** — `POST /webhooks/ecopa` handles the six standard events
   (`user.assigned/updated/revoked/deleted` + registration) — HMAC-verified and
   idempotent (one receipt per `event_id`).

Detailed Asetto roles (Asset Manager, Custodian, Viewer, …) are chosen **locally**
per assignment; Ecopa only supplies the coarse `app_role` (admin|user).

## REST surface

The routes under `/api/*` mirror `../web/src/api/mock/handlers.ts` exactly, so
flipping the SPA from `mock` to `live` is a config change, not a rewrite:
`me`, `dashboard`, `categories`, `custodians`, `assets` (CRUD + condition +
reassign), `depreciation` (pending/preview/runs), `disposals`, `journals`.

## Journal posting

`AkuntaPostingService` writes every journal to a durable **outbox** first (unique
idempotency key, e.g. `dep:2026-11`), then pushes to Akunta via
`akunta/api-client`. With no Akunta token configured (local/dev) the row stays
`queued`, so the depreciation → journal path is exercised end-to-end without a
live ledger. The exact Akunta journal payload mapping is finalized against
Akunta's posting contract.

## Tests

```bash
vendor/bin/pest       # webhook idempotency/lifecycle, asset CRUD, depreciation
vendor/bin/pint       # format
```

## Status / next steps (AGENTS.md §7)

Done: scaffold, module wiring, SSO, webhook + registration wizard, shadow user +
assignments, asset domain (migrations/models), SPA REST surface, outbox + posting
service, Pest tests.

Next: finalize the Akunta journal payload against Akunta's posting contract and
flush the outbox on a queue; local RBAC UI for assigning detailed roles; wire the
first-access wizard screen in the SPA.
