# Verification evidence

Local verification on Windows, 4 November 2026. Results below are executed checks, not anticipated outcomes. External credentials were not supplied and no paid model request or live Blogger publication was made.

| Check                               | Executed result                                                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma generation                   | Passed with Prisma 6.19.3; stop native API/worker before replacing the Windows engine DLL                                              |
| PostgreSQL migrations               | Initial + publication-safety migrations applied to local PostgreSQL 17 and isolated autoblog_test                                      |
| TypeScript                          | Backend and frontend passed                                                                                                            |
| Backend production build            | Passed                                                                                                                                 |
| Next.js production build            | Passed with Next 16.4.5 / webpack                                                                                                      |
| Jest unit tests                     | 43 passed across 4 suites                                                                                                              |
| NestJS/PostgreSQL/Redis integration | 24 passed in isolated autoblog_test and autoblog-publish-test queue                                                                    |
| Playwright / Edge                   | Passed against the final Docker application (2 comprehensive Edge tests: localhost and 127.0.0.1, desktop + mobile)                    |
| Source-link verifier                | Actual HTTPS request to https://docs.docker.com/build/cache/ returned HTTP 200 (534,479 decoded characters at time checked)            |
| Production dependency audit         | 0 known vulnerabilities after compatible fixes/overrides; final repeat in PROGRESS.md                                                  |
| Full dependency audit               | 20 development-tool findings (4 low, 16 moderate) in Jest/glob/minimatch/deepmerge dependency paths; no forced major downgrade applied |
| Docker application images/runtime   | All app images built; migrations/seed exited successfully; frontend/API/worker running; database/Redis/API healthy                     |

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

Google OAuth consent/refresh/revocation, real owned-blog selection/draft/publication, first-live-test gate with actual credentials, actual scheduled Blogger timing, a paid AI response/usage-price comparison, Unsplash account/rate-limit compliance, real Google reporting reconciliation, Adsterra publisher approval and actual earnings import. Commons availability can be checked without credentials, but licenses still need per-image human review. A passing automated quality score never certifies factual accuracy, originality, image rights, policy compliance, advertising approval or rankings.

Backup and restore verification passed into a separate database with 1 owner, 1 settings row and 0 articles. Final Commons searches returned 9 laptop, 7 computer and 8 data-center candidates. Final owner-login check passed without printing credentials. OpenAPI exposed 45 endpoint paths and explicit article request fields. The GitHub Actions workflow is created; remote CI has not been run because no remote repository was configured.

Origin regression verification: development loopback aliases sign in successfully, authenticated writes still require CSRF, and wrong-port/unrelated/missing/null origins remain rejected. Production and non-loopback development configurations receive no extra origins. Docker production build passed and the refreshed application passed both browser projects.
