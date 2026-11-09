# Automatic search traffic imports

Open **Traffic & SEO → Search traffic imports**. The existing verified Search Console property and read consent are sufficient; no new Google project, payment or Analytics setup is needed. This feature imports search clicks/impressions. It does not publish posts, request indexing, create pageviews or import Adsterra earnings.

## How it runs

While Studio is visible, the existing follow-up loop checks on opening after Blogger status sync, when returning to the tab, after reporting configuration changes and every 30 minutes. A completed automatic import is reused for 24 hours. Failed automatic reads wait one hour from completion. Checks pause with Studio closed; accepted Blogger schedules and Google's crawling continue independently.

The first completed automatic import for a property backfills 56 completed Pacific calendar days, supporting the current/previous 28-day comparison. Subsequent daily imports revisit the latest seven completed days to pick up reporting updates. An owner wanting an older comparison can still use the manual date controls; each manual range is limited to 93 valid calendar days. This refresh does not backfill the full previous period of the optional 90-day view automatically.

**Sync search traffic when due** respects the same cadence rather than forcing repeated Google reads. Manual imports reuse an identical range for five minutes; failed manual imports wait one minute, or 15 minutes after a quota failure. Concurrent automatic/manual requests share the active property claim. A 15-minute unfinished claim is marked interrupted and can be retried safely; returned rows use idempotent upserts.

## Reading history

- **Search rows imported:** the returned, validated rows were saved. The count includes upserts, not just newly created database rows.
- **Connected · Google returned no rows:** the request succeeded with no usable report rows returned by Google. It is not a claim of zero traffic or completed indexing. A nonempty response containing no usable metrics is treated as invalid, not a successful empty response.
- **Import failed:** the attempt did not complete. The last successful read remains separately available, with its original time and range.
- **Import in progress:** another request is working. The screen polls saved status every five seconds during the active claim; it does not start more Google reads.

The latest attempt, last successful read, requested date range, next automatic eligibility and 20 most recent attempts are scoped to the selected property. A separate latest-success query preserves that confirmation beyond the history limit. Displayed times use Asia/Colombo; report dates retain Google's Pacific date labels. A successful empty read is a successful connection/read result, not financial or SEO success.

Imports validate all returned pages before a single parameterized SQL upsert. A later Google page failure or invalid report does not commit an earlier partial report. Missing fields retain previously recorded known values, explicit zeros stay zero, and API/CSV figures are not added together. Empty or omitted rows do not erase older saved observations; performance totals describe the saved records, not a guaranteed complete current Google extract. Malformed, outside-property/range, invalid-count and unbounded reports fail clearly. The 100,000-row application cap requires a narrower manual range instead of silently importing a partial report. Provider errors are sanitized before storage/display.

## Implementation

Seventh additive migration `20261106130000_traffic_sync_history` creates TrafficSync with state/trigger/range/count checks. No existing article, schedule or finance schema changes. TrafficSyncService serializes short claim decisions under advisory lock 8172202, then performs bounded Google reads outside the claim transaction. A crash cannot create duplicate external posts because this feature only reads Google. No in-process task is claimed to run while the computer is off.

Owner-protected GET `/api/reports/search-console/status` reads history; POST `/api/reports/search-console/refresh-due` checks the automatic cadence. The existing POST `/api/integrations/search-console/sync` now records manual attempts. POSTs require Origin and CSRF. Status refresh events reload reporting/dashboard resources, not editable article forms. No raw credentials/provider error payloads are retained in these records.

## Verification — 6 November 2026

- 93 unit cases passed across seven suites. New cases cover strict/inclusive calendar ranges, Pacific daylight-saving boundaries, cadence/backoff and no partial writes after a later Google page fails.
- All 70 isolated integration cases passed across four suites. Nine new cases cover session/Origin/CSRF, concurrent claim coalescing, EMPTY versus failure, daily/bootstrap windows, last-success retention, manual cache/ranges, property isolation, interrupted claims and real PostgreSQL bulk-upsert atomicity/idempotency/unknown values.
- Sixteen Edge browser cases passed across both local addresses, including the two new history cases rerun after correcting a duplicate-text selector. The tests distinguish empty reads from failures, retain earlier success and verify mobile layout. Test fixtures never enter the working database.
- The working database was backed up before the additive migration. Backend/worker/frontend/migration production images built successfully and local services were recreated. Type checks passed. The native Windows client metadata was generated; its already-loaded engine could not be replaced, but its SHA-256 matches the replacement exactly. Docker client generation and the native database integration cases both succeeded without stopping another process.
- Actual automatic Google read completed **6 November at 18:40:12 Asia/Colombo**, for 11 September–5 November, and returned **EMPTY / 0 rows**. The next eligibility is 7 November at 18:40:12 or the next visible Studio visit. Repeated API/UI checks reused that same history row and did not issue another Google query. Desktop/mobile actual-data checks passed with no page errors/overflow.
- Final comparison confirms the four real articles and remote metadata, remaining Blogger schedules, paused local automation and disabled paid AI are unchanged. Private evidence is ignored under `.local/automatic-traffic-*`, `.local/traffic-sync-*` and the prior material-state baseline.

References: [Google Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [reporting load and quota guidance](https://developers.google.com/webmaster-tools/limits).
