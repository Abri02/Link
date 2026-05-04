# Link — Project State & Design Explanation

## What this file is

A plain-language companion to the README. The README is a planning doc; this file explains what is actually built, how each piece fits together, why the design looks the way it does, and where the sharp edges are right now. Read this before writing new code.

---

## 1. What exists right now (May 2025)

The repo has three days of real work and a UI visual prototype on top of an initial scaffold.

### Backend — `Link-BE/`

A Gradle multi-project root containing five subprojects.

| Subproject | Port | Status | What it has |
|---|---|---|---|
| `shared-jwt` | library | **Done** | `KeyLoader`, `JwtSigner`, `Claims` constants, RSA-2048 dev keypair |
| `auth-service` | 8081 | **Done (Day 3)** | `AuthUser` + `RefreshToken` entities, signup + login endpoints, cookie minting |
| `user-service` | 8082 | **Stub** | `main` function only |
| `messaging-service` | 8083 | **Stub** | `main` function only |
| `gateway` | 8080 | **Stub** | `main` function only, no routes, no JWT filter |

### File layout inside auth-service

```
auth-service/src/main/kotlin/com/github/abri02/link/auth/
├── AuthServiceApplication.kt       — Spring Boot entry point
├── config/
│   ├── SecurityConfig.kt           — disables CSRF, stateless session, all requests permitted
│   └── JwtConfig.kt                — creates JwtSigner + PasswordEncoder Spring beans
├── controller/
│   └── AuthController.kt           — POST /auth/signup, POST /auth/login
├── token/
│   ├── RefreshToken.kt             — JPA entity → auth.refresh_token table
│   └── RefreshTokenRepository.kt   — JPA repo, findByTokenHash()
└── user/
    ├── AuthUser.kt                 — JPA entity → auth.auth_user table
    └── AuthUserRepository.kt       — JPA repo, findByEmail(), findByUsername()
```

### Frontend — `Link-FE/`

React 19 + Vite + TypeScript + Chakra UI v3. Two source files.
`App.tsx` is a complete visual mockup — hardcoded channel names, hardcoded messages, input that sends nowhere. No routing, no HTTP calls.

---

## 2. Concepts explained from scratch

Before tracing the code, here are the building blocks you need to understand.

---

### 2.1 Why we never store plain passwords

Imagine the database leaks. If you stored `password123` as-is next to the email, every user's account on every site where they reuse that password is now compromised. The leak becomes a disaster.

The solution: store a **one-way hash** of the password instead of the password itself. When a user tries to log in, you hash what they typed and compare the two hashes. If they match, the password is correct. If the database leaks, the attacker gets hashes, not passwords.

**Why not SHA-256?**
SHA-256 is fast — it was designed for checksums, not security. An attacker with a GPU can try **billions** of SHA-256 hashes per second against a leaked database. Given most people use short passwords, most accounts crack in minutes.

**Why BCrypt?**
BCrypt is deliberately slow. It has a "work factor" (cost parameter) that makes each hash take ~100ms on your laptop. That cuts a GPU attack from billions-per-second to thousands-per-second — effectively making brute force unfeasible for good passwords.

BCrypt also automatically generates a random "salt" and embeds it in the output. Salt means two users with the same password still get different hashes, so an attacker cannot precompute a dictionary of hashes.

In code:
```kotlin
// on signup — hash once, store the result
val hash = passwordEncoder.encode("mypassword123")
// hash looks like: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

// on login — never decrypt; rehash the attempt and compare
val matches = passwordEncoder.matches("mypassword123", storedHash)  // true
val matches2 = passwordEncoder.matches("wrongpassword", storedHash) // false
```

`encode()` is a one-way function. There is no `decode()`. The only way to "check" a password is to hash it again and compare.

---

### 2.2 What a JWT is and what it contains

JWT stands for **JSON Web Token**. It is a compact, URL-safe string that carries claims (facts) about a user, signed by the server so nobody can tamper with it.

A JWT has three parts separated by dots: `header.payload.signature`

**Header** — metadata about the token:
```json
{ "alg": "RS256", "typ": "JWT" }
```

**Payload** — the actual claims (this is what downstream services read):
```json
{
  "sub": "42",
  "email": "alice@example.com",
  "username": "alice",
  "roles": ["ROLE_USER"],
  "iss": "link",
  "iat": 1714950000,
  "exp": 1714950900,
  "jti": "c2a1b3d4-..."
}
```

- `sub` — subject, i.e. the user's ID in our database
- `iss` — issuer, i.e. which system created this token ("link")
- `iat` — issued-at timestamp (Unix seconds)
- `exp` — expiry timestamp. After this time, the token is rejected
- `jti` — a unique ID for this specific token (prevents replay attacks if you build a revocation list)

**Signature** — a cryptographic proof that the header + payload have not been modified:
```
RS256(base64(header) + "." + base64(payload), privateKey)
```

The signature is what makes the JWT trustworthy. A service receiving a JWT can verify the signature using the public key. If anyone tampers with the payload (e.g. changes `"sub": "42"` to `"sub": "1"`), the signature check fails and the token is rejected.

**Important:** the payload is only base64-encoded, NOT encrypted. Anyone can decode and read it. Never put passwords or secrets inside a JWT.

---

### 2.3 Why RSA instead of a shared secret (HMAC)

There are two ways to sign JWTs:

**HMAC-SHA256 (symmetric):** One secret key is used for both signing and verification. Every service that needs to verify tokens must know the secret. If `messaging-service` is compromised, the attacker has the signing key and can forge tokens for any user.

**RS256 / RSA (asymmetric):** Two keys — a private key for signing and a public key for verification. Only `auth-service` has the private key. Every other service only gets the public key. With only the public key you can verify tokens, but you cannot create new ones. A compromised `messaging-service` cannot forge tokens.

```
auth-service:          signs with  →  private key (secret, only auth-service has this)
gateway:               verifies with → public key (safe to share)
user-service:          verifies with → public key
messaging-service:     verifies with → public key
```

The private key is committed to the repository **only for development**. In production it is loaded from an environment variable / secrets manager.

---

### 2.4 What a refresh token is and why we need it

Access tokens (the JWT in `LINK_SESSION`) expire after 15 minutes. This is intentional. If an access token leaks, the attacker can only use it for up to 15 minutes. Short expiry = limited blast radius.

But 15-minute sessions would be terrible UX — users would need to log in every 15 minutes. This is where refresh tokens solve the problem.

A refresh token is a long-lived (7-day) random secret stored server-side. When the access token expires, the frontend silently calls `POST /api/auth/refresh` with the refresh token cookie. The server looks it up, verifies it has not been revoked, and issues a fresh access token — without requiring the user to type their password again.

**Why store the hash in the database, not the raw token?**

For the same reason we hash passwords. If the `refresh_token` table leaks, we do not want attackers to find live tokens they can replay. We store `sha256(token)` and when a token arrives in a request, we hash what we received and compare that hash to the database. An attacker with the database dump gets SHA-256 hashes of random UUID strings — computationally useless.

```
Client holds:  "6ba7b810-9dad-11d1-80b4-00c04fd430c8"  (raw UUID)
DB stores:     "rL0Y20zC+Fzt72VPzMSk2A==" (sha256 of the UUID, base64-encoded)

On refresh request:
  hash(incoming_token) → compare to DB row → match = valid
```

---

### 2.5 Cookies and their security attributes

The browser has two storage options for auth tokens: `localStorage` and cookies.

**Why not localStorage?**
Any JavaScript running on the page can read `localStorage`. If your site is hit by an XSS attack (malicious script injected via a comment field, a third-party widget, etc.), the attacker's script can steal the token and exfiltrate it silently.

**Why HttpOnly cookies?**
An HttpOnly cookie is invisible to JavaScript. `document.cookie` does not list it. An XSS payload cannot read it. The browser sends it automatically on every request to the domain, but only HTTP infrastructure (the browser's network layer) can access it — not any script.

This is why both `LINK_SESSION` and `LINK_REFRESH` use `httpOnly(true)`.

---

**Cookie attributes explained one by one:**

```
Set-Cookie: LINK_SESSION=<jwt>;
  HttpOnly;                ← JavaScript cannot read this cookie
  Secure;                  ← browser only sends it over HTTPS (false in local dev)
  SameSite=Lax;            ← when to send on cross-site requests (see below)
  Path=/;                  ← sent on all paths on this domain
  Max-Age=900              ← expires after 900 seconds (15 min)

Set-Cookie: LINK_REFRESH=<token>;
  HttpOnly;
  Secure;
  SameSite=Strict;         ← stricter: never sent cross-site (see below)
  Path=/api/auth/refresh;  ← ONLY sent to this exact path
  Max-Age=604800           ← expires after 7 days
```

**SameSite=Lax** (for `LINK_SESSION`):
- The cookie IS sent when the user navigates to your site from an external link (top-level GET navigation).
- The cookie IS sent on all same-site requests (our frontend talking to our API).
- The cookie is NOT sent on cross-site sub-requests (images, iframes, XHR from other sites).
- This blocks classic CSRF: a malicious site embedding `<img src="yourapi.com/delete-account">` cannot trigger authenticated requests.

**SameSite=Strict** (for `LINK_REFRESH`):
- The cookie is NEVER sent on cross-site requests of any kind, including top-level navigation.
- Even more restrictive than Lax. Used for the refresh token because it is more sensitive (it lasts 7 days).

**Path=/api/auth/refresh** (for `LINK_REFRESH`):
- The browser only attaches this cookie to requests whose URL path starts with `/api/auth/refresh`.
- For every other API call — fetching messages, user profiles, workspaces — the refresh token cookie is never sent. Minimal exposure.

---

### 2.6 How the gateway fits in

The gateway runs on port 8080. The React frontend talks exclusively to port 8080. It never talks directly to auth-service (8081), user-service (8082), or messaging-service (8083).

```
Browser :5173
    │
    │  POST /api/auth/signup   (cookie on the way back)
    │  POST /api/auth/login    (cookie on the way back)
    │  GET  /api/users/me      (LINK_SESSION cookie sent)
    │
    ▼
Gateway :8080
    │
    │  Reads LINK_SESSION cookie
    │  Validates the JWT signature with the RSA public key
    │  Adds "Authorization: Bearer <jwt>" header
    │  Forwards to the right service
    │
    ├──→ auth-service     :8081   (for /api/auth/**)
    ├──→ user-service     :8082   (for /api/users/**)
    └──→ messaging-service:8083   (for everything else under /api/**)
```

**Why is this useful?**

1. The browser only needs to know one host and port. CORS only has to be configured in one place.
2. Downstream services never see cookies. They receive a clean `Authorization: Bearer` header. They run as standard Spring OAuth2 resource servers — no cookie parsing code anywhere except the gateway.
3. The cookie logic is isolated. If you change the cookie name or format, you change it in the gateway and auth-service only.
4. The gateway is the right place to add rate limiting, request logging, and circuit breakers later.

The gateway is NOT yet implemented (Day 5). For now, in development you hit auth-service directly on port 8081.

---

## 3. What happens during signup — step by step

Let's trace `POST /api/auth/signup` with `{"email":"alice@example.com","username":"alice","password":"secret123"}`.

**Step 1 — JSON arrives at AuthController.signup()**

Spring deserializes the request body into a `SignupRequest` data class. This happens automatically because the class is annotated via the `@RestController` + `@RequestBody` chain.

**Step 2 — Validation**

```kotlin
if (req.email.isBlank() || !req.email.contains("@"))
    return 400 Bad Request

if (req.username.length < 3 || req.username.length > 50)
    return 400 Bad Request

if (req.password.length < 8)
    return 400 Bad Request
```

Simple rules: email must contain @, username 3–50 chars, password at least 8 chars. This runs entirely in memory — no database query yet.

**Step 3 — Uniqueness check**

```kotlin
if (users.findByEmail("alice@example.com") != null)
    return 409 Conflict  // "Email is already registered"

if (users.findByUsername("alice") != null)
    return 409 Conflict  // "Username is already taken"
```

Two `SELECT` queries against `auth.auth_user`. We return 409 (not 400) because the input format is valid — the problem is a conflict with existing data. This lets the frontend show a specific message ("that email is taken") rather than a generic error.

**Step 4 — Password hashing**

```kotlin
val hash = passwordEncoder.encode("secret123")
// → "$2a$10$someRandomSaltEmbeddedHere..."
```

BCrypt runs. This takes ~100ms intentionally. The result is a 60-character string that includes the salt, the cost factor, and the hash — everything needed to verify the password later.

**Step 5 — Save the user**

```kotlin
val user = users.save(AuthUser(
    email = "alice@example.com",
    username = "alice",
    displayName = "alice",
    passwordHash = "$2a$10$..."
))
// user.id is now 1 (assigned by Postgres SERIAL)
```

One `INSERT` into `auth.auth_user`. Postgres assigns an auto-incremented `id`.

**Step 6 — Mint the JWT**

```kotlin
val jwt = jwtSigner.sign(
    userId = 1L,
    email = "alice@example.com",
    username = "alice"
)
```

`JwtSigner` builds a JWT payload with those values plus `iss="link"`, `iat=now`, `exp=now+900s`, `jti=randomUUID`. Signs it with the RSA private key. Returns a compact string like:

```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJhbGljZUBleGFtcGxlLmNvbSIsInVzZXJuYW1lIjoiYWxpY2UiLCJyb2xlcyI6WyJST0xFX1VTRVIiXSwiaXNzIjoibGluayIsImlhdCI6MTcxNDk1MDAwMCwiZXhwIjoxNzE0OTUwOTAwLCJqdGkiOiJjMmExYjNkNC4uLiJ9.<signature>
```

**Step 7 — Generate and store the refresh token**

```kotlin
val rawRefresh = UUID.randomUUID().toString()
// → "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

tokens.save(RefreshToken(
    userId = 1L,
    tokenHash = sha256(rawRefresh),    // stored: hash of the UUID
    expiresAt = now + 7 days
))
```

The raw UUID is what will go into the cookie. The hash is what is stored in the database. If the database leaks, only the hashes are exposed — they cannot be used directly.

**Step 8 — Build the cookie headers**

```kotlin
val sessionCookie = ResponseCookie.from("LINK_SESSION", jwt)
    .httpOnly(true).secure(false).sameSite("Lax").path("/").maxAge(900)
    .build()

val refreshCookie = ResponseCookie.from("LINK_REFRESH", rawRefresh)
    .httpOnly(true).secure(false).sameSite("Strict").path("/api/auth/refresh").maxAge(604800)
    .build()
```

`ResponseCookie` is Spring's way to build a `Set-Cookie` header string with all the security attributes correctly formatted.

**Step 9 — Return 201 Created**

```kotlin
return ResponseEntity.status(201).headers(headers).build()
```

The HTTP response has no body — the cookies say everything. The browser stores both cookies automatically (HttpOnly means it cannot read them, but it will send them).

---

## 4. What happens during login — step by step

`POST /api/auth/login` with `{"email":"alice@example.com","password":"secret123"}`.

**Step 1 — Find user by email**

```kotlin
val user = users.findByEmail("alice@example.com") ?: return 401
```

One `SELECT` from `auth.auth_user`. If the email does not exist, return 401. We use the same "Invalid credentials" message whether the email is wrong or the password is wrong — this prevents an attacker from learning which emails are registered (user enumeration).

**Step 2 — Verify the password**

```kotlin
if (!passwordEncoder.matches("secret123", user.passwordHash))
    return 401
```

BCrypt extracts the salt from `user.passwordHash`, hashes the incoming `"secret123"` with that same salt, and compares. This takes ~100ms. If they match, the password is correct.

**Step 3 — Same as signup steps 6–9**

Mint a new JWT, generate a new refresh token, save it, build cookies, return 204 No Content.

---

## 5. The full auth-service file structure explained

### `config/JwtConfig.kt`

```kotlin
@Configuration
class JwtConfig {
    @Bean
    fun jwtSigner(): JwtSigner = JwtSigner(KeyLoader.privateKey())
    
    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()
}
```

A `@Configuration` class is Spring's way of declaring beans — objects managed by the Spring container. When `AuthController` declares `private val jwtSigner: JwtSigner` in its constructor, Spring looks for a bean of type `JwtSigner` and injects the one created here.

`KeyLoader.privateKey()` reads `keys/private.pem` from the classpath. Since `shared-jwt` is a Gradle dependency of `auth-service`, its `resources/keys/` folder is on auth-service's classpath automatically.

### `config/SecurityConfig.kt`

```kotlin
http
    .csrf { it.disable() }
    .sessionManagement { it.sessionCreationPolicy(STATELESS) }
    .authorizeHttpRequests { it.anyRequest().permitAll() }
```

- `csrf disabled` — we use SameSite cookies so CSRF tokens are not needed for the MVP.
- `STATELESS` — Spring Security must not create an HTTP session. We are cookie-based not session-based (the cookie carries a self-contained JWT, not a session ID).
- `permitAll` — every request is allowed. This is a placeholder. When Day 4 adds `GET /auth/me`, that endpoint will require a valid JWT, so this config will be updated to permit only `/auth/signup` and `/auth/login`.

### `token/RefreshToken.kt`

```kotlin
@Entity
@Table(name = "refresh_token", schema = "auth")
class RefreshToken(
    val userId: Long,
    val tokenHash: String,     // SHA-256 of the raw token
    val expiresAt: Instant,
    var revokedAt: Instant? = null
) {
    @Id @GeneratedValue(strategy = IDENTITY)
    val id: Long? = null
}
```

`@Entity` + `@Table` tells Hibernate this class maps to the `auth.refresh_token` table. Hibernate creates this table automatically on startup because `spring.jpa.hibernate.ddl-auto=update` is set.

`revokedAt` is `null` for valid tokens and set to the current timestamp when the token is explicitly revoked (logout). On Day 4, the refresh endpoint will check `revokedAt == null` before issuing a new access token.

### `controller/AuthController.kt`

The controller is annotated `@RestController` (every method returns JSON) and `@RequestMapping("/auth")` (all routes start with `/auth`). It takes four constructor-injected dependencies:
- `users` — queries the user table
- `tokens` — queries the refresh token table
- `jwtSigner` — signs JWTs
- `passwordEncoder` — hashes and verifies passwords

Spring injects these automatically because they are all declared as `@Bean`s or `@Repository`-annotated interfaces.

---

## 6. What's NOT working right now

| Feature | State |
|---|---|
| Start Postgres | `docker compose -f infra/docker-compose.yml up` works |
| Start auth-service | Starts, creates both DB tables, listens on 8081 |
| `POST /auth/signup` | **Works** — run `curl` test below |
| `POST /auth/login` | **Works** — run `curl` test below |
| `POST /auth/refresh` | Not implemented (Day 4) |
| `POST /auth/logout` | Not implemented (Day 4) |
| `GET /auth/me` | Not implemented (Day 4) |
| Gateway | Not implemented (Day 5) |
| Frontend routing | Not implemented (Day 6) |
| Frontend API calls | Not implemented (Day 6) |

---

## 7. How to test what's built right now

```bash
# 1. Start Postgres
docker compose -f infra/docker-compose.yml up -d

# 2. Start auth-service from IntelliJ (run AuthServiceApplication)

# 3. Signup
curl -v -X POST http://localhost:8081/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","username":"alice","password":"secret123"}'
# Expect: HTTP/1.1 201
# Expect: two Set-Cookie headers in the response

# 4. Login
curl -v -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret123"}'
# Expect: HTTP/1.1 204, two Set-Cookie headers

# 5. Wrong password
curl -v -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"wrongpassword"}'
# Expect: HTTP/1.1 401

# 6. Duplicate signup
curl -v -X POST http://localhost:8081/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","username":"alice","password":"secret123"}'
# Expect: HTTP/1.1 409, {"message":"Email is already registered"}
```

---

## 8. The next thing to build — Day 4

`POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.

These three endpoints complete the auth-service. After Day 4, the auth contract is finished and Day 5 (the gateway) can be built.

**`POST /auth/refresh`:**
- Read `LINK_REFRESH` cookie value from the request.
- SHA-256 hash it.
- Look up `RefreshTokenRepository.findByTokenHash(hash)`.
- Check: exists? not revoked? not expired?
- If all good: load the user, mint a new JWT + new refresh token, revoke the old refresh token (rotation), return 204 + new cookies.
- Rotation means each refresh token can only be used once. If an attacker somehow gets a refresh token and uses it, the next legitimate use will fail (the token is already revoked), alerting the user to log in again.

**`POST /auth/logout`:**
- Read `LINK_REFRESH` cookie.
- Hash it, find in DB, set `revokedAt = now`.
- Return 204 with `Max-Age=0` on both cookies (tells the browser to delete them immediately).

**`GET /auth/me`:**
- This endpoint requires a valid JWT (update `SecurityConfig` to enforce auth on this path).
- Spring Security parses the `Authorization: Bearer` header (added by the gateway in production; in local dev, pass it manually in the curl).
- Read the JWT subject claim (`sub` = userId), return it as JSON.
- Used by the frontend as a "are you still logged in?" check on page load.

---

## 9. Phase map

```
Phase 1 — 3-week MVP (in progress)
  Week 1: auth endpoints + gateway + frontend auth pages
    ✅ Day 1 — repo structure, Gradle multi-project, Docker infra
    ✅ Day 2 — shared-jwt library (KeyLoader, JwtSigner, Claims, RSA keys)
    ✅ Day 3 — auth-service: POST /auth/signup + POST /auth/login  ← DONE TODAY
    ⬜ Day 4 — auth-service: POST /auth/refresh, POST /auth/logout, GET /auth/me
    ⬜ Day 5 — gateway: JWT cookie filter + routing + CORS
    ⬜ Day 6 — frontend: routing + login/signup pages + protected route
    ⬜ Day 7 — buffer/smoke test
  Week 2: workspaces, channels, messages (REST)
  Week 3: WebSocket real-time + demo polish

Phase 2 — rest of semester 1
  DMs, threads, reactions, file-service, RBAC enforcement, tests, CI

Semester 2
  Video (WebRTC), payments (Stripe), notifications, observability, deployment
```

---

## 10. Technology decisions at a glance

| Decision | What was chosen | Why |
|---|---|---|
| Password hashing | BCrypt | Deliberately slow; embeds its own salt; industry standard |
| Auth transport | HttpOnly cookie carrying a JWT | JWT gives stateless identity; cookie keeps it out of JS (XSS resistance) |
| JWT algorithm | RS256 (RSA-2048) | Only auth-service needs the private key; other services verify with the public key only |
| Refresh token storage | SHA-256 hash in DB, raw in cookie | DB leak cannot be replayed; same principle as password hashing |
| Microservice boundary | Schema-per-service, one Postgres | Logical isolation without operating a fleet of databases for a thesis project |
| Gateway pattern | All browser traffic through one port | Browser only needs one origin; cookie never reaches business code |
| Real-time protocol | STOMP over WebSocket (planned Day 15) | First-class Spring support; pub/sub built in |
| Frontend state split | TanStack Query + Zustand (planned Day 6) | Query handles server cache; Zustand handles local UI — each does one thing well |
| Dev keypair committed | Yes, in shared-jwt resources | Eliminates setup friction; prod keys override via env |
| Service discovery | Static docker-compose hostnames | Eureka/Consul adds operational complexity with no benefit at this scale |
