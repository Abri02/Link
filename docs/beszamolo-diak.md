---
marp: true
title: Link — Vállalati üzenetkezelő platform
author: Ábrahám Bálint
paginate: true
---

# Link — Vállalati üzenetkezelő platform

Diplomamunka / önálló laboratórium beszámoló

**Készítette:** Ábrahám Bálint
**Konzulens:** *[konzulens neve]*

BME VIK — Automatizálási és Alkalmazott Informatikai Tanszék
2026. tavaszi félév

---

# A feladat — mit építünk?

- Vállalati üzenetkezelő alkalmazás **Spring** és **React** platformon
- **Workspace-ek** (munkaterek), azon belül **csatornák** és **privát üzenetek (DM)**
- Valós idejű üzenetküldés: **threadek**, **emoji reakciók**, **fájlmegosztás**
- **Videohívás** és **prémium előfizetés** (2. félév)
- Többszintű jogosultságkezelés (RBAC): owner / admin / member / guest

> A cél egy modern, produkciós minőségű üzenetküldő — két félévre bontva.

---

# Funkcionális és nem-funkcionális követelmények

**Funkcionális**
- Regisztráció / bejelentkezés, workspace-ek
- Publikus és privát csatornák, DM-ek
- Üzenetek: szerkesztés, törlés, keresés; reakciók; fájlok
- Valós idejű kézbesítés és jelenlét

**Nem-funkcionális**
- Mikroszolgáltatás-architektúra, egyetlen publikus **API Gateway**
- Cookie-alapú autentikáció (HttpOnly, Secure)
- Konténerizáció — `docker compose up` az egész stacket elindítja
- Közös JWT-validációs szerződés minden szolgáltatásban

---

# Technológiai stack

| Réteg | Választás |
| --- | --- |
| Backend | Kotlin 2.2 + Spring Boot 4, Spring Data JPA |
| Biztonság | Spring Security, OAuth2 Resource Server (JWT) |
| Adatbázis | PostgreSQL (schema-per-service) |
| Valós idő | Spring WebSocket + STOMP |
| Gateway | Spring Cloud Gateway |
| Fájltárolás | MinIO (S3-kompatibilis) |
| Frontend | React 19 + TypeScript + Vite, Chakra UI |
| FE állapot | TanStack Query + Zustand |
| Infra / CI | Docker Compose, GitHub Actions |

> A nyelv és keretrendszer kötött volt (Kotlin/Spring + React).

---

# Mikroszolgáltatás-architektúra

- A böngésző csak a **Gateway**-jel beszél (1 HttpOnly cookie)
- Szolgáltatások:
  - **auth-service** — regisztráció, login, token-kezelés
  - **user-service** — profilok
  - **messaging-service** — workspace-ek, csatornák, üzenetek, WebSocket
  - **file-service** — fájlok (MinIO)
- Közös **shared-jwt** könyvtár a token-szerződéshez
- Egy PostgreSQL, szolgáltatásonként külön séma

> Minden downstream szolgáltatás egyszerű, önállóan tesztelhető Spring resource server — a cookie sosem ér el az üzleti logikáig.

---

# Architektúra-ábra

```
              ┌──────────────────────┐
              │   React (Vite)       │  böngésző
              └──────────┬───────────┘
                         │  HTTPS, HttpOnly cookie
                         ▼
              ┌──────────────────────┐
              │     API Gateway      │  cookie → JWT → Bearer
              └─┬──────┬──────┬───────┘
                ▼      ▼      ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌────────────┐
        │  auth-   │ │  user-   │ │ messaging-   │ │   file-    │
        │ service  │ │ service  │ │  service     │ │  service   │
        └────┬─────┘ └────┬─────┘ └──────┬───────┘ └─────┬──────┘
             ▼            ▼              ▼               ▼
            ┌──────────────────────┐            ┌──────────────┐
            │      PostgreSQL      │            │    MinIO     │
            │  schema-per-service  │            │  (fájlok)    │
            └──────────────────────┘            └──────────────┘
```

---

# Autentikáció — cookie + JWT

- Login után két cookie:
  - `LINK_SESSION` — rövid életű access JWT (15 perc)
  - `LINK_REFRESH` — 7 nap, szerver oldalon tárolt
- A **Gateway** olvassa a session cookie-t, validálja a JWT-t, és `Authorization: Bearer` fejlécként továbbítja
- Lejárt token → 401 → frontend automatikus token-frissítés a refresh cookie-val
- Logout: mindkét cookie törlése + refresh token visszavonása

> HttpOnly cookie az XSS ellen + stateless JWT-validáció a szolgáltatásokban. A Gateway hidalja át a kettőt.

---

# Az üzenetküldő funkciói

- Workspace-ek létrehozása, **meghívóval** való csatlakozás
- Publikus / privát **csatornák** és **privát üzenetek (DM)**
- Üzenetek: küldés, **szerkesztés**, **törlés**, **keresés**
- **Threadek** (válaszszálak)
- **Emoji reakciók**
- **Fájlmegosztás** csatolmányokkal (MinIO, kép-előnézet)

> Ez az első félév fő terméke — a teljes szöveges üzenetküldő funkcionalitás kész és működik.

---

# Valós idő — WebSocket & jelenlét

- STOMP WebSocket csatorna a `messaging-service`-ben, JWT-vel hitelesített handshake
- Új üzenetek azonnali kézbesítése (`/topic/channel.{id}`)
- **Jelenlét (presence):** online jelzők a tagoknál (csatlakozás / lecsatlakozás eseményekre)
- **Értesítések:** olvasatlan-jelzők csatornánként (`/user/queue/notifications`)
- Frontend: a beérkező üzenetek a TanStack Query gyorsítótárba kerülnek

> Demó: két böngésző — A küld, B azonnal látja; az online pötty felvillan.

---

# Jogosultságkezelés (RBAC)

- Négy szerepkör: **OWNER / ADMIN / MEMBER / GUEST**
- Minden védett végponton és WebSocket-eseményen kikényszerítve
- Pl. tagot felvenni csak OWNER/ADMIN tud; vendég korlátozott hozzáférés
- Munkaterületi **meghívó** folyamat a csatlakozáshoz

> A szerepkör-ellenőrzés a controller szinten történik, a Gateway által átadott JWT claim-jeiből dolgozik.

---

# Minőségbiztosítás

- **JUnit 5** unit tesztek a domain-logikára
- Spring Boot **integrációs tesztek** szolgáltatásonként
- **Playwright** end-to-end tesztek (regisztráció, üzenetküldés két böngészőben)
- **GitHub Actions** CI: minden szolgáltatás buildje + tesztek + frontend build minden push-ra
- `docker compose up` — az egész stack egy paranccsal indul

---

# Jelenlegi állapot — demó

- ✅ Teljes cookie-alapú autentikáció + Gateway
- ✅ Workspace / csatorna / DM / üzenet / thread / reakció / fájl / keresés
- ✅ Valós idejű kézbesítés, jelenlét, értesítések
- ✅ RBAC + meghívó folyamat
- ✅ Konténerizált stack + CI

*(Itt élő demó vagy képernyőképek)*

> Demó útvonal: bejelentkezés → workspace → valós idejű üzenetküldés → reakció → fájlfeltöltés.

---

# Következő lépések (2. félév) és összegzés

**Hátralévő munka**
- **Videohívás** (`video-service`): WebRTC P2P + Spring WebSocket signaling; bővítés: LiveKit SFU
- **Fizetés** (`payment-service`): Stripe Checkout + webhook, prémium funkciók
- Értesítés-szolgáltatás, keresés (Elasticsearch), megfigyelhetőség (OpenTelemetry)
- Telepítés és diplomamunka-írás

**Összegzés**
- Az első félévi cél — működő vállalati üzenetküldő — teljesült

---

# Köszönöm a figyelmet!

Kérdések?

**Ábrahám Bálint**
balint.abraham02@gmail.com
