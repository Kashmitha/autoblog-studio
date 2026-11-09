# Article performance

Open **Traffic & SEO → Article performance**. The report lists Studio articles that Blogger has confirmed PUBLISHED, with exact public URLs and links to their editor. Scheduled articles join after the existing Blogger status sync confirms publication.

Choose 7, 28 or 90 completed days. The current period ends yesterday in Google Pacific Time; the immediately preceding equal period is shown for comparison. This uses calendar days across daylight-saving transitions. Search Console rows use Pacific dates, while Analytics and CSV retain their own source date labels; this is a comparison of reported date labels, not a conversion of all traffic into Sri Lanka time.

The report shows pageviews, search impressions, clicks, CTR and the change in recorded clicks. Missing metrics/days remain unknown (`—` in the interface, empty cells in CSV). Actual zeros remain zero. A percentage change from a zero previous value is unavailable rather than infinite. CTR requires both metrics on every selected search row and a positive impression count. Days with recorded values and the latest reported date are shown; those dates do not indicate when a sync ran or certify complete daily coverage.

## Add actual figures

Since the automatic-import update, Studio fills the standard 28-day comparison through a first 56-day backfill and daily seven-day refreshes while visible. See [traffic sync and history](TRAFFIC_SYNC.md). The existing date controls still support older/custom periods; failed or empty reads are clearly distinguished in the new history panel.

Use **Sync official Google reports** below the performance panel. The existing Search Console connection supplies clicks and impressions; pageviews require Analytics or actual CSV records. To compare periods, import dates covering both ranges shown above. Each Google import allows at most 93 days, so a 90-day comparison requires separate current/previous imports. Google can omit days or low-volume/top-row data; an empty successful response does not establish zero traffic. Re-importing the same source/date/URL updates its existing record.

Successful Google/CSV imports update the new panel. **Refresh saved reports** only reloads local records and does not contact Google. Search and sorting change the display; **Export full report CSV** includes all published articles in the selected period, regardless of the current text search.

One source is selected per article/metric family across BOTH periods: Google Analytics for pageviews and Search Console for search metrics when those values exist; otherwise MANUAL or one other labeled source is used. API and CSV sources are never added together. Source choices and recorded-day counts are visible under **Sources and coverage**. Site-wide totals are excluded from article rows. Known Blogspot `?m=0`/`?m=1` rendering variants and fragment anchors match their article; hosts, protocols and other query parameters remain distinct.

These totals do not confirm current indexing, calculate ad earnings or attribute site-wide Adsterra income to an article. Published, indexed, visited and earning revenue are separate observations.

## Implementation and limits

Owner-protected GET `/api/traffic/articles?days=28` reads the report; GET `/api/traffic/articles/export?days=28` downloads CSV. Only 7/28/90 are accepted. There are no Google calls or article/job writes in these endpoints. No migration, additional paid service or new Google permission is required. Reports include at most 500 published articles and explicitly flag truncation; more than 100,000 traffic rows requires a shorter range instead of returning silent partial totals. CSV quotes multiline text, neutralizes formula-looking strings and preserves unknowns as blanks.

## Verification — 6 November 2026

- 89 unit tests passed, including zero-versus-null handling, consistent sources across periods, sparse CTR, zero baselines, strict mobile-URL matching and CSV formula/quoting cases.
- 61 integration tests passed across three suites. Four new isolated-database cases cover authenticated report/export routes, supported periods, inclusive current/previous boundaries, unrelated/site-wide exclusions, mobile URL attribution, unchanged publication data and actual CSV values. The new suite passed after a test-only CSV parsing type fix; the other 57 cases passed unchanged.
- Fourteen Edge browser cases passed across localhost and 127.0.0.1, with the two new cases rerun after correcting a native-download fixture limitation. They cover zeros/missing values, search/sort, period changes, export target/response contract and mobile layout. The authenticated actual-data check separately verifies the native download and its real CSV contents.
- Actual Search Console sync for 11 September–5 November 2026 succeeded and returned **zero rows**. Both Studio published articles therefore retain unknown traffic metrics, not fabricated zeros. CSV export verified both rows and blank metrics. This does not confirm indexing or total absence of traffic.
- Actual-data browser checks exercised all three periods, title/URL search, native CSV download and desktop/mobile layouts, with no page errors or document overflow. Production builds and type checks passed. Private evidence is ignored under `.local/article-performance-*`.

References: [Search Analytics query and date/top-row limitations](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [Google's performance metrics](https://support.google.com/webmasters/answer/7576553?hl=en).
