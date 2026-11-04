# Verification evidence

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
