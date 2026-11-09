# Published-page fetch diagnostics

Installed 6 November 2026. Open a published article and find **Live fetch diagnostics** below its separate Google indexing card. Choose **Check live redirects**. Opening the panel or downloading a saved report does not fetch the public page.

The check records desktop and mobile HTTP response chains. Blogspot pages also receive mobile requests with `?m=1` and `?m=0`. Expand a profile to see each status and destination, HTML canonical, applicable robots/noindex directives and refresh instructions. Reports show the exact article title, public URL and Sri Lanka check time. Download the saved JSON for troubleshooting; the five latest checks remain available.

## Reading the result

- **No issue reproduced in these requests:** these particular requests completed without a detected finding. This does not prove Google's earlier failure is fixed.
- **A fetch issue was observed:** a loop, unsuccessful final status, missing redirect destination or applicable noindex directive was detected.
- **Fetch findings need review:** metadata, refresh instructions, unsupported destinations or diagnostic limits need investigation. These are not automatic proof of indexing failure.
- **The check was inconclusive:** Studio could not complete a bounded request. Previous Google results remain separate.

This is not Google's Test Live URL. It runs without JavaScript or ads, does not fetch robots.txt, and does not originate from Google's verified crawler network. It cannot request indexing, confirm Google's canonical selection or change Blogger settings. HTML metadata is parsed rather than searched inside script strings; Google-relevant robots tags in the body are assessed. Canonicals outside the head, multiple/different/missing canonicals and refresh instructions are review findings. HTTP Link canonicals, JavaScript-generated metadata and HTML base URL behavior are outside this diagnostic.

## Current real evidence

The first tutorial is **How to unstage a file in Git without losing your changes**:

`https://devaitoolbox.blogspot.com/2026/11/how-to-unstage-file-in-git-without.html`

Studio's check on **6 November 2026 at 20:06 Asia/Colombo** returned desktop 200, mobile 302 to `?m=1` then 200, and direct mobile m=1/m=0 responses of 200. All four returned the expected canonical, no applicable noindex and no detected refresh instruction. Outcome: NO_ISSUE_REPRODUCED.

Google's saved report still records **Redirect error**, from a crawl at **6 November 17:37:27 Asia/Colombo**. The diagnostic did not update or replace that report. The owner's successful Google live test on 5 November predates this failure. Run a fresh **TEST LIVE URL** in the owner's already-authorized Search Console window, expand **Page availability**, and compare the test time and Page fetch result. If it fails, inspect **View tested page → More info** when available. A successful live test still does not confirm inclusion in the index. See Google's [URL Inspection documentation](https://support.google.com/webmasters/answer/9012289?hl=en).

## Limits and implementation

- Owner session protects reads/downloads; POST retains Origin/CSRF guards. Targets come only from published article records on the exact selected owned blog HTTPS origin. No arbitrary URL input is accepted.
- Every request resolves public IPv4 addresses and pins a validated address while retaining TLS checks. Private/local addresses, alternate ports, credentials and off-blog redirects are not followed. Bodies are limited to 2 MB; each profile allows six responses within 40 seconds, each request at most eight seconds including DNS. Four profiles run concurrently. These are Studio limits, not Google's redirect limits.
- Completed reports are reused for 15 minutes, failed runs for one minute, active claims for two minutes. A durable database claim coalesces concurrent requests; stale runs can recover. Maximum 20 runs per UTC day across the workspace. Checks are manual, independent of daily Google report refreshes.
- FetchDiagnostic stores compact statuses, safe metadata and Google's stored summary at check time. No response HTML, cookies, credentials or external redirect targets are stored. Export includes the current saved Google summary.
- Routes: GET `/api/seo/articles/:id/fetch-diagnostics`, POST `.../run`, GET `.../export`. The eighth additive migration is `20261106150000_fetch_diagnostics`; a database backup preceded deployment.
- Shared editorial public HTTP transport includes bounded DNS and whole-request deadlines. htmlparser2 is a direct dependency at the version already used transitively by sanitize-html.
- Short reporting/diagnostic claim transactions have explicit acquisition/operation timeouts. API logs include safe Prisma error codes, never raw provider errors or secrets.

Read-only Blogger status synchronization requires the connected blog and pinned remote identity, independently of the first-publication authorization checkpoint. New schedules retain that checkpoint. A cleared checkpoint does not require authorizing another publication just to read already accepted schedules.

## Verification

105 unit tests, 79 isolated integration tests and 18 browser cases passed, along with type checks and production builds. Checks cover request protections, metadata, redirects, authentication, eligibility, concurrent claims, caching, limits, stale recovery, export and unchanged editorial/indexing state. A regression test verifies read-only Blogger sync with an unset publishing checkpoint while new scheduling remains blocked.

Actual authenticated desktop/mobile checks verified the saved chain and native JSON download. A before/after comparison verifies real article content, approvals, remote metadata, schedules and paused automation. Private evidence is under `.local/`; it is not committed.
