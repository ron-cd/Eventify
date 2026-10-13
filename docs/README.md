# Eventify

**Student Organization Event Registration System** — students browse and register for events; admins create, manage, and track attendance. Built for the SYSIN Final Project, with grading emphasis on **system architecture, Docker infrastructure, Jenkins CI/CD, testing, deployment, persistence, and rollback** rather than feature count, so the application layer is kept intentionally simple.

[![Node.js](https://img.shields.io/badge/Node.js-20.17.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Jenkins](https://img.shields.io/badge/CI%2FCD-Jenkins-D24939?logo=jenkins&logoColor=white)](https://www.jenkins.io/)

📄 For a full technical writeup (architecture, database design, API reference, Docker/Jenkins internals, and the reasoning behind key design decisions), see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running Jenkins (optional)](#running-jenkins-optional)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Notable Design Decisions](#notable-design-decisions)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [Team](#team)
- [License](#license)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML / CSS / vanilla JavaScript |
| Backend | Node.js + Express (two independent services) |
| Database | PostgreSQL |
| Reverse Proxy | Nginx |
| Containerization | Docker + Docker Compose |
| CI/CD | Jenkins (Docker-hosted) |
| Notifications | Discord Webhook |
| Testing | Jest + Supertest |

## Architecture

```
Browser → Nginx (only public port) → Frontend (static)
                                    → Event API ──┐
                                    → Registration API ──→ PostgreSQL (internal only)
                                                            │
                                                            ▼
                                                     Discord Webhook
```

| Service | Responsibility |
|---|---|
| `event-api` | Events, students, and admin authentication |
| `registration-api` | Registrations, attendance, notification webhook |
| `db` | PostgreSQL, named volume, not exposed to the host |
| `proxy` | Nginx, the single public entry point (port 8080) |
| `infra/jenkins/` | Jenkins CI/CD, run as its own separate Compose stack |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full request flow, database schema, and container networking details.

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/<your-org>/eventify.git
   cd eventify
   ```
2. Copy `.env.example` to `.env` and fill in real values:
   ```bash
   cp .env.example .env
   ```
3. Start the application stack:
   ```bash
   docker compose up -d --build
   ```
4. Open the app:
   - Student site: [http://localhost:8080/](http://localhost:8080/)
   - Admin panel: [http://localhost:8080/admin/](http://localhost:8080/admin/)

### Running Jenkins (optional)

Jenkins is only needed if you want to exercise the CI/CD pipeline locally. The app stack must already be running first, since Jenkins' Compose file joins the app's Docker network rather than creating its own:

```bash
cd infra/jenkins
docker compose up -d --build
```

Jenkins UI: [http://localhost:8081/](http://localhost:8081/)

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Purpose |
|---|---|
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | PostgreSQL credentials |
| `DISCORD_WEBHOOK_URL` | Registration notification webhook |
| `ADMIN_PASSWORD` | Shared password gating the admin panel |

None of these are committed — `.env` is gitignored, and the values Jenkins uses are stored as Jenkins Credentials, not in the repository.

## API Overview

**Event API** (`/api/events/`, `/api/students/`, `/api/admin/`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/events/` | Public | List events |
| POST / PUT / DELETE | `/events/:id` | Admin | Create, update, or delete an event |
| POST | `/events/cleanup` | Admin | Manually trigger removal of events closed 2+ days ago |
| POST | `/students/` | Public | Self-register a student |
| GET / POST / DELETE | `/students/` | Admin | List, bulk-upload, or delete students |
| GET | `/admin/verify` | Admin | Check whether a given admin password is valid |

**Registration API** (`/api/register/`, `/api/registrations/`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/register/` | Public | A student registers for an event |
| GET | `/registrations/event/:eventId` | Admin | View participants |
| GET | `/registrations/event/:eventId/export` | Admin | Attendance data for PDF export |
| PUT | `/registrations/:id/status` | Admin | Mark a registration attended |
| GET | `/registrations/stats/total` | Admin | Total registration count |

All backend modules expose `GET /health`.

## Testing

```bash
cd event-api && npm test
cd registration-api && npm test
```

Tests that depend on a real database or a configured admin password skip gracefully when run locally without that environment present, and assert fully inside Jenkins, where both are available via Jenkins Credentials.

## CI/CD Pipeline

Jenkins runs: **Checkout → Test → Build Images → Deploy → Smoke Test**, triggered automatically on a push to `main` via a GitHub webhook. A failed test stops the pipeline before anything is built or deployed. Images are tagged by Jenkins build number, which is what makes rollback possible — a previous image is redeployed as-is, never rebuilt from old code:

```bash
IMAGE_TAG=<build_number> docker compose up -d
```

## Notable Design Decisions

- **Closed events are final.** Once an admin closes an event, it can no longer be edited — enforced server-side (`403`), not just hidden in the UI. Closing triggers a mandatory PDF attendance export first.
- **Closed events auto-delete after 2 days** via an hourly background job, since the PDF export is the permanent attendance record, not the database row.
- **The notification webhook never blocks registration.** A failed Discord webhook is logged; the registration itself still succeeds.
- **Admin auth is a single shared password**, not individual user accounts — a deliberate scope trade-off for this project, not a production-grade pattern.

Full reasoning for each decision is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#6-notable-design-decisions-and-their-trade-offs).

## Project Structure

```
eventify/
├── Jenkinsfile
├── docker-compose.yml
├── .env.example
├── docs/
│   ├── ARCHITECTURE.md
│   └── TEAM_CONTRIBUTIONS.md
├── proxy/                # Nginx reverse proxy
├── frontend/
│   ├── src/               # Student-facing site
│   └── src/admin/         # Admin panel
├── event-api/             # Events, students, admin auth
├── registration-api/      # Registrations, webhook
├── db/init.sql            # Schema + seed data
└── infra/jenkins/         # Jenkins, separate Compose stack
```

## Contributing

This is a course project, so external contributions aren't expected, but if you're reviewing or extending it:

1. Fork the repo and create a feature branch (`git checkout -b feature/my-change`).
2. Make your changes and run the test suites (`npm test` in `event-api/` and `registration-api/`).
3. Commit with a clear message and open a pull request against `main`.

A push to `main` automatically triggers the Jenkins pipeline described above.


## License

This project was built for academic purposes as part of a SYSIN course requirement. No license is currently specified — add one (e.g. MIT) if you intend to reuse or distribute this code beyond the course.
