# Architecture

AutoBlog Studio is a single-owner npm-workspace monorepo. Next.js App Router is the interface; NestJS owns all rules and external access. PostgreSQL/Prisma is authoritative. Redis/BullMQ executes durable publishing records through a separate NestJS application-context worker. No Medium, paid hosting, or artificial traffic.

## Decisions

- Use installed Node 26.13.0 LTS (Lithium); Docker images use Node 24 LTS for a conservative deployment baseline.
- Next.js 16, React 19, Tailwind 4. NestJS 11 and Prisma 6 are deliberately pinned to stable compatible major lines rather than introducing NestJS 12 ESM/TypeScript 6 migration or Prisma 8 release candidates. Reassess supported versions before commercial release. Exact resolved versions live in package-lock.json.
- Same-origin `/api` rewrite proxies the backend; there are no duplicate Next.js business handlers.
- DB-backed opaque sessions use HTTP-only SameSite=Lax cookies, expiry, hashed identifiers, explicit Origin checks and CSRF tokens. External credentials use AES-256-GCM at rest. Owner setup is local, without public registration.
- Editing invalidates approval and quality reports. Scheduled/publishing/published bodies are immutable. Every approval creates a version-bound report and state event.
- Scheduling writes PostgreSQL before queue dispatch. A recurring worker reconciliation restores missing pending jobs after restarts. A transaction-scoped PostgreSQL advisory lock serializes remote publication across workers. The daily limit uses Asia/Colombo day boundaries.
- Blogger-hosted scheduling is a separate explicit path after the first successful live test. It commits upload intent and a cloud-target job, creates the draft now, hands `publishDate` to Google and confirms SCHEDULED via an ADMIN read. Cloud jobs are excluded from queue reconciliation and worker execution. Linked posts are protected from local edits, cancellation, recurrence and retries. Read-only sync records remote dates/status and retains the last confirmation on failure. Local pause does not cancel Google's accepted schedules; cancellation/remote changes use Blogger itself. See BLOGGER_SCHEDULING.md.
- Remote draft creation is recorded _before_ the external insert. If an insert result is ambiguous, stop for reconciliation rather than blindly insert again. A stored remote post ID makes subsequent draft/publication retries safe. Exactly-once network delivery is not assumed.
- Blogger defaults to a clearly labeled mock adapter. Mock jobs never count as published articles or business revenue. Live mode requires OAuth, an owned blog, explicit initial-test authorization, and a successful first test before routine automation.
- Research checks public HTTPS URLs with pinned DNS results and bounded redirects, timeouts and response size. Source-review notes are human evidence; automated checks do not certify facts, licenses or originality.
- Real financial and traffic records start empty. Estimates are separate from actual revenue and excluded from net profit. AI cost reservations are serialized in PostgreSQL before requests. Paid AI starts disabled.
- Search Console uses separate read consent and a selected verified property. IndexInspection observations are stored independently of articles/jobs and keyed by article, property and published URL; failed refreshes retain the latest successful result. Only PUBLISHED articles can be inspected. Cached/bounded manual reads use Google's stored-index API and never request indexing or a live test. OAuth token refresh writes use an optimistic encrypted-token comparison to preserve newer grants. See SEARCH_CONSOLE.md.

## Extension seams

AI provider interface, Blogger adapter, media-provider metadata, source-labeled traffic imports and network-labeled finance entries can be extended. This implementation is single-owner: SaaS requires tenant ownership on every row, tenant-scoped guards, per-tenant secrets, billing and isolation tests.

## Data flow

Browser → Next.js rewrite → NestJS session/CSRF/validation → application service → Prisma/PostgreSQL. Scheduled publication → durable PublishJob → BullMQ → worker → fresh quality gate → Blogger draft/publish → recorded result/audit. Dashboard reads stored data only.
