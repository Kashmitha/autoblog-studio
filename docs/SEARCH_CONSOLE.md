# Google indexing and traffic reporting

Published article editors also provide separate [Live fetch diagnostics](FETCH_DIAGNOSTICS.md): manual desktop/mobile redirect traces, metadata checks and saved JSON export. These never change Google's stored verdict or request indexing.

Publishing and indexing are separate. Blogger's SCHEDULED/LIVE status describes the post on the blog. Search Console reports whether Google has included a published URL in its index. A successful fetch or permission to index is not proof of completed indexing.

## Connect once

1. Open **Blog connections → Search Console connection** in Studio.
2. In the existing Google Cloud project used for Blogger, enable **Search Console API** if it is not already enabled. Keep the current OAuth client and redirect URI.
3. Choose **Connect Search Console read access** and complete Google's consent using the same account that owns the connected Blogger blog. This requests `webmasters.readonly` separately from Analytics and preserves the existing Blogger connection/checkpoints. Studio refuses to replace a selected blog's credentials with an account that does not own it.
4. Choose **Load verified properties**, select the blog's matching HTTPS URL-prefix property (or an appropriate domain property), then **Use this property**. Only properties available to the account with verified access are accepted. This does not create, verify or submit a new Search Console property or sitemap.

The selection is saved in ReportingSettings. Existing SEARCH_CONSOLE_SITE_URL configuration remains a fallback. Configured means the property/read grant are present; it does not certify API availability or indexing. API-disabled, authorization, quota and service failures are shown when a read fails. No passwords, client secrets or tokens are shown by these screens.

## Check indexing

Open **Overview → Publishing follow-up** for counts and articles needing attention, or **Traffic & SEO → Publishing and Google indexing** for the full list. Filter between waiting, attention, confirmed, awaiting publication and unchecked articles. Each published entry shows its exact title and public URL, separate publishing/indexing states, guidance and next automatic check time. A published article's **Google indexing** card has the same guidance plus history and canonical details. Scheduled articles stay marked **Not published** and cannot be inspected through Studio until Blogger confirms LIVE. The article's saved published URL is used; the endpoint accepts no arbitrary inspection URL.

- **Indexed:** Google's stored high-level verdict is PASS.
- **Not indexed:** Google reports FAIL or NEUTRAL; the exact coverage description, fetch state and any crawl time are shown.
- **Unknown:** Google returned no recognized indexing verdict. A successful fetch or INDEXING_ALLOWED alone does not become Indexed.
- **Unavailable:** a check failed before any usable result was received. If an earlier result exists, it remains visible with a warning.

**Last result received / Last check attempted** are Studio timestamps. **Google's last crawl** comes from Google's response and can be much older. Dates include the year and use Asia/Colombo. Missing crawl dates/canonicals are shown as not reported, not invented. The history retains the earlier observations and errors; the latest successful observation remains available even after many failures. Results from another property or a different published URL are not reused.

The API reads only Google's stored index report. It cannot run Test Live URL, request indexing or force inclusion. Open Search Console for the live test or manual investigation. A green live test does not change the stored indexing verdict in Studio.

Studio checks due reports automatically after its opening Blogger status sync, on returning to a visible tab, after reporting setup changes and every 30 minutes while visible. Each published article is eligible for another automatic read only after 24 hours; failed reads wait at least one hour. Closing Studio pauses these checks. On reopening, due checks resume; the computer does not need to stay on for Blogger-hosted publication or Google's own crawling. Up to three oldest due articles are checked per pass; a larger backlog continues in later passes. A provider/permission/quota failure stops that pass, retains saved results and displays an error. Checks never publish, edit or submit a URL to Google.

**Check reports due** runs one such bounded pass now. The individual Refresh/Check indexing buttons still allow an earlier manual read: successful observations are reused for five minutes and failures for one minute. The cadence decision is checked under the same database lock as inspection, so concurrent tabs cannot consume duplicate automatic reads. Studio caps all actual checks at 100 per property per UTC day; Google's own quotas still apply.

Manual **Request indexing** is optional in Search Console, not a required step for every article. Normal publication, the sitemap and internal links support discovery; inclusion and timing remain Google's decision. Repeated observations of the same crawl are labeled as the same recorded crawl, not new failures. A discovery-only report is shown as waiting; an unspecified permission/fetch field means **Not reported by Google**, not blocked. None of this proves that a previously reported redirect issue is permanently fixed.

## Traffic and earnings

The existing Search Console traffic import now uses the selected verified property and requires its separate read grant. Choose dates and **Search Console** under Traffic & SEO to import actual clicks/impressions. Missing metrics remain unavailable; explicit reported zeros are kept. Reporting dates remain Google Pacific Time, and Search Console can omit low-volume/top-row data. Pageviews still require separately configured GA4 read access or real CSV records.

Earnings continue to use actual Adsterra dashboard exports/manual records on Monetization. This update does not introduce automatic Adsterra synchronization, estimate income from indexing or fabricate traffic/revenue. No paid AI call or hosting purchase is required for the local feature.

## Developer notes

- Owner-protected GET `/api/seo/search-console`, `/search-console/properties`, `/indexing`, `/articles/:id/indexing` read configuration and saved results. POST `/api/seo/search-console/property` selects a verified property; POST `/api/seo/articles/:id/inspect` performs a read-only Google inspection; POST `/api/seo/indexing/refresh-due` runs the bounded automatic cadence. Mutation routes retain Origin and CSRF checks. New indexing refresh events only reload reporting resources, not editable article forms.
- IndexInspection rows store sanitized individual observations without modifying article content, approval, version, status, publishing jobs or Blogger. Error payloads do not expose raw provider messages. Canonical/report fields are displayed as text or allowlisted Search Console links.
- OAuth permission upgrades use incremental grants. An optimistic encrypted-token comparison prevents an old background refresh from overwriting a newer grant.
- Adapter and integration/browser tests use fake Google responses. Live results require the owner's Google read consent and enabled API; setup state is not proof of an actual inspection.

References: [inspect method](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect), [response fields and verdicts](https://developers.google.com/webmaster-tools/v1/urlInspection.index/UrlInspectionResult), [Google quotas](https://developers.google.com/webmaster-tools/limits).
