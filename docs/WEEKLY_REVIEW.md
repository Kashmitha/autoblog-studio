# Weekly review

Open **Overview → Weekly review**. The panel brings saved publishing, search-import and ad-report evidence together with links to the next owner actions. **Refresh summary** rereads local records only. It does not import provider data, request indexing, publish or schedule posts, resume automation or change settings.

## Date ranges and meanings

- Publishing counts cover the seven completed calendar days before today in Asia/Colombo. Today is excluded. Counts use saved PUBLISHED status and publishedAt values. Unsynced Blogger status can lag the public site.
- Review and approval counts are the current workspace queue, not limited to those seven days. Up to three future saved schedules appear in date order. Local schedules require the computer and worker; confirmed Blogger-held schedules run independently. Past SCHEDULED records are flagged as awaiting status confirmation, not assumed failed or published.
- Search shows the latest saved import attempt for the selected reporting property and retains the prior successful read after failure. Its requested dates use Google's Pacific calendar. EMPTY is a successful read with no rows; it does not prove zero traffic or indexing. Imported row count is not visitors, clicks or impressions. No current OAuth or provider availability claim is made by saved evidence.
- Ads show only the latest saved snapshot in its own source range. Snapshots are not added together, and the report is not relabeled as a weekly total. Missing reports remain unavailable; reported zero remains zero. Scope/timezone labels may be unknown or owner-entered. Exported revenue is not proof of payment or ledger income.

Next-action links depend on the current review queue, schedules, emergency-stop flag and saved reporting coverage. Opening them does not perform the action. Draft approval and publication authorization remain separate owner steps.

## Implementation and verification

Owner-only `GET /api/dashboard/weekly-review` returns a non-cacheable, read-only repeatable-read database snapshot with explicit projections. It does not read credentials, call Google/Adsterra or write audit, traffic, finance or publishing records. No migration or new dependency is needed. Environment property fallback matches existing reporting selection when a database selection is absent.

Verification includes Sri Lanka midnight and leap-day boundaries, publication-window inclusivity, queues independent of the window, future/past schedules, property-scoped search history, retained successful reads, absent/malformed ad summaries, owner session protection and unchanged persistent records. Browser checks cover missing sources, failed summary reads/retry and desktop/mobile layouts. Existing app-wide status/import refreshes remain separate from the weekly summary's read-only endpoint.
