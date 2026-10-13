# Eventify — Technical Architecture

This document covers the system in depth: architecture, database design, API design, Docker internals, the Jenkins pipeline, and the reasoning behind the project's key decisions. It's written to double as defense material for individual Q&A — each section explains not just *what* was built, but *why*.

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Database Design](#3-database-design)
4. [API Design](#4-api-design)
5. [Docker Architecture](#5-docker-architecture)
6. [Jenkins / CI/CD Pipeline](#6-jenkins--cicd-pipeline)
7. [Notable Design Decisions (and their trade-offs)](#7-notable-design-decisions-and-their-trade-offs)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. System Overview

Eventify is a Student Organization Event Registration System. Students browse open events and register; admins create and manage events, monitor registrations, and manage the student roster. The system is deliberately feature-light — the grading emphasis is on infrastructure (Docker, CI/CD, testing, deployment, persistence, rollback), not on application breadth.

### Application Modules (Containers)

| Container | Responsibility |
|---|---|
| **Nginx Proxy** (`proxy`) | Reverse proxy — the **only** container exposed to the host, on port `8080` |
| **Frontend** (`frontend`) | Static student site + admin panel, served by Nginx |
| **Event API** (`event-api`) | Events, students, admin authentication — port `3000` |
| **Registration API** (`registration-api`) | Registrations, attendance, Discord notification webhook — port `3001` |
| **PostgreSQL** (`db`) | Internal only, no published port, data in the named volume `student-org-db-data` |

**Jenkins** runs as a **separate Compose stack** (`infra/jenkins/`) that joins the app's `student-org-network` externally rather than living inside it — Jenkins is infrastructure *around* the app, not a module of the app itself.

---

## 2. Architecture Diagram

![Eventify system architecture — containers, ports, networks, volumes, and request flow](images/architecture-diagram.jpg)

### Reading the diagram

- **Docker Host boundary** (outer dashed box) contains everything that runs locally — the app's Docker network plus the separate Jenkins CI/CD stack beneath it.
- **`student-org-network`** (inner solid box) is the one user-defined bridge network every app container joins. Only **Nginx Proxy** crosses its boundary to the host, on `:8080` — nothing else is reachable from outside Docker.
- **Request flow:** Browser → Nginx Proxy (`:8080`) → either the static **Frontend**, `/api/events|students|admin/` → **Event API** (`:3000`), or `/api/register|registrations/` → **Registration API** (`:3001`). Both APIs query **PostgreSQL** through their own connection pool; Postgres has no route back out and no published port.
- **Persistence:** PostgreSQL's data lives in the named volume `student-org-db-data`, shown sitting underneath the database — every other container is stateless and disposable. `db/init.sql` runs exactly once, the first time that volume is empty.
- **Notifications:** Registration API calls the Discord Webhook directly over the network boundary, wrapped in a non-blocking try/catch — a failed Discord call never fails the registration itself.
- **CI/CD (bottom section):** GitHub → ngrok (tunnels a public webhook to local Jenkins) → Jenkins, which runs `Checkout → Test → Build Images → Deploy → Smoke Test`. A failing `Test` stage stops the pipeline immediately (red arrow, "Pipeline stops here") before anything is built or deployed. A successful run deploys with `docker compose up -d` and posts a build summary — including live `/health` status per service — to the same Discord Webhook used for registrations.
- **Image tagging & rollback:** every build tags images with `:BUILD_NUMBER` (plus `:latest`); rolling back is `IMAGE_TAG=<n> docker compose up -d` — a redeploy of an already-built image, never a rebuild from an older commit.

### Containers and ports

| Container | Image | Port | Exposed to host? |
| --- | --- | --- | --- |
| Nginx Proxy | `nginx:1.27-alpine` | 80 (container) | **Yes** — `8080:80`, the only published port |
| Frontend | `nginx:1.27-alpine` | 80 | No |
| Event API | `node:20.17.0-alpine` | 3000 | No |
| Registration API | `node:20.17.0-alpine` | 3001 | No |
| PostgreSQL | `postgres:16.4-alpine` | 5432 | No — no `ports:` entry at all |

### Networking

A single user-defined bridge network, `student-org-network`, created by the app's `docker-compose.yml` and explicitly named so Jenkins' separate Compose file can join it as `external: true`. All inter-service communication uses Docker **service names** (`db`, `event-api`, `registration-api`, `frontend`) — never `localhost` — because each container has its own network namespace; `localhost` inside a container refers only to that container itself.

Nginx strips the `/api/<service>/` prefix on proxy, so a request to `/api/events/3` reaches `event-api` as `/events/3` — which is what its Express routes actually expect.

---

## 3. Database Design

PostgreSQL, three tables, in a named Docker volume (`student-org-db-data`) so data survives container recreation.

```
students                 events                    registrations
---------                 ------                     ------------
id (PK)                   id (PK)                    id (PK)
student_number (unique)   title                      student_id (FK → students)
name                      description                event_id (FK → events)
email (unique, nullable)  event_date                 status
created_at                location                   registered_at
                          capacity                    UNIQUE(student_id, event_id)
                          status
                          category
                          closed_at
                          created_at
```

Relationships: one student can have many registrations; one event can have many registrations. `ON DELETE CASCADE` on both foreign keys means deleting a student or an event also removes their related registrations — a deliberate simplicity trade-off (see §7).

`email` is nullable because bulk-uploaded students (via the admin panel's Excel/CSV import) often only have an ID and a name; `UNIQUE` still holds correctly, since Postgres treats multiple `NULL`s as distinct values.

`closed_at` tracks the moment an event's status becomes `closed`, and drives the automatic cleanup job described in §7.

`db/init.sql` only runs once, automatically, the first time the `db` container starts against an *empty* volume (this is a built-in behavior of the official `postgres` Docker image, via files placed in `/docker-entrypoint-initdb.d/`). It will not re-run against an existing volume, even if the file changes — schema changes to a running database are applied manually.

---

## 4. API Design

Two independent Express services, each with its own database connection pool, each exposing `GET /health`.

### Event API (port 3000)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/events/` | public | List all events |
| GET | `/events/:id` | public | Get one event |
| POST | `/events/` | admin | Create an event |
| PUT | `/events/:id` | admin | Update an event (rejected with `403` if already closed) |
| DELETE | `/events/:id` | admin | Delete an event (cascades to its registrations) |
| POST | `/events/cleanup` | admin | Manually run the closed-event cleanup job |
| POST | `/students/` | public | Self-register a student |
| GET | `/students/` | admin | List all students |
| GET | `/students/:studentNumber` | public | Look up a student by number |
| POST | `/students/bulk-upload` | admin | Import students from an Excel/CSV file |
| DELETE | `/students/:id` | admin | Delete a student (cascades to their registrations) |
| GET | `/admin/verify` | admin | Check whether a given admin password is valid |

### Registration API (port 3001)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/registrations/` | public | A student registers for an event |
| GET | `/registrations/:id` | public | Check a specific registration's status |
| GET | `/registrations/stats/total` | admin | Total registration count |
| GET | `/registrations/event/:eventId` | admin | List participants for an event |
| GET | `/registrations/event/:eventId/export` | admin | Attendance data for PDF export |
| PUT | `/registrations/:id/status` | admin | Mark a registration's status (e.g. attended) |

### Admin Authentication

A single shared password (`ADMIN_PASSWORD`), checked via a custom `X-Admin-Password` header on every admin-only request, verified by a small `requireAdmin` Express middleware duplicated identically in both services (each service is an independent container with its own `src/` tree — there's no shared backend code between them, so a 12-line middleware is duplicated rather than extracted into a shared package). There are no sessions, no JWTs, no user table — stateless by design. This is explicitly a scope trade-off: anyone with the password has full admin rights, acceptable for a classroom project, not how this would be built for production use.

### Registration Business Rules

`POST /registrations/` enforces, in order: event exists → event is `open` → event isn't at capacity → student exists → no duplicate registration (enforced at the database level via a `UNIQUE` constraint, which also makes it safe against two simultaneous requests racing each other) → insert → fire the notification webhook (failure here never blocks the response — see §7).

---

## 5. Docker Architecture

### Images

| Service | Base Image | Notes |
|---|---|---|
| `event-api` / `registration-api` | `node:20.17.0-alpine` | `npm ci --omit=dev`, layer-cached, no multi-stage build (no compile/bundle step to discard) |
| `frontend` / `proxy` | `nginx:1.27-alpine` | Static file serving / reverse proxy |
| `db` | `postgres:16.4-alpine` | Named volume, no published port |
| Jenkins | `jenkins/jenkins:2.541.1-lts-jdk17` | Docker CLI + Compose plugin + Node.js 20 installed on top |

All base images are pinned to specific versions — never `:latest` — for reproducible builds.


### Health Checks and Startup Ordering

Every custom image defines a `HEALTHCHECK`. `docker-compose.yml` uses `depends_on: condition: service_healthy` throughout — not plain `depends_on` — so, for example, `event-api` won't even attempt to start until `db`'s healthcheck (`pg_isready`) reports success, rather than just waiting for the container to exist. `proxy` in turn waits on `frontend`, `event-api`, and `registration-api` all being `service_healthy`.

### Image Tagging and Rollback

Jenkins tags every build's images with its `BUILD_NUMBER` (and also as `:latest`). `docker-compose.yml` references `image: event-api:${IMAGE_TAG:-latest}` (and equivalently for the other services) with a `build:` fallback — so Compose deploys an already-built tagged image if one exists, and only builds fresh if it doesn't. Rollback is then just:

```bash
IMAGE_TAG=<previous_build_number> docker compose up -d
```

This redeploys a known-good previously-built image directly — it does not rebuild from an older commit. Each service's `/health` response includes a `version` field driven by `BUILD_VERSION` (set from `IMAGE_TAG` at deploy time), so a rollback is independently verifiable live, not just assumed from the command's exit code.

---

## 6. Jenkins / CI/CD Pipeline

Jenkins runs as its own Docker Compose stack, entirely separate from the application, with a persistent `jenkins_home` volume so configuration, credentials, and job history survive rebuilds. It uses the host's Docker daemon directly (the socket is mounted into the Jenkins container) — see §7 for the security trade-off this implies.

### Pipeline Stages

```
Checkout → Test → Build Images → Deploy → Smoke Test
```

- **Checkout** — pulls the triggering commit from GitHub.
- **Test** — runs `npm ci && npm test` for both `event-api` and `registration-api`. A failing test here stops the pipeline entirely; Build Images, Deploy, and Smoke Test are skipped (shown on the diagram as the pipeline stopping before anything downstream runs).
- **Build Images** — builds all four application images, tagged with the Jenkins build number and `:latest`.
- **Deploy** — runs `docker compose up -d`, which picks up the newly-built `:latest` images.
- **Smoke Test** — hits each service's `/health` endpoint through its Docker service name (Jenkins is on `student-org-network` for exactly this reason) to confirm the deployment is actually serving traffic, and captures each response for the build notification.

Every run — pass or fail — posts a build summary to Discord: image tag, branch, commit, duration, stage-by-stage results, and a live health-check status line per service.

### Automatic Triggering

A GitHub webhook (configured under the repo's Settings → Webhooks) pings Jenkins on every push to `main`, via the GitHub plugin's webhook receiver. Since Jenkins runs locally rather than on a publicly reachable server, a tunneling tool (ngrok) exposes it temporarily so GitHub's servers can reach it — the webhook Payload URL has to be updated each time the tunnel restarts, since the free tier issues a new URL each session. Poll SCM is the documented fallback if webhook delivery isn't practical in a given environment.

### Secrets

`DISCORD_WEBHOOK_URL`, `CI_DISCORD_WEBHOOK_URL`, `DB_PASSWORD`, and `ADMIN_PASSWORD` are stored as Jenkins Credentials (Secret text), referenced in the Jenkinsfile via `credentials('<id>')` — never hardcoded, and masked automatically in console output.

---

## 7. Notable Design Decisions (and their trade-offs)

**Closed events are final.** Enforced server-side — `PUT /events/:id` returns `403` if the event's current status is already `closed` — not just disabled in the UI, so the rule holds even against a direct API call. Closing an event requires downloading a PDF attendance export first (client-side, via jsPDF), which becomes the permanent record once the underlying database row is gone.

**Closed events auto-delete after 2 days.** An hourly background job (plain `setInterval`, deliberately not a cron library — no new dependency needed for a simple periodic check) deletes any event whose `closed_at` is more than 2 days in the past. Because `registrations` has `ON DELETE CASCADE` on `event_id`, this also deletes that event's registration rows — an intentional trade-off: the PDF export is the durable record, not the database.

**Webhook failure never blocks registration.** `notificationService.js` wraps its Discord POST in a try/catch that logs but never re-throws — shown on the diagram as the "notify" arrow being explicitly labeled non-blocking. A registration is considered successful the moment it's committed to the database; the webhook is a best-effort side effect.

**The Docker socket is mounted into Jenkins.** This lets Jenkinsfile steps run real `docker build` / `docker compose` commands against the host's actual Docker daemon — but it also means anything running inside the Jenkins container has effectively root-level control over Docker on the host. This is a real, named security trade-off, acceptable for a local/classroom CI setup, not for a production deployment (where a dedicated build agent or a TLS-secured remote Docker API would be the safer alternative).

**Admin auth is a single shared password**, not user accounts — see §4.

---

## 8. Testing Strategy

Both `event-api` and `registration-api` have Jest + Supertest suites covering: health checks, basic input validation, admin authentication (unauthenticated / wrong password / correct password), and the closed-event edit lock. Tests that require a reachable database or a configured `ADMIN_PASSWORD` skip gracefully when neither is present (e.g. a bare local `npm test` run outside Docker) rather than reporting a false failure, and assert fully inside Jenkins, where both are available. The notification webhook is explicitly mocked in tests, per the project requirement that tests never depend on a real external service.
