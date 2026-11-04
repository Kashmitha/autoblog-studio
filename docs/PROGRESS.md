# Progress

Last updated: 4 November 2026, Asia/Colombo.

## Completed

- Read the full owner brief; initialized the empty workspace and Git repository.
- Verified Windows, Node 26.13.0 LTS (Lithium), npm 11.20, Git and Docker Desktop. Resolved Windows reserved ports without stopping unrelated applications.
- npm workspaces: Next.js 16.4.5, React 19.3.1, NestJS 11.2.8, Prisma 6.19.3, BullMQ 5.81.5, TypeScript 5.9.3, Tailwind 4.
- PostgreSQL 17 and Redis 7 persistent local containers; two Prisma migrations, indexes, uniqueness and database check constraints; owner/settings seed without fabricated business records.
- NestJS feature modules, dependency injection, class DTO validation, OpenAPI request schemas, session/CSRF/origin guards, rate limits, safe errors, audit logs and AES-GCM integration-token encryption.
- Next.js responsive light/dark dashboard, article management/editor and sandbox preview, planner, generator, media, calendar, automation, connections, monetization, traffic/SEO, expenses, job history, settings and help.
- Explicit editorial state machine, versioned approvals and quality reports, human source-support notes, actual public HTTPS link verification, heuristic duplication/content checks, image rights/credits, disclosure and unsafe-HTML controls.
- Original PNG/JPEG/WebP upload/private preview, public HTTPS delivery gate, reviewed Wikimedia and Unsplash search/import, download-event tracking and visible attribution.
- Pluggable AI provider using official Responses structured outputs, reviewed source context, model/token limits, PostgreSQL spending reservations, daily limits, conservative unknown-outcome accounting. Paid services disabled.
- Official Google OAuth with state/PKCE/offline refresh, owned-blog selection/test/read/disconnect, draft/update/publish adapter, explicit first-live-test gate, persistent insertion intent and remote-post recovery. Initial build used mock Google integrations; live read-only connection verification is recorded below.
- Dedicated BullMQ worker, PostgreSQL-first schedules, durable reconciliation, backoff, permanent-failure records, pause/resume, daily Asia/Colombo limits, seven-day recurring backlog scheduling, emergency stop, pinned blog destinations and worker heartbeats.
- Manual/CSV financial and traffic records, source labels, estimated/actual separation, net profit/RPM/break-even/monthly calculations, Google reporting adapters, sitemap checks, update reminders and dashboard failure notifications.
- Full local Docker application images built; migration/seed init container completed; API/worker/frontend running with healthy database/Redis and API proxy.
- GitHub Actions workflow and Windows setup/password-reset/backup scripts. A real backup restored successfully into an isolated database (1 owner, 1 settings row, 0 articles).
- Native production builds and type checks passed. 47 unit tests across 4 suites and 25 integration tests passed. Four Playwright/Edge checks passed against the local Docker stack through both localhost and 127.0.0.1, including populated and genuinely empty blog selectors and persistent AI provenance/disclosure controls.
- Production npm dependency audit: 0 known vulnerabilities. Development-only Jest/glob/minimatch/deepmerge paths retain 20 advisories (4 low, 16 moderate); no unsafe forced downgrade.
- Generated local owner password rotated after development; prior sessions revoked. Final E2E uses a disposable login and removes fixtures. No working-database sample income/traffic/publications retained.

## Current

- Final Docker image refresh and browser verification completed. Commons searches returned 9 laptop, 7 computer and 8 data-center candidates; all remain subject to owner rights review.
- Owner Google OAuth connection, saved owned-blog selection and live read-only connection test are verified. Eight existing posts were read without requesting their bodies; none of their titles matched the proposed Git unstaging topic.
- A first original AI-assisted tutorial, "How to unstage a file in Git without losing your changes", is saved in NEEDS_REVIEW. Three official documentation links returned HTTP 200; automated quality passed (97, editorial-review warning). All four command scenarios preserved working-file bytes in a separate local repository. No API AI spending, approval, schedule or external publication occurred. The ignored `.local/first-article-result.json` contains the local editor link and verification result.

## Genuine owner checkpoints / pending live verification

- B+C complete: Google Cloud setup, credentials, owner consent, intended owned-blog selection and read-only connection test are verified. Do not repeat this setup.
- Separate explicit first live publishing authorization, a reviewed real article, and live scheduling timing/duplicate/error verification. Do not perform a real post merely because the build was authorized.
- D optional: API key/current model prices/explicit paid billing authorization and one real AI generation. Disabled until the owner chooses to spend.
- E optional: Unsplash developer key/approval and actual account-rule verification. Commons/original-image handling needs no paid key.
- F: Adsterra publisher registration/site approval/ad placement and actual report reconciliation. Current implementation deliberately uses manual/CSV reporting, not an untested automatic Adsterra API client.
- G optional: verified Search Console/GA4 properties, enabled APIs, read-only OAuth scopes and actual report comparison.
- H: Any paid/remote production deployment requires explicit approval. No hosting purchase or external publishing took place.

## Limits and follow-up

- This is a working single-owner local implementation, not a production-ready SaaS. Tenant isolation/billing are future work.
- Automated quality, originality and source checks are editorial aids, not factual/legal/policy/ranking certificates; code examples need human verification.
- Private original uploads require public HTTPS delivery before approval. The app does not buy image hosting.
- Published article bodies/assets are immutable through this editor in V1; changes should be prepared as reviewed revisions. Blogger theme canonical/meta behavior must be checked on the actual blog.
- CSV supports USD. Do not mix site totals and URL-level traffic rows from the same source/date or duplicate recorded AI costs as manual expenses.
- Google reporting retains source timezone/top-row limits. Adsterra API existence is documented, but automatic sync is not implemented or claimed tested.

## Resolved failures

Sandbox network/Docker access, reserved PostgreSQL ports, Next generated-folder permissions, Jest ESM VM flag, unrelated app on port 3000, stale Next build assets, local-email DTO validation, dialog selector ambiguity, Node 26 pinned-DNS IPv4 handling, loaded Prisma Windows DLL, and Commons bitmap URLs carrying provider query strings. See TESTING.md for details.

## Next actions after DONE

1. Inspect saved editorial approval and the separate first-live authorization. A DONE response about blog selection does not grant either.
2. Keep paid AI disabled. Only after explicit owner approval of the real public test, change BLOGGER_MODE to live and recreate both backend and worker if needed.
3. Queue only the approved first-test article with the explicit first-test flag. Resume automation only within that authorization, then verify the actual remote result and duplicate protection. Never treat a mock result as a live verification.
4. Verify actual configured integrations incrementally and update this evidence without restarting the project.

## Sign-in origin fix — 4 November 2026

Reproduced localhost:3100 reaching authentication while 127.0.0.1:3100 returned the origin error. Added a shared exact-origin allowlist for CORS and mutation guards. Development permits only localhost/127.0.0.1/IPv6 loopback aliases with the configured scheme and port. Production retains a single configured origin. Missing, opaque, unrelated-host and wrong-port origins remain denied; CSRF remains required for authenticated mutations. Rebuilt/restarted Docker backend and worker. Verified 43 unit tests, 24 isolated integration tests and 2 real-browser workflows, including sign-in and editing through both local hostnames. Google OAuth should continue using its configured localhost redirect host.

## Blog discovery fix — 4 November 2026

Live read-only diagnosis confirmed Google returns per-user blog wrappers when fetchUserInfo=true. The adapter incorrectly read items instead of blogUserInfos[].blog, hiding an available blog. Corrected normalization while retaining the ADMIN filter and ordinary-list compatibility. Added an explicit genuine-empty state and a discovered-blog count to connection-test feedback. Both Docker production builds/type checks passed, 47 unit tests passed and all 4 browser checks passed. The authenticated live app API now returns one selectable owned blog. Verification did not select a blog, revoke consent or publish a post. Do not ask the owner to redo Google Cloud setup.

## First editorial draft — 4 November 2026

After the owner selected the blog, verified ownership and read-only access. Prepared a 458-word source-cited beginner tutorial using this assistant without a paid provider request. Checked tracked edits, partial staging, a newly added file and a path containing spaces with Git 2.55.0 in an isolated `.local` repository. Every case preserved the file bytes, emptied the path's staged diff and produced the expected status. This is evidence for the draft's examples, not a guarantee for every repository state.

Added an explicit AI-assistance field to editable article requests and the editor so drafts prepared outside the configured API can be marked truthfully. Recorded AI provenance cannot be removed through later article edits; disclosure is enforced by the backend. Creation and edits retain the existing editorial approval and version protections. The new integration regression passes; Docker backend/frontend production builds and type checks pass. Owner review and explicit first-live authorization remain pending; mock mode and paused automation remain in place.
