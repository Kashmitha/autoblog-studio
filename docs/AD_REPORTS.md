# Adsterra reports and saved history

Open Monetization and choose the native Adsterra CSV in **Adsterra report preview**. Export with Group by Date and these columns: Date, Impressions, Clicks, CTR, CPM, Revenue. Select the intended domain and reporting timezone in Adsterra first.

The browser previews daily rows, date coverage and totals locally. To keep the report, optionally enter the domain filter and timezone used in Adsterra, then click **Save ad report**. Saving uploads the CSV to the local backend for validation and stores its normalized snapshot in the database. The raw file is not retained. Owner-entered labels are not independently verified. Leaving either label blank records it as unknown.

After refreshing, choose a snapshot in **Saved Adsterra reports (latest 30)** to reopen it without uploading again. The selector shows the latest thirty snapshots; older reports remain in the database. Identical normalized reports with the same labels are kept once, including concurrent saves. Revisions and differently scoped reports remain separate. Overlapping snapshots are never summed together. Reports do not add financial ledger or traffic records. Existing normalized financial CSV imports remain available separately.

Ad impressions are not visitors or pageviews. CTR totals use total clicks divided by total impressions. Reported daily CPM is displayed without summing it. Revenue retains up to twelve decimal places; $0 exports do not establish a more precise underlying balance or payment. No revenue is inferred from rounded CPM. Missing dates remain unreported, not fabricated zero rows.

Domain and timezone are absent from this six-column format, so Studio cannot verify them from the file. Unsupported groupings, duplicate dates, malformed data and files larger than 1 MB are rejected. Preview and save do not contact Adsterra, load ads, request indexing or publish articles. Downloads of fresh provider reports are still manual.

History is protected by owner sessions; saving also requires the allowed Origin and CSRF token. Database backups include saved reports. Portable content archives exclude financial reports. The additive migration is `20261109180000_ad_report_history`; make a database backup before applying it.
