# Run Guide

## Prerequisites

- Docker Engine + Compose v2 (or Docker Desktop)
- JDK 24 (Option A only)
- Node.js >= 20

---

## Option A — Dev mode (Postgres in Docker, services in IDE/terminal)

Start Postgres:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Start each Spring Boot service (separate terminals or run from IntelliJ):

```bash
cd Link-BE
./gradlew :auth-service:bootRun
./gradlew :user-service:bootRun
./gradlew :messaging-service:bootRun
./gradlew :gateway:bootRun
```

Start the frontend:

```bash
cd Link-FE
npm install
npm run dev
```

App is at `http://localhost:5173`, gateway at `http://localhost:8080`.

Stop Postgres:

```bash
docker compose -f infra/docker-compose.yml down
```

---

## Option B — Full stack (everything in Docker)

First run (builds all images — takes a few minutes):

```bash
docker compose -f infra/docker-compose.full.yml up --build
```

Subsequent runs (no rebuild):

```bash
docker compose -f infra/docker-compose.full.yml up
```

Force a rebuild (e.g. after code changes):

```bash
docker compose -f infra/docker-compose.full.yml up --build
```

Start the frontend (still runs outside Docker):

```bash
cd Link-FE
npm install
npm run dev
```

App is at `http://localhost:5173`, gateway at `http://localhost:8080`.

Tear down (stops containers, removes volumes/data):

```bash
docker compose -f infra/docker-compose.full.yml down -v
```

Tear down without wiping data:

```bash
docker compose -f infra/docker-compose.full.yml down
```

---

## Unit tests

Run all service tests:

```bash
cd Link-BE
./gradlew test --no-daemon
```

Run a single service:

```bash
./gradlew :auth-service:test --no-daemon
./gradlew :user-service:test --no-daemon
./gradlew :messaging-service:test --no-daemon
```

HTML test reports are written to:

```
Link-BE/<service>/build/reports/tests/test/index.html
```

---

## E2E tests (Playwright)

Requires the full stack running (Option A or B) and the frontend dev server.

Install browsers (first time only):

```bash
cd Link-FE
npx playwright install chromium --with-deps
```

Run all E2E tests:

```bash
cd Link-FE
npx playwright test
```

Run a specific spec:

```bash
npx playwright test e2e/auth.spec.ts
```

Open the HTML report after a run:

```bash
npx playwright show-report
```

---

## Seed data

Populate the database with two users, one workspace, one channel, and ten messages:

```bash
psql -h localhost -U link -d link -f infra/postgres/seed.sql
```

Requires Postgres to be running (Option A or B). Password is `link`.
