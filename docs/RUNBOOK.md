# Operations Runbook

Practical, step-by-step procedures for running, deploying, rolling back, and troubleshooting Eventify. This complements [`ARCHITECTURE.md`](ARCHITECTURE.md) (which explains *why* the system is built this way) with the *how* for day-to-day and incident-response operations.

## Table of Contents

- [Checking What's Running](#checking-whats-running)
- [Rolling Back a Deployment](#rolling-back-a-deployment)
- [Verifying a Deployment's Health](#verifying-a-deployments-health)
- [Reading the Discord Build Notification](#reading-the-discord-build-notification)
- [Restarting Services](#restarting-services)
- [Viewing Logs](#viewing-logs)
- [Running Tests Locally](#running-tests-locally)
- [Common Issues](#common-issues)

---

## Checking What's Running

**See which image tags are currently deployed:**

```bash
docker compose ps
```

Check the `IMAGE` column — it shows e.g. `event-api:23`, telling you exactly which build each container is running.

**See all image tags available locally to roll back to:**

```bash
docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "event-api|registration-api|frontend|proxy"
```

Numeric tags (e.g. `19`, `20`, `21`) correspond to Jenkins build numbers. `:latest` is whatever the most recent successful build tagged.

**List just the numeric tags for one service, sorted:**

```bash
docker images event-api --format "{{.Tag}}" | grep -E "^[0-9]+$" | sort -n
```

---

## Rolling Back a Deployment

1. Identify the last known-good build number (from `docker images`, the Jenkins build history, or a past Discord notification — see below).
2. Redeploy that tag directly — **this does not rebuild**, it reuses the already-built image:
   ```bash
   IMAGE_TAG=<build_number> docker compose up -d
   ```
3. Confirm the rollback took effect:
   ```bash
   docker compose ps
   ```
   The `IMAGE` column should now show the older tag.
4. Confirm the rolled-back version is actually serving traffic (not just that the container started) — see [Verifying a Deployment's Health](#verifying-a-deployments-health).

> **Why this works:** Jenkins tags every build's images with its `BUILD_NUMBER` in the `Build Images` stage. `docker-compose.yml` references `image: event-api:${IMAGE_TAG:-latest}`, so setting `IMAGE_TAG` at deploy time simply points Compose at a different, already-built image — no code rebuild, no risk of pulling in unrelated changes from a newer or older commit.

---

## Verifying a Deployment's Health

Each service exposes `GET /health`, routed through the proxy:

```bash
curl http://localhost:8080/api/health/event-api
curl http://localhost:8080/api/health/registration-api
```

The response's `version` field reflects `BUILD_VERSION`, which is set from `IMAGE_TAG` at deploy time — so it updates the moment you deploy or roll back, giving you a live, verifiable way to confirm which build is actually serving traffic (not just which one `docker compose ps` says is running).

---

## Reading the Discord Build Notification

Every pipeline run — triggered automatically on push to `main`, or manually from the Jenkins UI — posts a summary card to Discord with:

| Field | What it tells you |
|---|---|
| **Image Tag** | The Jenkins build number — this is your `IMAGE_TAG` for rollback |
| **Branch / Commit** | What code is in this build |
| **Duration** | How long the pipeline took |
| **Message** | The commit message that triggered the build |
| **Health Check** | Live `/health` status + version for `event-api` and `registration-api`, captured during the Smoke Test stage |
| **Stages** | Pass/fail/skip per pipeline stage, so you can see exactly where a failed build stopped |

If **Health Check** shows `unreachable` for a service even though the build title says the overall pipeline succeeded, that's worth investigating separately — it generally means Smoke Test's direct health curl passed but something changed between that check and when you're looking (or the two curls hit different container instances during a rolling restart).

Scroll back through the Discord channel to find the last build whose **Health Check** field showed both services `ok` — that build number is a safe rollback target.

---

## Restarting Services

**Restart everything (keeps data — the DB volume is untouched):**

```bash
docker compose restart
```

**Restart a single service:**

```bash
docker compose restart event-api
```

**Full recreate (picks up `.env` changes, still keeps the DB volume):**

```bash
docker compose up -d --force-recreate
```

> ⚠️ Never run `docker compose down -v` unless you intend to **destroy the database volume** and lose all data. Plain `docker compose down` (no `-v`) is safe — it stops containers but preserves the named volume.

---

## Viewing Logs

```bash
docker compose logs -f event-api
docker compose logs -f registration-api
docker compose logs -f proxy
docker compose logs -f db
```

Drop `-f` to see history without following. Add `--tail 100` to limit output on a noisy service.

---

## Running Tests Locally

Tests that touch the database or admin auth need those env vars set — otherwise they skip gracefully rather than fail:

```bash
cd event-api
DB_HOST=localhost DB_PORT=5432 DB_NAME=<name> DB_USER=<user> DB_PASSWORD=<password> ADMIN_PASSWORD=<password> npm test
```

Or, simpler, pull in your whole `.env` (override `DB_HOST` since `.env`'s `DB_HOST=db` only resolves inside the Docker network, not from your host machine):

```bash
DB_HOST=localhost npx dotenv -e ../.env -- npm test
```

---

## Common Issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| `/health` returns `503` | Database unreachable from the API container | Check `docker compose ps` — is `db` healthy? Check `DB_HOST`/`DB_PASSWORD` match between `.env` and what the container actually has (`docker compose config`) |
| Local `npm test` fails on DB-dependent tests | No `DB_*` env vars set, or DB not running | Either accept the skip (expected without Docker running), or start `docker compose up -d db` and pass `DB_HOST=localhost` |
| `docker compose up -d` rebuilds instead of using a tagged image | `IMAGE_TAG` wasn't set, or that tag doesn't exist locally | Confirm the tag exists with `docker images`; set `IMAGE_TAG` explicitly before running `up -d` |
| Jenkins build fails at Smoke Test | A service didn't come up healthy before the curl checks ran | Check `docker compose logs -f <service>` for the deploy; confirm `HEALTHCHECK`/`depends_on: condition: service_healthy` passed |
| Discord notification never arrives | Webhook URL rotated, or Jenkins Credential misconfigured | Verify the `ci-discord-webhook-url` Jenkins Credential is current; Discord webhook URLs can be regenerated/revoked from the Discord channel settings |
| GitHub webhook isn't triggering builds | ngrok tunnel restarted and issued a new URL | Update the Payload URL under the repo's Settings → Webhooks to the current ngrok URL, or trigger the build manually from Jenkins in the meantime |
