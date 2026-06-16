# Droplet Auth App Agent Guide

This app is a passkey-backed auth server for Cloudflare Workers. It runs in a Cloudflare account, stores durable auth state in a SQLite-backed Durable Object, and acts as an identity provider for web apps.

Some instances will only need small local changes. Others may grow into long-lived auth servers with custom policies, UI, app integrations, audit behavior, or operational requirements. Prefer changes that keep the app easy to inspect, test, and evolve.

## Core Model

- The auth server owns passkeys, admin sessions, app login challenges, enrollment links, app auth codes, audit events, and usage summaries.
- Protected apps redirect users to this server for login.
- Protected apps exchange callback codes for app-scoped session JWTs.
- Protected apps verify those JWTs with public keys from `/.well-known/droplet-auth/jwks.json`.
- Protected apps never receive `AUTH_PRIVATE_KEY` or a shared signing secret.

## Architecture Map

### Worker Entry Point

Start with `src/index.ts`.

- Exports the `AuthState` Durable Object class.
- Defines the main Worker `fetch` handler.
- Serves embedded assets before config parsing.
- Calls `parseConfig(env)` once per request after static asset handling.
- Dispatches by HTTP method and pathname to route modules.
- Returns `404` for unknown routes.

When adding a route, implement the handler in `src/routes/<feature>.ts`, then add the smallest dispatch branch needed in `src/index.ts`.

### Cloudflare Infrastructure

Start with `alchemy.run.ts`.

- Creates the `AuthState` Durable Object namespace.
- Creates the auth Worker.
- Binds `AUTH_STATE`, `AUTH_ORIGIN`, and `ALLOWED_APPS`.
- Binds `BOOTSTRAP_PW`, `ALLOW_BOOTSTRAP_PW`, and `AUTH_PRIVATE_KEY` as Cloudflare `secret_text` bindings.
- Enables the public Worker URL.

When adding Cloudflare resources or bindings, declare them here, add their types to `src/types.ts`, and access them through `env`.

### Environment And Config

Use these files together:

- `.env.example` documents deploy-time values.
- `src/setup-config.ts` validates deploy-time environment used by Alchemy.
- `src/env.ts` validates runtime Worker bindings and turns them into `AppConfig`.
- `src/types.ts` defines `Env`, `AppConfig`, record types, and shared domain types.

When adding an environment variable:

1. Add it to `.env.example`.
2. Add it to `Env` in `src/types.ts`.
3. Parse and validate it in `src/env.ts` if routes use it at runtime.
4. Parse and validate it in `src/setup-config.ts` if deployment needs it before the Worker exists.
5. Bind it in `alchemy.run.ts` if Cloudflare needs to receive it.
6. Document it in `README.md`.
7. Add or update tests.

### Durable Object State

Start with `src/auth-state.ts`.

`AuthState` owns all durable SQLite state and should be the only place that directly reads or writes auth database tables. Route handlers should call methods on `AuthState` instead of scattering SQL across the app.

Current state areas include:

- Sessions
- Enrollment links
- WebAuthn challenges
- Passkeys
- App auth codes
- Audit events
- Passkey usage summaries
- App usage summaries

When adding durable state:

1. Add or extend schema setup in `initializeSchema`.
2. Add a row type near the top of `src/auth-state.ts`.
3. Add or extend a public record type in `src/types.ts`.
4. Add a mapping function near the existing mappers.
5. Add methods on `AuthState` for route code to call.
6. Prefer additive schema changes. Avoid destructive migrations unless explicitly required.
7. Add tests for the behavior that depends on the new state.

### Routes

Route modules live in `src/routes`.

- `admin.ts`: admin portal and admin APIs.
- `enroll.ts`: enrollment pages and passkey registration.
- `login.ts`: app login flow and passkey authentication.
- `token.ts`: callback code exchange for protected apps.
- `well-known.ts`: JWKS endpoint.
- `health.ts`: health endpoint.
- `assets.ts`: embedded static and image assets.
- `helpers.ts`: shared route helpers for state access, request parsing, sessions, redirects, JSON responses, and request metadata.

Keep route handlers focused on HTTP flow, validation, calls into `AuthState`, and response construction. Put reusable persistence behavior in `AuthState`. Put reusable HTTP/session helpers in `src/routes/helpers.ts` only when more than one route needs them.

### HTML And UI

Server-rendered HTML lives in `src/html`.

- `layout.ts`: shared frame, styles, and layout primitives.
- `admin.ts`: admin portal markup.
- `enroll.ts`: enrollment pages.
- `login.ts`: login page.
- `scripts.ts`: small inline browser scripts for WebAuthn flows.

Keep page-specific markup in the matching page file. Keep shared style/layout changes in `layout.ts`. When changing passkey flows, inspect the route handler, rendered HTML, and inline script together.

### Crypto And WebAuthn

Security-sensitive helpers live in `src/crypto` and `src/webauthn`.

- `src/crypto/base64url.ts`: base64url encoding helpers.
- `src/crypto/cookies.ts`: session cookie names and cookie formatting.
- `src/crypto/hashing.ts`: hashing and timing-safe comparison.
- `src/crypto/random.ts`: IDs and secure random tokens.
- `src/crypto/signing.ts`: JWT signing and JWKS/public key handling.
- `src/webauthn/options.ts`: RP ID and WebAuthn credential mapping.

Use these helpers instead of writing ad hoc crypto, cookie, random, hash, signing, or WebAuthn code inline.

### Tests

Tests live in `tests` and run with Vitest.

- `env.test.ts`: runtime config parsing.
- `setup-config.test.ts`: deploy-time config parsing.
- `crypto.test.ts`: crypto helpers.
- `client-worker.test.ts`: published Worker helper behavior.
- `app-scope.test.ts`: app-scoped passkey access rules.
- `admin-pagination.test.ts`: admin audit pagination.
- `assets.test.ts`: static asset serving.

Add tests for new config validation, access rules, crypto behavior, pure route helpers, and domain logic. Keep tests focused and deterministic.

Run:

```sh
bun run check
bun run test
```

Do not run bare `bun test`; it may discover ignored local workspace directories.

## Common Change Recipes

### Add A Public Route

1. Add `src/routes/<feature>.ts`.
2. Export a named handler.
3. Import and dispatch from `src/index.ts`.
4. Use `parseConfig(env)` output if route behavior depends on app config.
5. Add tests for pure logic or route behavior.
6. Update `README.md` if the route is user-facing.

### Add An Admin API

1. Add a branch in `handleAdminApi` in `src/routes/admin.ts`.
2. Require an admin session with `getAdminSession` or an existing admin wrapper.
3. Use `getState(env)` to call `AuthState` methods.
4. Add an audit event for auth-sensitive or security-sensitive mutations.
5. Return JSON for API-style endpoints and redirects for form-style endpoints, matching nearby patterns.
6. Add tests.

### Add New Durable State

1. Update `AuthState.initializeSchema`.
2. Add a row type in `src/auth-state.ts`.
3. Add or update a public record interface in `src/types.ts`.
4. Add a mapper function.
5. Add `AuthState` methods for reads/writes.
6. Call those methods from route handlers.
7. Add tests for behavior that uses the state.

### Add A New Cloudflare Binding Or Resource

1. Add the resource or binding in `alchemy.run.ts`.
2. Add the binding type to `Env` in `src/types.ts`.
3. Use the binding through `env`.
4. Keep secrets out of source and `.env.example` values blank where appropriate.
5. Run `bun alchemy plan ./alchemy.run.ts` before deploying.

### Change Login Or Enrollment Behavior

1. For app login, read `src/routes/login.ts`.
2. For enrollment, read `src/routes/enroll.ts`.
3. For admin-created enrollment links, read `src/routes/admin.ts`.
4. Check `src/webauthn/options.ts` before changing WebAuthn parameters.
5. Check the matching HTML and inline script files.
6. Preserve consume-once challenge behavior.
7. Preserve `ALLOWED_APPS` return URL validation unless explicitly replacing that security model.
8. Add audit events for success and failure paths.
9. Add tests for changed access rules.

### Change The Admin UI

1. Start in `src/html/admin.ts`.
2. Keep shared layout/style changes in `src/html/layout.ts`.
3. If the UI calls an API, update `src/routes/admin.ts` with the matching behavior.
4. Preserve CSRF/same-origin checks for admin mutations.
5. Add tests for any new parsing, pagination, access, or mutation logic.

## Security Rules

- Never expose `AUTH_PRIVATE_KEY` to browsers or protected apps.
- Do not add a shared signing secret for protected apps unless explicitly required by a new security model.
- Validate `returnTo` against `ALLOWED_APPS` before redirecting or issuing auth codes.
- Keep WebAuthn challenges short-lived and single-use.
- Use `timingSafeEqual` for secret comparisons.
- Use `secureRandomBase64Url` for raw tokens, codes, and secrets generated by the app.
- Store hashes of raw session tokens, enrollment tokens, and auth codes; do not store raw token material.
- Use existing cookie helpers so session cookies stay `HttpOnly`, `Secure`, and `SameSite=Lax` unless there is a concrete reason to change them.
- Add audit events for login, enrollment, passkey, admin, and token-exchange success/failure paths.
- Treat changes to `src/crypto`, `src/webauthn`, `src/routes/login.ts`, `src/routes/token.ts`, and `src/auth-state.ts` as security-sensitive.

## Operational Notes

- `AUTH_ORIGIN` is derived from deploy-time config and bound into the Worker.
- `ALLOWED_APPS` is the allowlist for app IDs and return origins.
- `AUTH_PRIVATE_KEY` signs app session JWTs.
- Public verification material is served from `/.well-known/droplet-auth/jwks.json`.
- The Durable Object instance name is currently `global`, so the app uses one global auth state by default.

## Useful Commands

For a generated standalone app:

```sh
bun install
bun run check
bun run test
bun run setup:print
bun alchemy plan ./alchemy.run.ts
bun run deploy
```

Before deployment, configure Cloudflare for Alchemy if needed:

```sh
bunx alchemy configure
```

## Where To Look First

- User-facing setup and env documentation: `README.md`.
- Route map: `src/index.ts`.
- Runtime config: `src/env.ts`.
- Deploy-time config: `src/setup-config.ts`.
- Shared domain types: `src/types.ts`.
- Durable persistence: `src/auth-state.ts`.
- Cloudflare resources and bindings: `alchemy.run.ts`.
- Protected app helper usage: package docs for `@whnvr/droplet/auth/worker`.
