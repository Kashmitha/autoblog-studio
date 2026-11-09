# Deployment and operations

The initial target is the owner's Windows machine. No hosting account, deployment purchase or production Blogger post has been created. External integrations still need owner setup/live tests. Do not call this production-ready before those tests and a production security/dependency review.

## All-local Docker stack

After `npm run setup`, keep BLOGGER_MODE=mock, AI_ENABLED=false and AI_BILLING_AUTHORIZED=false. The root `.env` is passed at runtime, not copied into images.

```powershell
docker compose --profile app up -d --build
docker compose --profile app ps
```

This runs PostgreSQL, Redis, a one-shot migration/owner-seed service, NestJS, the dedicated worker, and Next.js. Open http://localhost:3100. The database/Redis ports bind loopback. The backend depends on successful migrations; worker startup waits for API health. Exact user/Redis secrets should be changed before any remote deployment. The frontend image embeds its internal API destination at build time (`API_INTERNAL_URL`, default http://backend:4000 for Docker). The local native build defaults to http://127.0.0.1:4000.

Do not run native servers on ports 3100/4000 simultaneously with the Docker app profile. Stop only your own project processes first. Native source-file updates require rebuilding the images, not just restarting old containers.

The local `.env` defaults to NODE_ENV=development so local HTTP sign-in works. A remotely accessible deployment **must** use NODE_ENV=production, HTTPS and the exact public FRONTEND_URL/GOOGLE_REDIRECT_URI. Set production environment values in your platform secret store; do not put `.env` in an image or Git. No secret uses NEXT_PUBLIC variables.

## Native development

Run only the databases with `docker compose up -d postgres redis`. Generate/migrate/seed, then `npm run build -w backend` and `npm run dev`. Development uses tsc metadata emission and node watch mode for NestJS; Next runs its own dev server. See SETUP.md for individual commands.

## Health and monitoring

- `/api/health` reports PostgreSQL/Redis connectivity and recent worker heartbeats. A disconnected data service returns 503. `worker: not running` is explicit even when the API itself is healthy.
- Job history shows PostgreSQL publishing records and live Redis counts. Failed records retain a reason; they are never discarded silently.
- Automation pause/emergency-stop causes safe job deferral without consuming failure attempts. Already in-flight external requests may finish.
- Logs use structured request IDs, action names, entities and redacted safe API error types. Do not copy raw environment/configuration dumps into logs.
- Reconciliation runs every 30 seconds and restores missing queue jobs from PostgreSQL. Redis uses append-only persistence and noeviction.
- DB schedules are UTC instants; daily limits and recurring times use Asia/Colombo. Financial/traffic report dates retain their source calendar-date semantics.

## Publishing failures and duplicate protection

Never erase remote insertion intent merely to make a job run again. On uncertain draft insertion, the article/job fails safely. Inspect existing Blogger posts on the **original blog**, find the matching draft or live post ID, then use the failed article's **Reconcile uncertain remote draft** form with the explicit confirmation phrase. The API verifies that the ID exists on the original selected blog; the owner must verify matching title/content. Retry the failed job only after reconciliation. The existing remote ID is reused; LIVE status is confirmed without another insert/publish.

If no draft can be found, do not blindly clear the attempt: examine Blogger directly, wait for eventual visibility, inspect audit information and use a deliberate operator recovery. Automatic exactly-once delivery across an external network is not claimed. Jobs pin the selected blog ID; switching a connection cannot silently redirect an existing scheduled article to a different blog.

## Backups

Settings also provides a [portable content archive](CONTENT_ARCHIVE.md) of articles, research/planning notes and media references. It is useful for a separate content copy but does not include the database, originals, credentials or operational history and has no automatic restore. Continue using the full backup procedure below for recovery.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup.ps1
```

The script invokes pg_dump in the project database container and copies a custom-format dump into ignored `backups/`. Keep encrypted offline copies of:

1. PostgreSQL dumps.
2. Original uploads (`uploads/` natively, `uploaded_originals` Docker volume).
3. Root `.env` or the equivalent production secret-store values, particularly TOKEN_ENCRYPTION_KEY.

Never commit backups, uploads, OAuth credentials or private logs. A DB dump alone cannot decrypt credentials without the original encryption key. Restore first into an isolated database and validate it; do not overwrite the working database to test a backup.

Example isolated restore procedure: create an empty `autoblog_restore_test` database in the same local PostgreSQL instance, copy the selected dump into the database container, then invoke `pg_restore --no-owner --no-privileges -U <configured owner> -d autoblog_restore_test <copied dump>`. Verify owner/article/job counts, migration table and referential integrity there before planning a real restore. Use the configured owner; do not paste database passwords into shell history. Production restore is an intentional operator action.

## Before remote deployment

Verify Node/framework support and current dependency advisories, review all external integration permissions/live results, enable HTTPS and secure cookies, restrict CORS/origin to the frontend, block public DB/Redis ports, use strong unique DB credentials and TLS where appropriate, add real off-host encrypted backups, and test restoration. Keep Swagger/health access behind your reverse-proxy access policy as appropriate. Do not expose a development server or add tenants without a tenant-isolation redesign. Any paid hosting/irreversible deployment remains a separate owner approval checkpoint.
