# Verification evidence

14 November Blogger draft handoff: 125 unit tests, 117 isolated integration tests, backend/frontend TypeScript and all production Docker images passed. Seven new integration cases exercise explicit confirmation/current approval/version/CSRF, a private draft with no publish/schedule call or local job, concurrent idempotency, lost insertion response with existing-draft recovery, stored ID after failed read, emergency stop/duplicate titles and observation of later owner-managed schedules/publication. Existing interrupted-publication draft behavior still passes. Six focused browser checks across localhost/loopback cover typed consent, readonly metadata suggestions, locked post-handoff editing, uncertainty recovery and existing cloud scheduling. Desktop/mobile metadata-panel screenshots use isolated response fixtures, not a real owner-approved upload. Working-database baseline verification after the backed-up additive migration found all 16 article records, jobs, media, reports, saved policy and private environment unchanged, with zero real handoffs. No live upload, public post or paid generation occurred. See BLOGGER_DRAFT_HANDOFF.md.

13 November preparation UI checkpoint: frontend TypeScript and the production frontend image passed. Ten focused browser checks passed across localhost and 127.0.0.1, covering key-free preparation links, no provider search on prefilled navigation, missing Unsplash-key guards and provider metadata/photo-ID preservation through reviewed imports. Actual owner desktop/mobile checks show eight ready briefs and one eligible photo, with paid preparation disabled; no browser errors or document overflow. Preparation navigation made no media-search or feature mutation requests. Existing article/media/job/ad-report records, saved workflow/automation settings and private `.env` contents were unchanged. Independent app-wide provider refreshes were intercepted during the read-only UI check. No database/backend change, paid request, live image import or public post was needed for this frontend-only checkpoint.

13 November editorial pipeline: 125 unit tests across 14 suites and 110 isolated integration tests across 10 suites passed, alongside backend/frontend TypeScript checks and all four production images. Coverage includes policy/CSRF protections, costs blocked before generation, source/title/uncertainty checks, seven-day photo reuse exclusion for old briefs, retained paid drafts on missing media, no regeneration on photo resume, two-attempt cap, automatic Git brief refill, pinned-blog/paused/photo checks at remote handoff and standing-policy provenance. The full browser suite passed 60 checks before the optional refill control was added; all four editorial checks then passed with the refill control. Actual installed desktop/mobile verification confirms eight briefs, zero runs, disabled paid preparation, no document overflow/browser errors and unchanged existing material records. The Google connection's routine refresh timestamp advanced, with destination and checkpoint values unchanged. Provider tests use isolated mocks; no paid request or live Blogger write is claimed. See EDITORIAL_PIPELINE.md.

13 November weekly review: 119 unit and 102 isolated integration tests passed, with backend/frontend type checks and production builds. The first browser run passed all 50 existing cases; the six new weekly cases then passed across both hosts after the fixture was corrected to allow the app's initial summary refresh before simulating an outage. Coverage includes midnight/leap-day boundaries, per-source ranges, missing data versus zero, retained successful search evidence and read-only refresh. Actual owner desktop/mobile checks confirmed saved values, no document overflow and unchanged persistent article/finance/traffic/publishing/ad-history/automation state. See WEEKLY_REVIEW.md.

12 November report-comparison update: 22 focused calculation/browser checks passed across localhost and loopback, including date overlap, zero versus missing data, fractional revisions, conflicting/unknown metadata, failed reads and a delayed-response selection race. Frontend TypeScript and production Docker build passed. Actual saved-report desktop/mobile verification confirms shared-date impressions of 5 versus 5 and exclusive-date totals of 48 and 20, no financial writes from comparison, unchanged article/ledger/traffic/job/automation baselines and no document overflow. This frontend-only change needs no backend migration. Earlier suite counts below remain their original checkpoint evidence.

9 November checkpoint: 117 unit tests, 97 isolated integration tests, 38 browser-suite checks, backend/frontend type checks and production Docker builds passed. Saved Adsterra report history includes persistence, concurrent deduplication, revised/overlapping snapshots, owner/CSRF protection, malformed/oversize rejection and reopening after refresh. The real supplied report read-back verified 53 impressions, one click and exported $0 without changing articles, jobs, automation, ledger or traffic records. The working database was backed up before the tenth additive migration. See [ad reports](AD_REPORTS.md) and [current progress](PROGRESS.md) for scope and earlier archive/publishing-checkpoint verification.

Latest indexing/reporting update (5 November): [Search Console verification](SEARCH_CONSOLE_TESTING.md) records 81 unit tests, 52 isolated integration tests, ten Edge tests, six actual-data UI checks and the remaining read-consent checkpoint. Earlier evidence below is historical.

Latest scheduling update (5 November): see [Blogger scheduling verification](CLOUD_SCHEDULING_TESTING.md) for 49 unit tests, 38 isolated integration tests, six browser tests and actual owner-schedule linking. The original 4 November evidence below is retained as historical context.

Local verification on Windows, 4 November 2026. Results below are executed checks, not anticipated outcomes. The initial build used mocked account integrations. The owner subsequently configured Google OAuth, granted the first-live authorization and approved the first article. One actual Blogger publication is now verified. No paid model request was made.

| Check                               | Executed result                                                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma generation                   | Passed with Prisma 6.19.3; stop native API/worker before replacing the Windows engine DLL                                                     |
| PostgreSQL migrations               | Initial, publication-safety and optional-public-footer migrations applied to local PostgreSQL 17 and isolated autoblog_test                    |
| TypeScript                          | Backend and frontend passed                                                                                                                   |
| Backend production build            | Passed                                                                                                                                        |
| Next.js production build            | Passed with Next 16.4.5 / webpack                                                                                                             |
| Jest unit tests                     | 47 passed across 4 suites                                                                                                                     |
| NestJS/PostgreSQL/Redis integration | 27 passed in isolated autoblog_test and autoblog-publish-test queue                                                                           |
| Playwright / Edge                   | Passed against the final Docker application (4 Edge checks across localhost and 127.0.0.1: full workflow plus populated/empty blog selectors) |
| Source-link verifier                | Actual HTTPS request to https://docs.docker.com/build/cache/ returned HTTP 200 (534,479 decoded characters at time checked)                   |
| Production dependency audit         | 0 known vulnerabilities after compatible fixes/overrides; final repeat in PROGRESS.md                                                         |
| Full dependency audit               | 20 development-tool findings (4 low, 16 moderate) in Jest/glob/minimatch/deepmerge dependency paths; no forced major downgrade applied        |
| Docker application images/runtime   | All app images built; migrations/seed exited successfully; frontend/API/worker running; database/Redis/API healthy                            |

## What automated tests cover

- Explicit valid/invalid article transitions; publication cannot skip approval.
- Version conflicts and invalidation of approval after edits.
- Session cookies, authentication, DTO validation, CORS-origin/CSRF mutation protection.
- PostgreSQL persistence, source evidence, citation presence, stale/broken links, unsafe HTML, topic similarity, AI disclosure and real image attribution requirements.
- Real Redis/BullMQ worker execution of a mock publication; duplicate retry does nothing; DB-to-queue reconciliation restores missing dispatch.
- Paused jobs are deferred without consuming permanent failure retries.
- A simulated live recovery gets a stored remote post ID already LIVE and does not insert/publish a duplicate. All Google methods are mocked for that test.
- Publishing errors persist reasons and fresh review is required to retry permanently failed work.
- Original PNG upload, private preview delivery, public-delivery requirement, attribution storage and fake SVG rejection.
- Unsplash download-event success/failure and exact creator/metadata handling using mocked fetch only.
- Actual/estimated financial separation, zero earnings, absent pageviews/RPM and idempotent CSV imports.
- Traffic source upserts preserve unavailable metrics rather than fabricating data.
- AI enable/billing gate, cost reservations, monthly ceiling, concurrent daily limit and conservative unknown-outcome accounting through a fake AiProvider. No paid API is called.
- Browser sign-in, article creation/save, blocked thin/unsourced content, sandboxed HTML preview, theme toggle, all major navigation pages and mobile viewport overflow check.

## Reproduce

```powershell
npm test
npm run test:integration
npm run typecheck
npm run build
# Start API/frontend before the browser test; Microsoft Edge must be installed.
npm run test:e2e
npm run audit:prod
```

Integration runner loads root `.env`, creates/migrates the fixed isolated `autoblog_test` database and refuses to run destructive test cleanup against another database name. The test Redis queue is separate. Fixtures never appear as actual financial results in the working database.

E2E temporarily creates a disposable local test login, creates a clearly named fixture article and deletes both in finally cleanup. Test traces/screenshots are ignored by Git and can contain private test-session details; do not publish raw traces. Current operator credentials are not used by the final E2E test. Screenshots live in `.local/screenshots/`.

## Failures found and corrected

- Initial Docker/npm calls were blocked by sandbox access, resolved with approved local execution.
- Windows reserved the first database ports; moved PostgreSQL to 15432.
- Next generated catch-all route folders needed filesystem access; approved build succeeded.
- Jest current ESM parser interop needs `--experimental-vm-modules`; unit tests passed after configuring it.
- First E2E reached an unrelated service on port 3000; AutoBlog now uses 3100.
- Rebuilding a running production Next server left old asset hashes; restarting with the current build fixed initial hydration/loading.
- Default `@localhost` owner email required IsEmail require_tld=false; corrected and verified in browser.
- Browser create button needed a dialog-scoped locator.
- Public HTTPS checker needed explicit IPv4 family with pinned lookup for Node 26; verified against actual official documentation after the fix.
- Prisma Windows engine replacement failed while loaded in native processes; stopping those owned processes allowed regeneration.

## Remaining live checks

Google token-expiry/revocation behavior, actual remote failure/recovery, long-term daily recurrence, live image publication, a paid AI response/usage-price comparison, Unsplash account/rate-limit compliance, real Google reporting reconciliation, Adsterra publisher approval and actual earnings import. Owned-blog selection, first-live authorization, actual approved publication and a short-delay scheduled run are verified. Commons availability can be checked without credentials, but licenses still need per-image human review. A passing automated quality score never certifies factual accuracy, originality, image rights, policy compliance, advertising approval or rankings.

Backup and restore verification passed into a separate database with 1 owner, 1 settings row and 0 articles. Final Commons searches returned 9 laptop, 7 computer and 8 data-center candidates. Final owner-login check passed without printing credentials. OpenAPI exposed 45 endpoint paths and explicit article request fields. The GitHub Actions workflow is created; remote CI has not been run because no remote repository was configured.

Origin regression verification: development loopback aliases sign in successfully, authenticated writes still require CSRF, and wrong-port/unrelated/missing/null origins remain rejected. Production and non-loopback development configurations receive no extra origins. Docker production build passed and the refreshed application passed both browser projects.

Blog-discovery regression: mock tests cover per-user wrappers, ordinary item lists, empty responses and incomplete entries. Browser tests verify a selectable populated list, owned-blog count feedback and explicit genuine-empty guidance. A live authenticated read-only request through the local app returned one blog with the fields needed for selection. No identifying Google account data, credentials, blog IDs or blog URLs are committed in this evidence.

Imported-draft provenance: integration checks confirm later edits cannot clear recorded AI provenance, while the public footer can be enabled or disabled. Mocked live-worker tests verify the exact Blogger insert/update payload both with and without that footer and confirm labels are included. Both browser projects verify the internal record persists, public-footer changes affect the preview, and the public footer defaults off. The first real article is now PUBLISHED after owner approval and one successful live job; three official source URLs returned HTTP 200 and its quality score was 97 with the editorial-review warning. Its Git command examples passed four isolated checks (tracked modification, partial staging, new file and filename containing spaces), including byte-for-byte working-file preservation.

First authorized live test: one article scheduled for 20:31:24 Asia/Colombo on 4 November 2026 started 75 ms after its due time and finished at 20:31:32, on attempt 1. Blogger read-back confirmed LIVE, exact approved HTML, matching labels, three citations and no public AI footer. Remote enumeration found exactly one matching post (total nine, previously eight). Completed-job replay with a fail-on-remote-call adapter made zero remote calls and retained attempt count 1. Public Edge browser verification returned HTTP 200, visible code, correct canonical, no noindex meta and no mobile document overflow. Automation was paused afterward; BLOGGER_MODE remains live. Results and public screenshots live in ignored `.local/first-live-result.json`, `.local/public-post-verification.json` and `.local/screenshots/first-live-public-*.png`. Search indexing, revenue and live image handling are not established by this test.
