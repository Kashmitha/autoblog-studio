# Single-host production deployment

Use an always-on Linux host with Docker Compose supporting `!reset`. This overlay removes all database, Redis, backend and frontend host ports and publishes only Caddy ports 80/443. Configure DNS for the chosen hostname before certificate issuance. Preserve other domain records. The private Studio is sent noindex headers; this does not affect the separately hosted Blogger publication.

Keep a private root `.env` on the host (mode 600). Set NODE_ENV=production, STUDIO_DOMAIN to the hostname, FRONTEND_URL to its exact HTTPS origin, and GOOGLE_REDIRECT_URI to that origin plus /api/integrations/google/callback. Add the same callback to the existing Google OAuth web client. Preserve TOKEN_ENCRYPTION_KEY during migration; encrypted integration tokens cannot be recovered without it. Use a new production database password and session secret. Never commit runtime configuration or database backups.

Commands below run from the repository root:

```sh
docker compose -f docker-compose.yml -f infrastructure/production/compose.yml --profile app config -q
docker compose -f docker-compose.yml -f infrastructure/production/compose.yml --profile app build backend worker migrate
docker compose -f docker-compose.yml -f infrastructure/production/compose.yml --profile app build frontend
```

On small hosts build these groups sequentially and provision swap before building. Restore a fresh database dump and original-upload volume into a new empty target while automation is paused. Do not restore over an existing deployment. Start the web stack without the worker first, validate login, content counts, media credits/delivery and integration access, then switch to one active worker. Leave the old installation paused and its worker stopped. Remote schedule reconciliation must be checked before publishing resumes; an uncertain Blogger write must not be replayed blindly.

```sh
docker compose -f docker-compose.yml -f infrastructure/production/compose.yml --profile app up -d backend frontend caddy
# After checks and explicit cutover:
docker compose -f docker-compose.yml -f infrastructure/production/compose.yml --profile app up -d worker
```

Cloudflare must connect to the origin using HTTPS (Full/Full strict); Flexible mode can cause redirect loops. Avoid global SSL changes that would disrupt unrelated sites sharing the zone. Certificate data and uploaded originals live in persistent named volumes. Keep off-host backups of PostgreSQL, original files and the encryption key; validate restoration into an isolated database. Log rotation is bounded by this overlay. Security groups should permit web traffic and restrict SSH, with no public database or Redis ingress. The deployment does not claim guaranteed daily publication or exactly-once delivery across external service failures.
