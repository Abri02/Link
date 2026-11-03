# Link — Corporate Messaging Platform

A Slack/Teams-style corporate messenger built as a thesis project across two semesters.
Users create **workspaces**, organize into **channels** or **DMs**, exchange real-time
messages with **threads**, **reactions**, and **file sharing**, run **video chat**, and pay
for **premium subscriptions**. Multi-level RBAC separates **owner / admin / member /
guest** roles.

This README is the planning document. It describes the target system, the
architecture decisions, and a step-by-step roadmap with a concrete 3-week MVP
milestone for the first demo.

---

## 1. Specification (from the assignment)

> Vállalati üzenetkezelő alkalmazás Spring és React platformon — workspaces,
> channels, DMs, threads, emoji reactions, file sharing, video chat,
> multi-level RBAC (owner / admin / guest), premium subscription payment, and
> WebSocket-driven realtime messaging and presence.

### Functional requirements

- **Authentication**: signup, login, logout. Session is carried by an HttpOnly,
  Secure cookie; backend mints a short-lived JWT inside the cookie.
- **Workspaces**: a user can create and join multiple workspaces. Each workspace
  has an owner, admins, members, and optionally guests with restricted access.
- **Channels**: thematic rooms inside a workspace. Public (any member can join)
  and private (invite-only).
- **Direct messages (DMs)**: 1-on-1 and small group conversations outside any
  channel.
- **Messages**: text first; later threads, edits, deletes, mentions, links.
- **Reactions**: emoji reactions on messages.
- **File sharing**: upload images, documents; show inline previews where possible.
- **Realtime**: messages, reactions, typing indicators, and presence delivered
  via WebSocket without page reload.
- **Video chat**: 1-on-1 and small-group video/audio calls.
- **Payments**: subscription tier (Stripe) that unlocks premium features (e.g.
  unlimited message history, larger file uploads, more guests).
- **RBAC**: enforced on every protected endpoint and every WebSocket event.

### Non-functional requirements

- Microservice architecture with a single API gateway as the public surface.
- Cookie-based auth (HttpOnly, SameSite=Lax, Secure in prod).
- Containerized — `docker compose up` brings the whole stack up locally.
- All services share a common JWT validation contract (resource-server pattern).

---

## 2. Technology stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Backend language | **Kotlin 2.2** | required by assignment, modern JVM language |
| Backend framework | **Spring Boot 4** | required by assignment |
| Persistence | **Spring Data JPA + PostgreSQL** | rich ecosystem, easy auditing |
| Auth | **Spring Security + OAuth2 Resource Server (JWT)** | already on classpath; the cookie carries the JWT |
| Realtime | **Spring WebSocket + STOMP** | first-class Spring support |
| Gateway | **Spring Cloud Gateway** | routes traffic, handles cookie→JWT bridging |
| Service discovery | **Static config in `docker-compose`** for now; add Eureka/Consul only if needed later | keep simple |
| Files | **MinIO** (S3-compatible) | local dev parity with prod |
| Video signaling | **WebRTC** (P2P) with WebSocket signaling. Stretch: SFU (LiveKit) for >2 participants | low infra cost for MVP |
| Payments | **Stripe Checkout + webhooks** | industry standard, sandbox-friendly |
| Frontend | **React 19 + TypeScript + Vite** | required by assignment |
| UI / styling | **Chakra UI** | accessible component library, theme-driven, no utility-class soup. Tailwind/shadcn scaffolding currently in `Link-FE` will be removed in week 1 day 6. |
| Frontend state | **TanStack Query** for server state, **Zustand** for client state | small, reliable |
| Frontend routing | **react-router** | standard |
| Build / orchestration | **Docker Compose** | dev + demo |
| CI | **GitHub Actions** | build + test on every push |

> Items in *italics* below are **stretch** goals — schedule them only after the
> required path is green.

---

## 3. Architecture

### 3.1 High-level diagram

```
                        ┌──────────────────────┐
                        │     React (Vite)     │
                        │  Link-FE  (browser)  │
                        └──────────┬───────────┘
                                   │  HTTPS, HttpOnly cookie
                                   ▼
                        ┌──────────────────────┐
                        │     API Gateway      │   Spring Cloud Gateway
                        │  cookie → JWT → Auth │   - validates session cookie
                        │       header         │   - rewrites to Bearer JWT
                        └─┬──────┬──────┬──────┘
                          │      │      │
              ┌───────────┘      │      └──────────────┐
              ▼                  ▼                     ▼
      ┌──────────────┐   ┌──────────────┐      ┌──────────────┐
      │ auth-service │   │ user-service │      │ messaging-   │
      │  signup,     │   │  profiles,   │      │   service    │
      │  login,      │   │  presence    │      │ workspaces,  │
      │  cookie/JWT  │   │              │      │ channels,    │
      └──────┬───────┘   └──────┬───────┘      │ messages, WS │
             │                  │              └──────┬───────┘
             ▼                  ▼                     ▼
                       ┌────────────────────┐
                       │     PostgreSQL     │   one DB instance,
                       │  schema-per-service│   schema per service
                       └────────────────────┘

  Phase 2 / Semester 2 additions:
   • file-service       (MinIO blob storage)
   • video-service      (WebRTC signaling, optional SFU)
   • payment-service    (Stripe Checkout + webhook)
   • notification-service
```

### 3.2 Why a gateway

The browser holds **one** HttpOnly cookie. The gateway is the only component
that knows how to read it. Internally, every downstream service sees a normal
`Authorization: Bearer <jwt>` header and runs as a stock Spring resource server.
This keeps each microservice simple and testable in isolation, and the cookie
never reaches business code.

### 3.3 Auth flow (cookie + JWT)

1. `POST /api/auth/signup` or `/api/auth/login` → **auth-service** validates
   credentials, mints a short-lived JWT (15 min) and a refresh token (7 days,
   stored server-side in `refresh_tokens` table). It returns:
   - `Set-Cookie: LINK_SESSION=<access_jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900`
   - `Set-Cookie: LINK_REFRESH=<refresh>; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=604800`
2. The browser sends both cookies on every subsequent call.
3. The **gateway** reads `LINK_SESSION`, validates the JWT signature, and
   forwards the request with `Authorization: Bearer <jwt>` to the right service.
4. When the access token expires, the gateway returns 401. The frontend calls
   `POST /api/auth/refresh`, which uses `LINK_REFRESH` to issue a new
   `LINK_SESSION` cookie.
5. `POST /api/auth/logout` clears both cookies and revokes the refresh token.

> **CSRF**: with `SameSite=Lax` cookies and JSON-only API consumers we can skip
> double-submit tokens in MVP, but add CSRF tokens before the payment flow ships.

### 3.4 Repository layout

```
Link/
├── Link-BE/                    # current scaffold — to be split
│   ├── gateway/
│   ├── auth-service/
│   ├── user-service/
│   ├── messaging-service/
│   └── shared-jwt/             # tiny library: JWT keys, claim constants
├── Link-FE/                    # React app (Chakra UI)
├── infra/
│   ├── docker-compose.yml      # postgres, minio, all services
│   └── postgres/init.sql       # schemas: auth, users, messaging
└── README.md                   # this file
```

> Each service is its own Gradle subproject under `Link-BE/`. We keep one
> Gradle multi-project root so shared code (DTOs, JWT utilities) lives in one
> place.

### 3.5 Data model (initial)

**auth schema**
- `auth_user` — id, email, username, password_hash, created_at
- `refresh_token` — id, user_id, token_hash, expires_at, revoked_at

**users schema**
- `user_profile` — id (= auth_user.id), display_name, avatar_url, status
- `user_presence` — user_id, last_seen_at, online (boolean)

**messaging schema**
- `workspace` — id, name, slug, owner_id, created_at
- `workspace_member` — workspace_id, user_id, role (OWNER/ADMIN/MEMBER/GUEST)
- `channel` — id, workspace_id, name, kind (PUBLIC/PRIVATE/DM), created_by
- `channel_member` — channel_id, user_id
- `message` — id, channel_id, author_id, body, created_at, edited_at, deleted_at, parent_message_id (for threads)
- `message_reaction` — message_id, user_id, emoji
- *(later)* `attachment` — id, message_id, file_id, mime, size

### 3.6 Role matrix (RBAC)

Workspace roles live in `workspace_member.role`, not in the JWT. Every action also requires
workspace membership. Channel-scoped actions (read, post, react, attachments, WS subscribe)
also require `channel_member` membership.

✅ allowed · ❌ forbidden (403)

| Action | OWNER | ADMIN | MEMBER | GUEST | Status |
| --- | :---: | :---: | :---: | :---: | --- |
| Read channels they belong to | ✅ | ✅ | ✅ | ✅ | enforced |
| Post messages (incl. thread replies, attachments) | ✅ | ✅ | ✅ | ✅ | guests blocked today, opened in B6 |
| React to messages | ✅ | ✅ | ✅ | ✅ | guests blocked today, opened in B6 |
| Edit / delete own messages | ✅ | ✅ | ✅ | ✅ | enforced (author only) |
| Delete others' messages | ✅ | ✅ | ❌ | ❌ | B5 (today: author only) |
| Create channel | ✅ | ✅ | ❌ | ❌ | enforced |
| Invite / add member | ✅ | ✅ | ❌ | ❌ | enforced |
| Choose invitee role (MEMBER / GUEST) | ✅ | ✅ | ❌ | ❌ | B6 |
| Change member role | ✅ | ❌ | ❌ | ❌ | B3. The last OWNER can't be demoted (409) |
| Remove member | ✅ | ✅¹ | ❌ | ❌ | B4 |
| Leave workspace | ✅² | ✅ | ✅ | ✅ | B4 |
| Open a DM | ✅ | ✅ | ✅ | ❌ | enforced |
| Manage billing (premium subscription) | ✅ | ❌ | ❌ | ❌ | F3 |

¹ An ADMIN can't remove an OWNER.
² The last OWNER can't leave.

Guests can only see and use the channels they were added to. Hiding a button in the UI is
cosmetic. The backend enforces every row above.

---

## 4. Roadmap

The work is split into three time buckets:

- **Phase 1 — 3 weeks: MVP demo.** Microservice skeleton + cookie auth +
  one workspace, one channel, realtime messages.
- **Phase 2 — rest of semester 1.** Round out the messaging product: threads,
  reactions, files, RBAC, polished UI, tests.
- **Semester 2.** Video chat, payments, notifications, observability,
  deployment.

### 4.1 Phase 1 — 3-week MVP (the demo)

**Demo goal.** Two browsers, two accounts. Both log in (cookie auth visible in
DevTools). Both join the same workspace, open the same channel, and chat in
real time. A third browser without auth gets redirected to login. The whole
stack runs from a single `docker compose up`.

> Each week ends with a working, demoable slice. Don't move on if the prior
> week's slice is broken.

#### Week 1 — Foundation (microservice skeleton + cookie auth + Chakra swap)

**Outcome at end of week:** I can sign up and log in from the React app, see my
profile at `/me`, and the `LINK_SESSION` cookie is visible in DevTools. The
frontend is rendered with Chakra UI components (no Tailwind/shadcn left).

- Day 1 — **Repo restructure.**
  - Convert `Link-BE` into a Gradle multi-project root.
  - Create empty subprojects: `gateway`, `auth-service`, `user-service`,
    `messaging-service`, `shared-jwt`.
  - Move the existing `LinkUser` code into `auth-service` (rename to `AuthUser`).
  - Add `infra/docker-compose.yml` with `postgres:16` and an `init.sql` that
    creates `auth`, `users`, `messaging` schemas.
- Day 2 — **`shared-jwt` library.**
  - RSA keypair (dev keys committed; prod keys via env). Helper to sign and
    verify JWTs. Claim constants (`sub`, `email`, `roles`).
- Day 3 — **`auth-service` part 1: signup/login.**
  - `POST /auth/signup` — validates email + password (BCrypt), inserts user.
  - `POST /auth/login` — validates credentials, mints access + refresh, sets
    both cookies, returns 204.
- Day 4 — **`auth-service` part 2: refresh + logout + `/auth/me`.**
  - `POST /auth/refresh` — rotates access token using `LINK_REFRESH`.
  - `POST /auth/logout` — revokes refresh token, clears both cookies.
  - `GET /auth/me` — returns the JWT subject as a sanity check.
- Day 5 — **Gateway.**
  - Spring Cloud Gateway. Reads `LINK_SESSION` cookie, validates JWT,
    forwards to downstream as `Authorization: Bearer …`.
  - Routes: `/api/auth/**` → auth-service; `/api/users/**` → user-service;
    `/api/**` (rest) → messaging-service.
  - CORS allowing `http://localhost:5173` with credentials.
- Day 6 — **Frontend: swap to Chakra UI + auth pages.**
  - Remove `tailwindcss`, `@tailwindcss/vite`, `shadcn`, `class-variance-authority`,
    `tailwind-merge`, `tw-animate-css` from `package.json`. Drop `index.css`
    Tailwind directives. Delete `components/ui/button.tsx` and `lib/utils.ts`
    (they're shadcn helpers).
  - Install `@chakra-ui/react`, `@emotion/react`, `@emotion/styled`,
    `framer-motion`. Wrap `main.tsx` in `<ChakraProvider>` with a Chakra theme.
  - Add `react-router`, `@tanstack/react-query`, `zustand`.
  - Rebuild the existing Slack-style layout in `App.tsx` using Chakra
    primitives (`Flex`, `Box`, `VStack`, `Text`, `Input`, `IconButton`).
  - Build `/login` and `/signup` pages with Chakra `FormControl`, `Input`,
    `Button`.
  - `fetch` wrapper that sends `credentials: "include"` and handles 401 by
    redirecting to `/login`.
  - Protected route wrapper that calls `/api/auth/me` on mount.
- Day 7 — **Buffer / polish.**
  - First end-to-end test: sign up two users, both stay logged in across
    refresh, both can log out.
  - Commit a `docker compose up && cd Link-FE && npm run dev` quickstart in
    the README.

#### Week 2 — Core domain (workspaces, channels, messages over REST)

**Outcome at end of week:** Logged-in users can create a workspace, create a
channel, and post messages. Messages persist and are visible after reload, but
delivery is still per-request — realtime comes in week 3.

- Day 8 — **`user-service`.**
  - `GET /users/me` — joins `auth_user` + `user_profile`.
  - `PATCH /users/me` — update displayName, avatar.
  - On first call, lazily insert into `user_profile` if missing (or do this
    on signup via an internal call from auth-service — pick one and document).
- Day 9 — **`messaging-service` schema and entities.**
  - `Workspace`, `WorkspaceMember`, `Channel`, `ChannelMember`, `Message`
    JPA entities. Flyway/Liquibase migration creating the `messaging` schema
    tables.
- Day 10 — **Workspaces and members API.**
  - `POST /workspaces` — create; creator becomes OWNER.
  - `GET /workspaces` — list workspaces I'm a member of.
  - `POST /workspaces/{id}/members` — add member by user id (OWNER/ADMIN only).
- Day 11 — **Channels API.**
  - `POST /workspaces/{id}/channels` — create channel.
  - `GET /workspaces/{id}/channels` — list channels.
  - Auto-add creator as member; auto-create `general` on workspace creation.
- Day 12 — **Messages API (REST only — no WS yet).**
  - `POST /channels/{id}/messages` — append.
  - `GET /channels/{id}/messages?before=…&limit=50` — page backwards.
  - Authorization check: caller must be a `ChannelMember`.
- Day 13 — **Frontend wiring (Chakra).**
  - Workspace switcher in the narrow sidebar (`VStack` of `Avatar`s).
  - Channel list in the wide sidebar — `List` + `ListItem`, replace the
    hardcoded `general` / `development` items.
  - Message list calls `GET …/messages` on channel select; render with
    `Stack` of message rows (`HStack` avatar + `VStack` author + body).
  - Message composer: Chakra `Input` + `IconButton`, calls `POST …/messages`.
- Day 14 — **Buffer / polish.**
  - Empty states, loading states (`Spinner`), error toasts (`useToast`).
  - Seed script: one workspace, one channel, two members, ten messages.

#### Week 3 — Realtime + demo prep

**Outcome at end of week:** Two browsers. User A sends a message; user B sees
it appear instantly. Online dots light up next to members. The demo runs from
a clean `docker compose up`.

- Day 15 — **WebSocket endpoint in `messaging-service`.**
  - STOMP over WebSocket at `/ws`. Authentication: gateway forwards the JWT
    as a `Cookie` header on the WS handshake; messaging-service validates it.
  - Topics: `/topic/channel.{channelId}` for new messages.
- Day 16 — **Publish on send.**
  - `POST /channels/{id}/messages` — after persisting, publish to
    `/topic/channel.{id}`.
  - Test with two browsers.
- Day 17 — **Frontend WS client.**
  - `@stomp/stompjs` client. Subscribe on channel mount, unsubscribe on
    unmount. Append incoming messages to the React Query cache.
- Day 18 — **Presence.**
  - `user-service` tracks online status: increment on WS connect, decrement on
    disconnect. Publish `user.{id}.presence` events. Frontend shows a Chakra
    `Avatar` with a green status dot in the member list.
- Day 19 — **Demo polish.**
  - Avatars, timestamps, message grouping by author within 5 minutes. Define a
    Chakra theme (`extendTheme`) so colors and radii are consistent.
  - Logout button in the top bar.
- Day 20 — **Demo dry run.**
  - `docker compose down -v && docker compose up`. Run the demo script end
    to end. Fix anything that surprises you.
- Day 21 — **Buffer.** Slack for slippage. If everything works, write the
  demo speaker notes and record a short screen capture as backup.

**Acceptance checklist for the week-3 demo**

- [ ] `docker compose up` brings up gateway + 3 services + Postgres.
- [ ] React app at `localhost:5173` lets a new user sign up.
- [ ] Login sets `LINK_SESSION` (HttpOnly, visible in DevTools cookies).
- [ ] Logged-out users hitting any `/api/**` get 401, frontend redirects to login.
- [ ] User A sends a message in `#general`; User B sees it within ~500 ms.
- [ ] Hard refresh: still logged in (cookie survives), messages still there.
- [ ] Logout clears the cookie and the WebSocket disconnects.
- [ ] No Tailwind classes anywhere in `Link-FE/src`; UI is pure Chakra.

### 4.2 Phase 2 — rest of semester 1

Order matters: each block builds on the previous one. Treat each as ~1 week
unless noted.

1. **DMs and group DMs.** Reuse `Channel` with `kind = DM`.
2. **Threads.** `Message.parent_message_id` already in schema; expose
   `GET /messages/{id}/thread` and a thread sidebar in the UI (Chakra
   `Drawer`).
3. **Reactions.** `POST/DELETE /messages/{id}/reactions/{emoji}`. Aggregate
   counts in the message DTO. Use Chakra `Popover` for the emoji picker.
4. **File sharing — `file-service`.**
   - New microservice. MinIO container in `docker-compose`. Pre-signed upload
     URLs. `attachment` table in `messaging` schema referencing the file id.
   - Inline image preview in messages.
5. **RBAC enforcement pass.**
   - Codify the role matrix (OWNER/ADMIN/MEMBER/GUEST × every endpoint) in a
     table in this README.
   - Spring Security `@PreAuthorize` on every controller method.
   - Guests can post and react in the channels they belong to (see §3.6).
6. **Polish.**
   - Edit + delete messages.
   - Message search within a channel (Postgres full-text is enough for now;
     leave Elasticsearch for semester 2).
   - Mentions (`@username`) with notifications.
7. **Tests.**
   - JUnit 5 unit tests for each service's domain logic.
   - One Spring Boot integration test per service exercising the happy-path
     controller.
   - One Playwright end-to-end test that signs up, sends a message, and
     verifies it appears in a second browser tab.
8. **CI.** GitHub Actions: build all services, run tests, build the frontend.

End-of-semester-1 deliverable: a working corporate messenger. Threads,
reactions, files, RBAC, presence, realtime. Everything but video and payments.

### 4.3 Semester 2

Listed in the order they should ship. Each is roughly 1–2 weeks.

1. **Video chat — `video-service`.**
   - WebRTC peer-to-peer for 1-on-1.
   - Spring WebSocket as the signaling channel.
   - Stretch: integrate **LiveKit** (open-source SFU) for >2 participants.
2. **Payment — `payment-service`.**
   - Stripe Checkout for the subscription. Webhook receiver updates the
     workspace's `plan` column.
   - Premium gates (e.g. "free workspaces capped at 30-day history") enforced
     in messaging-service.
   - Add CSRF tokens before this ships (cookie + same-origin form post is the
     classic CSRF target).
3. **Notification service.**
   - Fan-out: in-app (already covered by WS) + email (SMTP) + browser push
     (Web Push API) for offline users.
4. **Search.** Elasticsearch. messaging-service publishes message events; an
   indexer service consumes them.
5. **Observability.** OpenTelemetry traces, Prometheus metrics, Grafana
   dashboards. One `traceId` from the gateway to every service.
6. **Hardening.**
   - Rate limiting at the gateway.
   - CSRF tokens.
   - Audit log for owner/admin actions.
   - Migrate JWT signing keys out of the repo.
7. **Deployment.** Kustomize / Helm chart for k8s, or a simple cloud-VM
   deployment with `docker compose` if k8s isn't required.
8. **Thesis writing.** Specification, architecture chapter, technology
   chapter, screenshots, evaluation.

---

## 5. What's already done

- Gradle build with Spring Boot 4 + Kotlin 2.2 + JPA + Security + WebSocket +
  OAuth2 resource server (`Link-BE/build.gradle.kts`).
- Skeleton `LinkUser` entity, repository, service, controller — will be moved
  into `auth-service` on day 1.
- React + Vite scaffold with a static Slack-style layout in
  `Link-FE/src/App.tsx`. Currently uses Tailwind/shadcn — to be replaced with
  Chakra UI on day 6.

## 6. Open questions / decisions to confirm

- **Service discovery**: stick with static `docker-compose` URLs or add Eureka?
  Recommendation: static, until there's a real reason.
- **Migrations**: Flyway or Liquibase? Recommendation: Flyway (simpler).
- **Frontend state**: TanStack Query + Zustand (above) or Redux Toolkit?
  Recommendation: stay with the lighter pair.
- **Video for >2 participants**: P2P mesh (cheap, breaks at ~4 peers) or
  LiveKit SFU (more infra)? Decide in semester 2.
- **Hosting for the final demo**: localhost on the laptop, a single VM, or
  cloud?

## 7. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Microservice split eats week 1 | High | High | Keep services tiny in week 1: one entity, two endpoints. Resist gold-plating. |
| WebSocket auth via gateway is fiddly | Medium | High | Allocate full day 15 to it. Fallback: WS connects directly to messaging-service with the cookie, bypassing the gateway. |
| Chakra swap drags into week 2 | Medium | Medium | Time-box day 6 to half a day for the swap, half for auth pages. Don't reskin every component pixel-perfect — get parity, polish later. |
| Stripe webhooks need a public URL | Medium | Medium | Use `stripe listen` (Stripe CLI) in dev — no tunnel needed. |
| WebRTC NAT traversal needs a TURN server | Medium | Medium | Use a free public STUN for dev; only stand up `coturn` if peer connections fail in the demo. |
| Scope creep into semester 2 features | High | Medium | Treat the week-3 acceptance checklist as a hard line. Anything not on it waits. |

---

## 8. Local development quickstart

### Option A — Dev mode (services run in your IDE / terminal)

Starts only Postgres. Run Spring Boot services and the frontend yourself.

```bash
# Terminal 1 — backing services
docker compose -f infra/docker-compose.yml up -d

# Terminal 2-5 — each Spring Boot service (or run from IntelliJ)
cd Link-BE
./gradlew :auth-service:bootRun
./gradlew :user-service:bootRun
./gradlew :messaging-service:bootRun
./gradlew :gateway:bootRun

# Terminal 6 — frontend
cd Link-FE && npm install && npm run dev   # → http://localhost:5173
```

### Option B — Full stack (everything in Docker)

Builds and starts all services from a single command. First build takes a few minutes.

```bash
docker compose -f infra/docker-compose.full.yml up --build
```

The gateway is available at `http://localhost:8080`. Start the frontend separately:

```bash
cd Link-FE && npm install && npm run dev   # → http://localhost:5173
```

Tear down and wipe data:

```bash
docker compose -f infra/docker-compose.full.yml down -v
```

### Running E2E tests

Requires the full stack running (Option A or B) plus the frontend dev server.

```bash
cd Link-FE
npx playwright test
```

> **Prerequisites:** Docker Desktop (or Docker Engine + Compose v2), Node.js ≥ 20, JDK 24 (dev mode only).
> The gateway listens on `localhost:8080`; the React dev server on `localhost:5173`.
> Hot-reload is enabled — edits to `Link-FE/src` reflect immediately in the browser.

---

## 9. Implementation progress

> Update this section at the end of each day. Checked = merged to `main` and working.

### Phase 1 — Week 1 (Foundation)

- [x] **Day 1** — Repo restructure: Gradle multi-project (`shared-jwt`, `auth-service`, `user-service`, `messaging-service`, `gateway`). `LinkUser` → `AuthUser` in `auth-service`. `infra/docker-compose.yml` with postgres:16 + schema init.
- [x] **Day 2** — `shared-jwt` library: RSA-2048 keypair committed as dev keys, `KeyLoader`, `JwtSigner` (RS256 via Nimbus), `Claims` constants.
- [x] **Day 3** — `auth-service` signup/login: `POST /auth/signup`, `POST /auth/login`, BCrypt, sets `LINK_SESSION` + `LINK_REFRESH` cookies.
- [x] **Day 4** — `auth-service` refresh/logout/me: `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`. `refresh_token` table + revocation.
- [x] **Day 5** — Gateway: Spring Cloud Gateway. Cookie → JWT rewrite. Routes to all services. CORS for `localhost:5173`.
- [x] **Day 6** — Frontend: Chakra UI swap, `/login` + `/signup` pages, protected route wrapper, `credentials: "include"` fetch, 401 → redirect, Zustand auth store.
- [x] **Day 7** — Buffer / polish: Playwright E2E auth smoke test (`e2e/auth.spec.ts`), README quickstart.

### Phase 1 — Week 2 (Core domain)

- [x] **Day 8** — `user-service`: `GET /users/me`, `PATCH /users/me`, `user_profile` table. Lazy-insert profile on first call; Spring Security + OAuth2 resource server added.
- [x] **Day 9** — `messaging-service` schema: `Workspace`, `WorkspaceMember`, `Channel`, `ChannelMember`, `Message` JPA entities + Flyway migration (`V1__create_messaging_tables.sql`). `ddl-auto=none`, Flyway owns all DDL.
- [x] **Day 10** — Workspaces API: `POST /workspaces` (slug auto-generated + auto-creates `general` channel + OWNER member), `GET /workspaces`, `POST /workspaces/{id}/members` (OWNER/ADMIN only; new member auto-joined to all channels).
- [x] **Day 11** — Channels API: `POST /workspaces/{id}/channels`, `GET /workspaces/{id}/channels`. Creator auto-added as member; name normalised to lowercase kebab-case.
- [x] **Day 12** — Messages API (REST): `POST /channels/{id}/messages`, `GET /channels/{id}/messages?before=&limit=50`. Caller must be a `ChannelMember`.
- [x] **Day 13** — Frontend wiring: `WorkspacePage` (full Slack-style three-column layout). Workspace switcher sidebar, channel list + create-channel dialog, message list with grouping + message composer. TanStack Query + Zustand store. All Chakra UI.
- [x] **Day 14** — Buffer / polish: empty states, loading `Spinner`, error messages via `apiClient` backend passthrough. Seed script at `infra/postgres/seed.sql`.

### Phase 1 — Week 3 (Realtime + demo)

- [x] **Day 15** — WebSocket in `messaging-service`: STOMP endpoint, JWT auth on WS handshake.
- [x] **Day 16** — Publish on send: `POST /channels/{id}/messages` broadcasts to `/topic/channel.{id}`.
- [x] **Day 17** — Frontend WS client: `@stomp/stompjs`, subscribe on channel mount, append to React Query cache.
- [x] **Day 18** — Presence: `messaging-service` publishes presence events on WS connect/disconnect; frontend presence store + dots in sidebar and message rows.
- [x] **Day 19** — Demo polish: initials-avatar with presence dot (`MessageRow`), timestamps, consecutive-author message grouping, logout button in `SidebarFooter`.
- [ ] **Day 20** — Demo dry run: `docker compose down -v && docker compose up`, full script end-to-end.
- [ ] **Day 21** — Buffer.

### Phase 2 — Rest of semester 1

- [x] **DMs** — `DmController` (`POST/GET /workspaces/{id}/dms`), FE hooks (`useDms`, `useOpenDm`), `DmItem` sidebar entry.
- [x] **Notifications (unread badges)** — Backend fans out `/user/queue/notifications` on send; FE `notificationStore` + `useNotificationSocket`; badge count per channel.
- [ ] **Threads** — `GET /messages/{id}/thread` endpoint; thread sidebar `Drawer` in FE.
- [ ] **Reactions** — `V2` Flyway migration adds `message_reaction` table; `POST/DELETE /messages/{id}/reactions/{emoji}`; aggregate counts in `MessageResponse`; emoji-picker `Popover` in FE.
- [ ] **File sharing (`file-service`)** — MinIO in `docker-compose`; presigned upload; `attachment` table; inline image preview.
- [ ] **RBAC enforcement** — `@PreAuthorize` on every controller; role matrix documented (§3.6); guests can post and react.
- [ ] **Message edit + delete** — `PATCH /messages/{id}`, `DELETE /messages/{id}`; WS broadcast `message.edited` / `message.deleted`; FE hover-menu.
- [ ] **Message search** — `GET /channels/{id}/messages?q=` Postgres full-text; search bar in FE.
- [ ] **Tests** — JUnit 5 unit tests (domain logic); Spring Boot integration tests (happy-path per service); E2E Playwright specs for all features.
- [x] **CI** — GitHub Actions: `auth-service.yml`, `messaging-service.yml`, `user-service.yml`, `e2e.yml`.
