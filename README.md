# Secure Entry Gateway — Zero Trust API PoC

A proof of concept for a Zero Trust API: a central **Gateway** verifies every
request against an OIDC provider before it is allowed anywhere near the
**Backend**, and the Backend refuses to do any authentication work of its
own — it only trusts a header the Gateway injects after verification.

## Traffic flow

```
                 1. GET/POST/PUT/DELETE /api/users
                    Authorization: Bearer <JWT>
Client  ───────────────────────────────────────────────▶  Gateway (:3000)
                                                               │
                                       2. Verify signature     │
                                          using cached JWKS    │
                                       3. Verify exp/iss/aud   │
                                                               │
                              ┌────────────────────────────────┤
                              │                                │
                      token invalid                      token valid
                              │                                │
                              ▼                                ▼
                     401 Unauthorized                4. Forward request,
                     (request stops here,                replace Authorization
                      Backend never sees it)             header with:
                                                          X-Verified-User: <sub>
                                                               │
                                                               ▼
                                                     Backend (:4000)
                                                               │
                                       5. X-Verified-User present?
                              ┌────────────────────────────────┤
                              │                                │
                             no                               yes
                              │                                │
                              ▼                                ▼
                     403 Forbidden                    Process request against
                     (direct-to-backend                in-memory user store,
                      requests are blocked)             return 200/201/404/400
```

The repository contains two independent Node.js services, each in its own
top-level folder:

| Folder | Purpose |
|---|---|
| `gateway` | Reverse proxy. Verifies JWTs, caches JWKS, injects `X-Verified-User`. |
| `backend` | Express REST API for `/api/users`. Trusts `X-Verified-User` only. |

## 1. Set up an OIDC tenant

The Gateway works with any OIDC-compliant identity provider (IdP) that
issues JWT access tokens. Nothing in the code is specific to one vendor; it
only needs the three values in step 2. In a free developer tenant of your
chosen provider:

1. **Register the API** (some providers call this a resource server or a
   custom authorization server) and give it an identifier, e.g.
   `https://secure-api.example.com`. This is the `audience` that access
   tokens for this API will carry.
2. **Register a client application** for logging users in. A public client
   (native or single-page type) using the Authorization Code flow with PKCE
   needs no client secret. Note its client ID.
3. **Create a test user** with a username and password.
4. **Find the issuer and JWKS URI** in the provider's discovery document at
   `https://YOUR_IDP_DOMAIN/.well-known/openid-configuration`: the `issuer`
   and `jwks_uri` fields. Copy the issuer exactly as shown, including any
   trailing slash, because the Gateway compares it character for character.

## 2. Configure environment variables

```bash
cp gateway/.env.example gateway/.env
cp backend/.env.example backend/.env
```

Edit `gateway/.env`:

```bash
PORT=3000
BACKEND_URL=http://localhost:4000
OIDC_ISSUER=https://YOUR_IDP_DOMAIN/
OIDC_AUDIENCE=https://secure-api.example.com
OIDC_JWKS_URI=https://YOUR_IDP_DOMAIN/.well-known/jwks.json
```

`backend/.env` only needs `PORT` (default `4000`) — it never talks to the IdP.

## 3. Run both services

```bash
# Terminal 1
cd backend && npm install && npm start

# Terminal 2
cd gateway && npm install && npm start
```

The Gateway listens on `:3000` and proxies `/api/users` to the Backend on `:4000`.

## 4. Try it

**Get an access token as the test user.** The Gateway only validates
tokens; it never issues them, so the token comes straight from the IdP.
Log in as the test user with the **Authorization Code flow with PKCE**,
using your provider's own CLI or test console, or any OAuth client such as
Postman, with these settings:

| Setting | Value |
|---|---|
| Authorization and token endpoints | `authorization_endpoint` and `token_endpoint` from the discovery document |
| Client ID | the client application from step 1 |
| Scope | `openid` |
| Audience / resource | the API identifier from step 1 |
| Callback URL | whatever your tool uses; it must be allowed on the client application |

Copy the resulting access token into `TOKEN` below.

- Request the API's audience. Without it, many providers issue an access
  token that is not a JWT for this API, and the Gateway returns `401`.
- Send the **access token**, not the ID token. The ID token is meant for the
  client application and fails the Gateway's audience check.

**Success scenario** — call the Gateway with the test user's access token:

```bash
TOKEN="<paste the access token here>"

curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users

curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada Lovelace","email":"ada@example.com"}'
```

**Failure scenario 1** — no token, blocked at the Gateway:

```bash
curl -i http://localhost:3000/api/users
# HTTP/1.1 401 Unauthorized
```

**Failure scenario 2** — bypass the Gateway entirely and hit the Backend
directly; it refuses because there's no verified identity header:

```bash
curl -i http://localhost:4000/api/users
# HTTP/1.1 403 Forbidden
```

**Debuggability** — the Gateway emits one JSON log line per request:

```json
{"level":"info","timestamp":"2026-01-01T00:00:00.000Z","pid":1234,"hostname":"gateway-1","event":"request","method":"GET","path":"/api/users","sourceIp":"::1","userId":"user-abc123","statusCode":200,"durationMs":7}
```

## 5. Run the tests

Each service mocks the OIDC provider / caller rather than depending on a
live tenant, so tests run offline and deterministically.

```bash
cd gateway && npm test
cd backend && npm test
```

`gateway/tests/jwt.test.js` spins up a local mock IdP (real RS256 keypair,
real JWKS endpoint, real signed tokens via `jose`) and a mock backend, then
proves:

- No/garbled Authorization header → `401`, backend never called.
- Expired token → `401`.
- Wrong issuer / wrong audience / bad signature → `401`.
- Valid token → `200`, `X-Verified-User` injected, body forwarded unchanged,
  `Authorization` header stripped before forwarding.
- The JWKS endpoint is hit at most once across repeated requests (local
  caching, not fetched per-request).

`backend/tests/users.test.js` proves the other half of Zero Trust: a
request with no `X-Verified-User` header is rejected with `403` (this is
what happens if someone bypasses the Gateway and hits the Backend
directly), and exercises full CRUD plus input validation and error
handling (malformed JSON → `400`, no stack traces leaked).

## Design notes

- **Separation of concerns**: the Gateway runs three independent steps in
  order, each in its own folder under `gateway/src/features/`:
  `auth/` authenticates (verifies the token), `policy/` authorizes (a pure
  allow/deny decision that also picks the identity claim), and `proxy/`
  forwards. It does not know about user data shapes. The Backend only
  checks the verified-identity header and owns business logic; it has no
  JWT/crypto dependency at all.
- **Fail-fast config**: `gateway/src/config/env.config.js` validates the
  required environment variables at startup, so a missing OIDC setting
  stops the Gateway instead of silently weakening verification.
- **Audience as configuration**: `OIDC_AUDIENCE` is the Gateway's own
  identity as a token recipient, not knowledge of the Backend's domain. With
  one API behind the Gateway a single value is enough; a Gateway fronting
  several APIs would declare the expected audience per route, alongside
  that route's backend URL and policy.
- **JWKS caching**: `jose`'s `createRemoteJWKSet` caches the keyset in
  memory and only refetches on a cache miss (e.g. unknown `kid`, with a
  cooldown), rather than on every request.
- **No body parsing in the Gateway**: the Gateway doesn't call
  `express.json()`, so the original request stream is proxied byte-for-byte
  to the Backend — JSON bodies pass through untouched.
- **No leaked internals**: every error response is a generic JSON object
  (`{"error": "..."}`); verification failure reasons and stack traces are
  logged server-side only, never returned to the client.
