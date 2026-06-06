# AGENT.md

## Project Status

This project is in beta.

Breaking changes are acceptable.

Do not preserve backward compatibility unless explicitly instructed.

Prefer simple, clean, correct implementation over compatibility layers, migrations, or abstractions designed only for future unknown versions.

---

## Project Purpose

This repo implements a reusable passkey-backed authentication service for Cloudflare Workers.

Users should be able to deploy their own instance to their own Cloudflare account and use it to protect their private Worker apps.

The service includes:

* passkey registration
* passkey login
* bootstrap password recovery
* one-time enrollment links
* admin portal
* admin passkeys
* non-admin passkeys
* passkey management
* audit trail
* asymmetric session signing
* small client library for protected apps
* Alchemy v2 orchestration
* Effect v4 beta application structure

---

## Hard Requirements

* Use Alchemy v2 for orchestration.
* Do not treat Wrangler as the primary deployment configuration.
* Use Effect v4 beta.
* Create and maintain `vendor/`.
* Keep Alchemy source available at `vendor/alchemy`.
* Keep Effect source available at `vendor/effect`.
* When building with Alchemy, inspect `vendor/alchemy` instead of relying only on docs or memory.
* When building with Effect, inspect `vendor/effect` instead of relying only on docs or memory.
* Never hard-code `auth.yourdomain.com`.
* Always use configurable `AUTH_ORIGIN`.
* Store bootstrap password in Cloudflare secret `BOOTSTRAP_PW`.
* Store bootstrap enable flag in Cloudflare secret `ALLOW_BOOTSTRAP_PW`.
* Treat `ALLOW_BOOTSTRAP_PW` string value `"true"` as enabled.
* Treat every other value as disabled.
* Do not show bootstrap login if `ALLOW_BOOTSTRAP_PW` is disabled.
* Do not use `SESSION_SIGNING_SECRET`.
* Do not require protected apps to receive shared secrets.
* Use asymmetric signing for app sessions.
* Protected apps must verify sessions with public key material.
* Expose public key material from the auth service.
* Use human-readable `ALLOWED_APPS` JSON map configuration.
* Enrollment must happen through one-time enrollment links.
* Enrollment links must include a high-entropy token in the `k` query param.
* Store only a hash of the enrollment token.
* Raw enrollment links should be shown once.
* Each passkey must have an email.
* Each passkey should have a label.
* Each passkey must have an `isAdmin` field.
* The first passkey created through bootstrap flow must be an admin passkey.
* Admin-created enrollment links must include an `Admin passkey?` option.
* Only admin passkeys can log into the admin portal.
* Admin must be able to update passkey email.
* Admin must be able to update passkey label.
* Admin must be able to revoke/delete passkeys.
* Track which passkey logs into which `appId`.
* Display audit history in the admin portal.

---

## Bootstrap Flow

Expected first-run flow:

1. User sets `BOOTSTRAP_PW`.
2. User sets `ALLOW_BOOTSTRAP_PW=true`.
3. User configures `AUTH_ORIGIN`.
4. User configures `ALLOWED_APPS`.
5. User deploys the Worker through Alchemy.
6. User visits `/admin`.
7. User logs in with `BOOTSTRAP_PW`.
8. User clicks `Create and open first admin enrollment link`.
9. User registers first passkey.
10. Stored passkey has `isAdmin=true`.
11. User returns to `/admin`.
12. User logs in with admin passkey.
13. User disables bootstrap password by setting `ALLOW_BOOTSTRAP_PW=false`.

If a user loses all admin passkeys, they can set `ALLOW_BOOTSTRAP_PW=true` again and recover through the bootstrap flow.

---

## Admin vs Non-Admin Passkeys

A passkey with:

```ts
isAdmin: true
```

can:

* log into protected apps
* log into the admin portal
* create enrollment links
* update passkey metadata
* revoke passkeys
* view audit history

A passkey with:

```ts
isAdmin: false
```

can:

* log into protected apps

It cannot:

* log into the admin portal
* create enrollment links
* manage passkeys
* view audit history

---

## UX Requirements

The `/login` page should be mostly whitespace with a centered panel.

The `/admin` unauthenticated page should offer:

* admin passkey login
* bootstrap password login only if enabled

The bootstrap-only admin page should offer a special first-run flow with a one-click action:

```txt
Create and open first admin enrollment link
```

The authenticated admin portal should show:

* passkeys
* whether each passkey is admin
* enrollment link creation
* `Admin passkey?` checkbox for new enrollment links
* audit history
* passkey usage by app

---

## Alchemy Instructions

Use Alchemy v2 for infrastructure orchestration.

Before implementing or changing Alchemy stack code:

1. Inspect `vendor/alchemy`.
2. Find the actual Cloudflare Worker resource API.
3. Find the actual Durable Object binding/migration API.
4. Find the actual secret/var configuration style.
5. Implement against source-confirmed APIs.

Do not invent Alchemy APIs from memory.

Do not blindly copy old Wrangler examples into the deployment model.

Wrangler may appear as an implementation detail only when Alchemy requires or interoperates with it.

---

## Effect Instructions

Use Effect v4 beta.

Before implementing or changing Effect code:

1. Inspect `vendor/effect`.
2. Confirm current v4 beta APIs.
3. Prefer source-confirmed imports and patterns.
4. Avoid stale Effect v2/v3 patterns unless verified.

Use Effect for:

* environment parsing
* typed errors
* service boundaries
* Durable Object service access
* crypto/signing service
* WebAuthn service
* audit service
* dependency injection where useful

Do not over-abstract simple code merely to use Effect.

---

## Coding Style

Use TypeScript.

Favor small modules.

Keep route handlers thin.

Put Durable Object state logic in `src/auth-state.ts`.

Put WebAuthn-specific logic in `src/webauthn`.

Put signing/cookie/token helpers in `src/crypto`.

Put HTML rendering helpers in `src/html`.

Put Effect service definitions in `src/effect`.

Avoid premature abstractions.

Avoid introducing a database abstraction layer unless clearly useful.

---

## Security Rules

* Do not log secrets.
* Do not log raw enrollment tokens.
* Do not store raw enrollment tokens.
* Do not expose private key material.
* Do not use shared session secrets.
* Do not expose whether a particular email has a passkey.
* Use short-lived, single-use challenges.
* Use short-lived, single-use auth codes.
* Use secure cookies.
* Reject revoked passkeys.
* Reject non-admin passkeys from admin login.
* Audit failed and successful auth events.
* Validate `returnTo` against `ALLOWED_APPS`.

---

## App Allowlist

Use `ALLOWED_APPS` as a JSON map.

Example:

```json
{
  "photos": "https://photos.example.com",
  "huckabuilder": "https://builder.example.com"
}
```

Rules:

* unknown `appId` is rejected
* `returnTo` must be a valid URL
* `returnTo.origin` must equal `ALLOWED_APPS[appId]`
* malformed config should fail loudly at startup

---

## Testing Expectations

Add or update tests for any changed auth behavior.

Critical flows that should stay covered:

* bootstrap login enabled
* bootstrap login disabled
* first admin enrollment link generation
* enrollment link generation with admin flag
* enrollment link consumption
* passkey registration
* `isAdmin` stored correctly
* admin passkey login
* non-admin passkey rejected from admin portal
* passkey update
* passkey revoke
* app login
* token exchange
* asymmetric session signing
* public key verification
* audit event creation
* `ALLOWED_APPS` validation

---

## Vendor Directory Expectations

The `vendor/` directory is not decorative.

It exists so coding agents can inspect the actual library source.

When stuck, inspect:

```txt
vendor/alchemy
vendor/effect
```

Use source as the authority over stale examples, memory, or assumptions.

If the vendored source disagrees with documentation, prefer the source and note the discrepancy in comments or implementation notes.

