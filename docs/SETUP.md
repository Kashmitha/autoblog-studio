# Local setup (Windows)

Use PowerShell in the repository root. Docker Desktop must be running Linux containers. Verified host: Windows build 26300, Node 26.13.0 LTS (Lithium), npm 11.20.0, Git 2.55.0, Docker Engine 29.7.2. Container deployment targets Node 24 LTS. No global Nest/Next CLI is needed.

```powershell
npm ci
npm run setup
docker compose up -d postgres redis
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build -w backend
npm run dev
```

Open http://localhost:3100. Read OWNER_PASSWORD from `.env` privately. Setup generates unique secrets without printing them. Seed creates the owner once; it never overwrites an existing password. To change it, edit OWNER_PASSWORD locally and run `node scripts/reset-owner-password.mjs`; this revokes existing sessions.

## Services

| Service    | Host address                      | Persistence                    |
| ---------- | --------------------------------- | ------------------------------ |
| Next.js    | http://localhost:3100             | PostgreSQL via API             |
| NestJS     | http://localhost:4000/api         | PostgreSQL                     |
| API docs   | http://localhost:3100/api/docs    | generated OpenAPI              |
| PostgreSQL | localhost:15432                   | postgres_data Docker volume    |
| Redis      | localhost:56379                   | redis_data volume, append-only |
| Worker     | dedicated process, no public port | PostgreSQL jobs + BullMQ       |

In development, the configured loopback frontend accepts localhost, 127.0.0.1 and IPv6 loopback on the same scheme and port. This supports local browser links without disabling Origin or CSRF validation. Production accepts only the configured FRONTEND_URL origin. Continue using localhost for Google OAuth so its redirect URI and session cookie share the same host. The Next rewrite sends API calls to 127.0.0.1:4000. Update FRONTEND_URL, GOOGLE_REDIRECT_URI, launch ports and Compose together if ports change.

## Environment reference

| Variable                                             | Meaning / default                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| NODE_ENV                                             | development; production enables secure cookies (HTTPS required)                                 |
| PORT                                                 | Nest API port, 4000                                                                             |
| FRONTEND_URL                                         | exact allowed browser origin, http://localhost:3100                                             |
| API_INTERNAL_URL                                     | server-only Next proxy destination; default http://127.0.0.1:4000                               |
| DATABASE_URL                                         | PostgreSQL connection, never public                                                             |
| REDIS_URL                                            | Redis connection, localhost:56379                                                               |
| POSTGRES_USER / PASSWORD / DB                        | local Compose database settings                                                                 |
| SESSION_SECRET                                       | generated secret used to HMAC stored session identifiers                                        |
| TOKEN_ENCRYPTION_KEY                                 | exactly 64 hex characters, AES-256-GCM; preserve separately in backups                          |
| OWNER_EMAIL / OWNER_PASSWORD                         | initial local owner credentials, password at least 12 characters                                |
| BLOGGER_MODE                                         | mock by default; live requires separate authorization                                           |
| GOOGLE_CLIENT_ID / SECRET                            | Web application OAuth credentials; backend only                                                 |
| GOOGLE_REDIRECT_URI                                  | http://localhost:3100/api/integrations/google/callback                                          |
| AI_ENABLED                                           | false by default                                                                                |
| AI_BILLING_AUTHORIZED                                | false; explicit local billing authorization                                                     |
| AI_API_KEY                                           | paid provider secret, never NEXT_PUBLIC                                                         |
| AI_MODEL                                             | configurable provider model ID; verify account availability                                     |
| AI_MAX_OUTPUT_TOKENS                                 | 2400; maximum 10000                                                                             |
| AI_INPUT_USD_PER_MILLION / AI_OUTPUT_USD_PER_MILLION | required current token prices; no assumed price                                                 |
| AI_MONTHLY_LIMIT_USD                                 | 3; hard reservation ceiling                                                                     |
| AI_DAILY_GENERATION_LIMIT                            | 2; includes failed/uncertain requests                                                           |
| UNSPLASH_ACCESS_KEY                                  | optional developer key; Wikimedia needs none                                                    |
| SEARCH_CONSOLE_SITE_URL                              | exact verified property URL or sc-domain property                                               |
| GA_PROPERTY_ID                                       | numeric GA4 property ID                                                                         |
| ADSTERRA_API_KEY                                     | reserved for a future official reporting adapter; not used by current CSV/manual implementation |
| PUBLISH_QUEUE                                        | internal test isolation override; leave unset for normal use                                    |

## Troubleshooting

- `EPERM` or database connection denied in a restricted execution environment: grant the task access to its local service/build action. Do not disable system security globally.
- Windows port conflict: `netsh interface ipv4 show excludedportrange protocol=tcp`. Ports 5432 and 55432 were unavailable on this host; 15432 works. Do not stop unrelated apps.
- `docker compose ps` should show database and Redis healthy. Inspect `docker compose logs postgres redis` without sharing secrets.
- Prisma cannot find DATABASE_URL: run root npm scripts; `scripts/prisma.mjs` loads root `.env`.
- Stuck initial loading after rebuilding while a production Next server is running: restart that server; old and new build asset hashes differ.
- 403 mutation: use the configured browser origin, refresh the session/CSRF token, and check FRONTEND_URL.
- Paused jobs are deferred without exhausting failure retries. Resume via Automation. Emergency stop is independent and must also be cleared.
- Quality fails on a source: inspect the saved HTTP result, citation URL and human support note. Public link checking deliberately refuses private/local targets and IPv6-only hosts.
- Development compiles Nest through tsc, because esbuild/tsx does not emit Nest constructor metadata. Seed scripts may use tsx because they do not use Nest dependency injection.
- Tests use `--experimental-vm-modules` for Jest interop with current ESM parser dependencies. See TESTING.md.

## Stop / preserve data

Ctrl+C stops each owned foreground process. `docker compose stop` preserves data. `docker compose down` preserves named volumes. Do not use `down -v` unless you intentionally want to erase the databases.

Quality thresholds: QUALITY_MIN_WORDS defaults to 180 (minimum configurable value 80); QUALITY_SOURCE_MAX_AGE_DAYS defaults to 30. These are editorial heuristics, not Google ranking rules.

Docker environment updates require container recreation, since a plain restart preserves old environment values: docker compose --profile app up -d --no-deps --force-recreate backend worker. Native processes read root .env on startup.
