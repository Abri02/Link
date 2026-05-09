# Week 1 — What Was Built and How It Works

A no-fluff engineering rundown of Days 1–5. Read this before touching the code.

---

## What exists

```
Link/
├── Link-BE/                     Gradle multi-project root
│   ├── shared-jwt/              JWT sign/verify library (no Spring)
│   ├── auth-service/            Handles signup, login, refresh, logout, /me
│   ├── gateway/                 Reads LINK_SESSION cookie → adds Bearer header → routes
│   ├── user-service/            Stub — main() only
│   └── messaging-service/       Stub — main() only
├── Link-FE/                     React 19 + Vite + Chakra UI (visual mockup only)
├── infra/
│   ├── docker-compose.yml       Postgres 16
│   └── postgres/init.sql        Creates auth / users / messaging schemas
├── postman/                     Collection with tests for all auth endpoints + gateway
└── docs/
    └── week1.md                 This file
```

Ports: gateway `8080`, auth-service `8081`, user-service `8082`, messaging-service `8083`.

---

## The one flow that ties everything together

```
Browser
  │
  │  POST /api/auth/login  (plain JSON, no cookie yet)
  ▼
Gateway :8080
  │  Public path → skip JWT check, forward as-is
  ▼
auth-service :8081
  │  Validates credentials, mints JWT + refresh token
  │  Returns Set-Cookie: LINK_SESSION=<jwt>; HttpOnly; SameSite=Lax; Max-Age=900
  │          Set-Cookie: LINK_REFRESH=<token>; HttpOnly; SameSite=Strict; Path=/api/auth/refresh; Max-Age=604800
  ▼
Browser stores both cookies (HttpOnly = JavaScript cannot read them)

─── subsequent authenticated request ───────────────────────────────────────

Browser
  │  GET /api/auth/me  (browser auto-attaches LINK_SESSION cookie)
  ▼
Gateway :8080
  │  JwtCookieFilter:
  │    reads LINK_SESSION cookie value
  │    verifies RSA-2048 signature + expiry
  │    adds Authorization: Bearer <jwt>
  │    strips /api prefix
  ▼
auth-service :8081/auth/me
  │  Spring Security OAuth2 resource server validates Bearer token
  │  Returns { id, email, username }
  ▼
Browser
```

The browser never sends a raw JWT directly — it sends a cookie. The gateway is the only component that reads cookies. Every downstream service sees a normal `Authorization: Bearer` header and knows nothing about cookies.

---

## shared-jwt — the signing library

**Location:** `Link-BE/shared-jwt/`  
**No Spring dependency.** Pure Kotlin + Nimbus JOSE JWT.

| Class | What it does |
|---|---|
| `KeyLoader` | Reads `keys/private.pem` and `keys/public.pem` from classpath. PKCS#8 private, X.509 public. RSA-2048. |
| `JwtSigner` | Takes `RSAPrivateKey`, signs JWTs with RS256. Embeds `sub` (userId), `email`, `username`, `roles`, `iss=link`, `iat`, `exp=iat+900s`, `jti`. |
| `JwtVerifier` | Takes `RSAPublicKey`, parses a JWT string, verifies signature, checks expiry. Returns `Boolean`. Used by the gateway. |
| `Claims` | Constants: claim names (`email`, `username`, `roles`), `ISSUER="link"`, `ACCESS_TTL_SECONDS=900`, `REFRESH_TTL_SECONDS=604800`. |

**Why RSA instead of a shared HMAC secret?**  
HMAC requires every service to hold the signing key — a compromised `messaging-service` would let an attacker mint tokens. RSA splits the key: only `auth-service` has the private key. Every other service only needs the public key to verify tokens. Compromise a downstream service → attacker gets read-only verification ability, not forgery ability.

The dev keypair is committed to the repo. Production keys override via env vars.

---

## auth-service

**Location:** `Link-BE/auth-service/`  
**Port:** 8081  
**Stack:** Spring Boot 4, Spring Data JPA, Spring Security OAuth2 Resource Server, BCrypt, PostgreSQL

### Database tables (schema: `auth`)

```sql
auth_user       id, email, username, display_name, password_hash
refresh_token   id, user_id, token_hash, expires_at, revoked_at
```

Hibernate creates these on startup via `ddl-auto=update`.

### Endpoints

| Method | Path | Auth required | What it does |
|---|---|---|---|
| POST | `/auth/signup` | No | Validates input, BCrypt hashes password, inserts user, mints JWT + refresh token, returns 201 + two cookies |
| POST | `/auth/login` | No | Finds user by email, BCrypt verifies password, mints + sets cookies, returns 204 |
| POST | `/auth/refresh` | No (refresh cookie) | Validates refresh token, rotates it (old revoked, new issued), returns 204 + new cookies |
| POST | `/auth/logout` | No | Revokes refresh token, returns 204 + both cookies with `Max-Age=0` |
| GET | `/auth/me` | Yes (Bearer JWT) | Reads `sub`/`email`/`username` from the validated JWT, returns JSON. No DB query. |

### Cookie design

```
LINK_SESSION=<jwt>
  HttpOnly   — JS cannot read it (XSS resistance)
  SameSite=Lax   — sent on same-site requests + top-level navigations, not on cross-site XHR
  Path=/         — sent on every request to this domain
  Max-Age=900    — 15 minutes

LINK_REFRESH=<opaque-uuid>
  HttpOnly
  SameSite=Strict  — never sent cross-site, not even on navigations (more restrictive)
  Path=/api/auth/refresh  — browser only sends this cookie to the refresh endpoint
  Max-Age=604800   — 7 days
```

**Why two cookies?** The access token (JWT) is short-lived (15 min) to limit blast radius if it leaks. The refresh token is long-lived (7 days) so the user doesn't have to re-enter their password. The refresh token's `Path` restriction means it's never accidentally sent with API calls — only the frontend explicitly calls the refresh endpoint.

**Why hash the refresh token?** We store `sha256(rawToken)` in the database, never the raw token. If the `refresh_token` table leaks, an attacker gets hashes of random UUIDs — computationally useless without the original tokens.

**Token rotation:** each refresh token is single-use (`@Transactional`). On use, the old token is revoked and a new one is issued atomically. If an attacker steals a refresh token and uses it, the legitimate user's next refresh will fail (token already revoked), alerting them that their session was compromised.

### Password security

BCrypt is used (not SHA-256 or MD5). BCrypt is deliberately slow (~100ms per hash), which makes offline brute-force attacks against a leaked database infeasible. It embeds a random salt per password, so identical passwords produce different hashes.

---

## gateway

**Location:** `Link-BE/gateway/`  
**Port:** 8080  
**Stack:** Spring Cloud Gateway 5.0.1 (reactive, WebFlux), Spring Cloud BOM 2025.1.1

The gateway is the only component the browser talks to. It handles three responsibilities:

### 1. Cookie → Bearer rewrite (`JwtCookieFilter`)

```kotlin
// Pseudocode of what the filter does on every non-public request:
val token = request.cookies["LINK_SESSION"]?.value ?: return 401
if (!jwtVerifier.verify(token)) return 401
request.mutate().header("Authorization", "Bearer $token")
```

Public paths (`/api/auth/signup`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`) skip this filter entirely. They don't need a JWT — they either create or destroy sessions.

The filter runs at order `-1` (before all routing filters).

### 2. Routing + path rewriting

```
/api/auth/**   → http://localhost:8081  (StripPrefix=1 → /auth/**)
/api/users/**  → http://localhost:8082  (StripPrefix=1 → /users/**)
/api/**        → http://localhost:8083  (StripPrefix=1 → /**)
```

`StripPrefix=1` removes the `/api` segment before forwarding. From each service's perspective, the gateway prefix never existed.

### 3. CORS

Configured in `application.yml` via `globalcors`. Allows `http://localhost:5173` (Vite dev server) with `credentials: true`. Without `credentials: true`, the browser refuses to send cookies cross-origin.

---

## How to run locally

```bash
# 1. Start Postgres
docker compose -f infra/docker-compose.yml up -d

# 2. Start services in IntelliJ (or terminal)
#    Run AuthServiceApplication  → listens on :8081
#    Run GatewayApplication       → listens on :8080

# 3. Test via Postman
#    Import postman/Link-Auth.postman_collection.json
#    Run "Signup — happy path", then "Via Gateway" folder

# 4. Or test with curl
curl -c cookies.txt -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret123"}'
# -c cookies.txt saves cookies to a file

curl -b cookies.txt http://localhost:8080/api/auth/me
# -b cookies.txt sends the saved cookies
```

---

## What's not done yet

| Feature | Status |
|---|---|
| Frontend routing + API calls | Day 6 — login/signup pages, protected route, fetch wrapper |
| `user-service` | Day 8 — GET /users/me, PATCH /users/me |
| `messaging-service` | Days 9–12 — workspaces, channels, messages |
| WebSocket real-time | Days 15–17 |
| docker-compose for services | Day 7 — all services containerised for demo |

---

## Key decisions at a glance

| Decision | Choice | Why |
|---|---|---|
| JWT algorithm | RS256 (RSA-2048) | Only auth-service can mint tokens; all other services verify with the public key only |
| Session transport | HttpOnly cookie | Invisible to JavaScript; XSS can't steal it |
| Access token TTL | 15 minutes | Short TTL limits damage if a token leaks |
| Refresh token storage | SHA-256 hash in DB | DB dump can't be replayed |
| Refresh token rotation | Single-use | Replay detection; stolen token triggers revocation |
| SameSite | Lax for session, Strict for refresh | Blocks CSRF for most cases; Strict gives extra protection to the long-lived token |
| Gateway | Spring Cloud Gateway (reactive) | Thin layer; keeps cookie logic isolated; downstream services stay clean |
| Multi-project Gradle | One root, five subprojects | Shared library (`shared-jwt`) without publishing to Maven; single build command |
