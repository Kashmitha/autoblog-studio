# AutoBlog Studio

A local-first editorial workspace for Kashmitha Madushan. Plan useful developer tutorials, research primary sources, review quality and licensed images, approve work, and schedule Blogger publishing through a durable NestJS/BullMQ worker. Next.js is the frontend; PostgreSQL is the source of truth.

**Local implementation; external integrations require owner setup and live validation. This is not declared production-ready.** Paid AI and real publishing start disabled. Mock publications never inflate published counts, traffic or income.

## Start on Windows

Requirements: Node 24.11+ or 26 LTS, npm, Docker Desktop with Linux containers and Git. No paid account is needed for local development.

```powershell
npm ci
npm run setup
npm run services
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build -w backend
npm run dev
```

Open **[AutoBlog Studio](http://localhost:3100)**. Read OWNER_EMAIL and OWNER_PASSWORD privately from local `.env`; do not paste them in chat. Port 3100 avoids another application on 3000. PostgreSQL binds 15432 and Redis 56379 because Windows reserved the initial database ports.

For production-mode local servers after `npm run build`, run in three terminals:

```powershell
npm run start -w backend
npm run worker -w backend
npm run start -w frontend
```

API health: [localhost:4000/api/health](http://localhost:4000/api/health). OpenAPI: [localhost:3100/api/docs](http://localhost:3100/api/docs). Keep automation paused until you intend to test it.

## Verify

```powershell
npm test
npm run test:integration
npm run build
npm run test:e2e
npm run audit:prod
```

Integration tests automatically create **autoblog_test**, run migrations there and use a separate Redis queue. E2E requires the local API/frontend and Microsoft Edge. See [test evidence](docs/TESTING.md) for actual outcomes and limits.

## Workflow

1. Create an article with a specific reader question.
2. Add primary URLs and human notes about supported claims; write HTML or use authorized AI.
3. Check source links and quality, review code and facts, attach reviewed images and inspect the preview.
4. Approve with review notes. Edits invalidate approval.
5. Schedule; resume automation for the worker to execute. Defaults: two articles/day, 09:00 and 17:00 Asia/Colombo, paused, mock mode.
6. Follow the [owner checkpoints](docs/CHECKPOINTS.md) before a real Blogger connection/publication. No live post has been authorized by this build request alone.

## Documentation

- [Setup & environment variables](docs/SETUP.md)
- [Architecture](docs/ARCHITECTURE.md) and [implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Progress & remaining work](docs/PROGRESS.md)
- [Portable content archive](docs/CONTENT_ARCHIVE.md)
- [Adsterra reports and saved history](docs/AD_REPORTS.md)
- [Completed-feature GitHub checkpoints](docs/GITHUB_WORKFLOW.md)
- [Integration contracts & official sources](docs/INTEGRATIONS.md)
- [Costs & profitability](docs/OPERATING_COSTS.md)
- [Testing](docs/TESTING.md), [deployment & backups](docs/DEPLOYMENT.md)
- [Owner checkpoints](docs/CHECKPOINTS.md)

Original photos/screenshots can be uploaded privately, then assigned a public HTTPS delivery URL you control before approval. Automated originality/quality checks are heuristics and cannot certify factual correctness, licensing, policies or search outcomes. Adsterra uses manual/CSV records in this version despite the now-documented official publisher API. No ads are injected automatically.
