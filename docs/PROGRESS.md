# Progress

Last updated: 4 November 2026, Asia/Colombo.

## Completed

- Read the full owner brief; initialized the empty workspace and Git repository.
- Verified Windows, Node 26.13.0 LTS (Lithium), npm 11.20, Git and Docker Desktop. Resolved Windows reserved ports without stopping unrelated applications.
- npm workspaces: Next.js 16.4.5, React 19.3.1, NestJS 11.2.8, Prisma 6.19.3, BullMQ 5.81.5, TypeScript 5.9.3, Tailwind 4.
- PostgreSQL 17 and Redis 7 persistent local containers; three Prisma migrations, indexes, uniqueness and database check constraints; owner/settings seed without fabricated business records.
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
- Native production builds and type checks passed. 47 unit tests across 4 suites and 27 integration tests passed. Four Playwright/Edge checks passed against the local Docker stack through both localhost and 127.0.0.1, including populated and genuinely empty blog selectors and separate workspace provenance/public-footer controls.
- Production npm dependency audit: 0 known vulnerabilities. Development-only Jest/glob/minimatch/deepmerge paths retain 20 advisories (4 low, 16 moderate); no unsafe forced downgrade.
- Generated local owner password rotated after development; prior sessions revoked. Final E2E uses a disposable login and removes fixtures. No working-database sample income/traffic/publications retained.

## Current

- Final Docker image refresh and browser verification completed. Commons searches returned 9 laptop, 7 computer and 8 data-center candidates; all remain subject to owner rights review.
- Owner Google OAuth connection, saved owned-blog selection and live read-only connection test are verified. Eight existing posts were read without requesting their bodies; none of their titles matched the proposed Git unstaging topic.
- The first original AI-assisted tutorial, "How to unstage a file in Git without losing your changes", is PUBLISHED after the owner's saved editorial approval and explicit first-live-test authorization. Three official documentation links returned HTTP 200; automated quality passed (97, editorial-review warning). All four Git scenarios preserved working-file bytes in a separate local repository. No paid API AI request was made.
- The one authorized live test succeeded on 4 November 2026 at 20:31:32 Asia/Colombo. Version 6's approved body and labels match Blogger exactly, with the public AI footer off. One matching remote post exists. BLOGGER_MODE is now live; automation was paused again immediately after the test. The ignored `.local/first-live-result.json` contains the public URL and job timings. Do not republish this article or repeat the saved authorization.

## Genuine owner checkpoints / pending live verification

- B+C complete: Google Cloud setup, credentials, owner consent, intended owned-blog selection and read-only connection test are verified. Do not repeat this setup.
- First-live authorization, human approval, real publication, due-time handling and completed-job duplicate protection are verified for one actual article. Public desktop/mobile rendering, three citations, labels and canonical URL are verified. Live image publishing, long-term recurring scheduling and actual remote error/token-expiry recovery still need verification; isolated error/recovery tests pass.
- D optional: API key/current model prices/explicit paid billing authorization and one real AI generation. Disabled until the owner chooses to spend.
- E optional: Unsplash developer key/approval and actual account-rule verification. Commons/original-image handling needs no paid key.
- F: Adsterra publisher registration/site approval/ad placement and actual report reconciliation. Current implementation deliberately uses manual/CSV reporting, not an untested automatic Adsterra API client.
- G optional: verified Search Console/GA4 properties, enabled APIs, read-only OAuth scopes and actual report comparison.
- H: Any paid/remote production deployment requires explicit approval. No hosting purchase occurred; only the specifically authorized Blogger test post was published.

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

1. The initial approved article is already PUBLISHED; inspect the saved result rather than scheduling it again. BLOGGER_MODE is live and automation is paused after the single test.
2. Keep paid AI disabled. New articles still require human editorial approval; publishing requires the owner to resume automation or authorize the next scheduled run.
3. Ask only for account-specific next actions the owner chooses, such as optional paid AI, publisher registration or read-only reporting consent. Do not repeat Google setup, first-live authorization or the completed first publication.
4. Verify actual configured integrations incrementally and update this evidence without restarting the project.

Owner subsequently confirmed the live-post review is DONE. The next required earnings checkpoint is F: use the owner's Adsterra publisher account, submit the existing Blogger domain for review and obtain an approved ad-unit snippet. Paid AI and Unsplash remain optional; neither is required to submit the site. No additional article publication, ad activation, account registration or purchase was performed. Ask for the actual Pending/Approved account status rather than repeating the first-post test. Studio currently tracks manual/CSV earnings; its Monetization page does not create an ad account or install ads.

The owner subsequently supplied a native-banner loader and its container snippet. Saved the exact snippet in ignored `.local/adsterra-native-banner.html`. A non-executing static request returned HTTP 200/application-javascript with an empty body; this does not establish ad fill, account approval or script safety. No ad code has been installed by the assistant. Next action is Blogger → Layout → Add a Gadget → HTML/JavaScript in an available below-post/footer position, paste both supplied elements once, save the gadget and arrangement. After the owner saves it, verify the public loader/container presence and desktop/mobile rendering without clicking ads. Use provider-issued ads.txt entries if required; never invent publisher values.

## Sign-in origin fix — 4 November 2026

Reproduced localhost:3100 reaching authentication while 127.0.0.1:3100 returned the origin error. Added a shared exact-origin allowlist for CORS and mutation guards. Development permits only localhost/127.0.0.1/IPv6 loopback aliases with the configured scheme and port. Production retains a single configured origin. Missing, opaque, unrelated-host and wrong-port origins remain denied; CSRF remains required for authenticated mutations. Rebuilt/restarted Docker backend and worker. Verified 43 unit tests, 24 isolated integration tests and 2 real-browser workflows, including sign-in and editing through both local hostnames. Google OAuth should continue using its configured localhost redirect host.

## Blog discovery fix — 4 November 2026

Live read-only diagnosis confirmed Google returns per-user blog wrappers when fetchUserInfo=true. The adapter incorrectly read items instead of blogUserInfos[].blog, hiding an available blog. Corrected normalization while retaining the ADMIN filter and ordinary-list compatibility. Added an explicit genuine-empty state and a discovered-blog count to connection-test feedback. Both Docker production builds/type checks passed, 47 unit tests passed and all 4 browser checks passed. The authenticated live app API now returns one selectable owned blog. Verification did not select a blog, revoke consent or publish a post. Do not ask the owner to redo Google Cloud setup.

## First editorial draft — 4 November 2026

After the owner selected the blog, verified ownership and read-only access. Prepared a 458-word source-cited beginner tutorial using this assistant without a paid provider request. Checked tracked edits, partial staging, a newly added file and a path containing spaces with Git 2.55.0 in an isolated `.local` repository. Every case preserved the file bytes, emptied the path's staged diff and produced the expected status. This is evidence for the draft's examples, not a guarantee for every repository state.

Added an explicit AI-assistance field to editable article requests and the editor so drafts prepared outside the configured API can be marked truthfully. Recorded AI provenance cannot be removed through later article edits; disclosure is enforced by the backend. Creation and edits retain the existing editorial approval and version protections. The new integration regression passes; Docker backend/frontend production builds and type checks pass. Owner review and explicit first-live authorization remain pending; mock mode and paused automation remain in place.

## Owner writing and public-footer preference — 4 November 2026

The owner requests natural, useful developer articles and no stock AI-assistance sentence appended publicly. Updated generation instructions and recorded the preference in EDITORIAL.md. AI-detector outcomes and earnings are not guaranteed; do not fabricate human-only authorship, personal experience or test results.

This preference supersedes the earlier mandatory public-disclosure implementation. Internal AI provenance remains recorded, while the public footer is optional and defaults off for new drafts. Generation preserves the saved footer choice. Enabling it adds only "Prepared with AI assistance." and does not claim an unfinished draft was reviewed. Human editorial approval and version invalidation remain required.

Applied the default-only database migration, rebuilt/recreated backend, worker and frontend, then switched off the existing tutorial's footer through the authenticated article API. Article text and labels are unchanged; it is version 6, NEEDS_REVIEW, quality passed, with zero attached images and zero publish jobs. Paid AI remains disabled; mock publishing and paused automation remain unchanged. Tests: 47 unit, 27 isolated integration, 4 browser checks passed. Mocked worker tests verify exact Blogger payloads with the footer on/off and labels included.

The editor now identifies which metadata syncs: labels do; the excerpt and canonical reference do not configure Blogger search description, permalink or canonical tags. Custom permalink/search description require Blogger's editor; no remote-draft review step is implemented yet. For this short Git tutorial, code examples are sufficient; an original terminal screenshot is optional. Existing license/alt/public-delivery gates still apply to any image.

## First authorized live publication — 4 November 2026

Confirmed the owner saved editorial approval for version 6 and had already granted the separate first-live authorization. Verified selected-blog ownership, no other approved backlog, zero pending jobs and no remote post with the same title. Changed only BLOGGER_MODE in the ignored .env to live and recreated backend/worker. Paid AI remained disabled.

Scheduled exactly one job with the explicit first-test flag for 20:31:24 Asia/Colombo. It stayed unpublished before its due time. The worker started 75 milliseconds after the scheduled time and Blogger confirmed LIVE at 20:31:32, on attempt 1. Automation was paused again immediately after success. Actual scheduling evidence applies to this short-delay test, not yet to long-running daily recurrence.

Authenticated read-back verified exact approved HTML, all three labels, three primary citations and no appended AI footer. Full remote enumeration found one matching post and nine total posts, versus eight before the test. Replaying the completed local job through a fail-on-any-remote-call adapter made no remote calls and did not increase its attempt count. A public browser returned HTTP 200 and displayed the article/code/citations; canonical matched the returned URL, no page-level noindex meta was present and the mobile page had no horizontal document overflow. Desktop/mobile screenshots and identifying post/job data are kept only under ignored .local files. These checks do not establish Google indexing, traffic, revenue or image-publication behavior.
