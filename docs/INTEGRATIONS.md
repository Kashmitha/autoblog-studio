# Integration contracts and research

Official documentation checked on 4 November 2026. Availability, limits, policies, models and prices must be checked again before live use. Initial implementation used mocks; subsequent owner-authorized external verification is recorded in TESTING.md and PROGRESS.md.

## Framework decisions

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation): App Router, Node minimum requirement; selected Next 16.4.5 from npm.
- [Nest migration guide](https://docs.nestjs.com/migration-guide): Nest 12 introduces ESM and TypeScript 6. Nest 11 remains this implementation baseline; multer is overridden to patched 2.5+ after the audit.
- [Prisma system requirements](https://docs.prisma.io/docs/orm/reference/system-requirements) and [Prisma v6 documentation](https://docs.prisma.io/docs/orm/v6): Prisma 6.19.3 was installed, generated, migrated and exercised with PostgreSQL 17 and host Node 26 LTS. Current Prisma 8 npm tag was a release candidate; it was not selected.
- [BullMQ idempotency](https://docs.bullmq.io/patterns/idempotent-jobs) and [Job Schedulers](https://docs.bullmq.io/guide/job-schedulers/): retries are at least once. This implementation persists exact article publication slots in PostgreSQL and reconciles them every 30 seconds rather than relying solely on Redis recurrence metadata.

## Google Blogger / OAuth

[Blogger API v3 guide](https://developers.google.com/blogger/docs/3.0/using), [post insert](https://developers.google.com/blogger/docs/3.0/reference/posts/insert), [publish](https://developers.google.com/blogger/docs/3.0/reference/posts/publish), [web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

Uses the official Google Node client, OAuth state tied to a DB session, PKCE, offline refresh tokens and encrypted credential storage. Connect, select an owned/authored blog, read posts, test, revoke/disconnect. The worker creates a draft, stores its ID, updates the draft and publishes. Retry gets the remote status first. Insertion intent is committed before the remote call: ambiguous insertion never automatically repeats.

Scope: `https://www.googleapis.com/auth/blogger`. Reporting adds `webmasters.readonly` and `analytics.readonly` only through the explicit reporting connection action. Google test-mode refresh-token expiry and OAuth verification requirements depend on account/project configuration; inspect current console guidance. A first real test needs separate owner authorization in the UI, plus BLOGGER_MODE=live, approved content and resumed automation.

## AI generation

Used the OpenAI Docs skill to check [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and the [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create). The AiProvider abstraction is replaceable. The initial implementation calls the fixed official Responses endpoint with store=false, schema-constrained output, model/output limits and a bounded researched prompt. No arbitrary provider URL is accepted.

Source excerpts come from URLs the editor supplies with claim-review notes. They are untrusted input and separated from instructions. Source-link reachability is not a credibility/factual certificate. Draft metadata includes outline, image terms and uncertainty notes. All generated article bodies remain NEEDS_REVIEW with internal AI provenance recorded. The optional public AI-assistance footer is off for new drafts; generation preserves the owner's saved choice. See [editorial preferences](EDITORIAL.md) for the natural-writing policy and Blogger metadata limits.

Paid generation requires AI_ENABLED=true, AI_BILLING_AUTHORIZED=true, a local API key and explicit current token rates. PostgreSQL serializes reservations to enforce monthly/daily ceilings. Unknown outcomes retain the conservative reserved cost until operator reconciliation. No paid request was made during the build. Check [current pricing](https://developers.openai.com/api/docs/pricing) and model availability before enabling; no price or future availability is assumed.

## Real images

[Wikimedia imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo), [Commons licensing](https://commons.wikimedia.org/wiki/Commons:Licensing), [Unsplash API rules](https://unsplash.com/documentation), [attribution guidance](https://help.unsplash.com/en/articles/2511315-guideline-attribution).

Commons search requests extended metadata and filters to CC0, public domain, CC BY 4.0 and CC BY-SA 4.0 bitmap candidates. Do not infer that every Commons image is commercially reusable. The editor must inspect the actual source, precise license, attribution/modification requirements and third-party rights. Unknown, noncommercial or incompatible licenses are rejected.

Unsplash uses API hotlink URLs, visible credit and source links with application referral parameters. A successful selection records the API download event before import. Requires a developer key. Search results are unapproved candidates, not rights-cleared assets. Original images/screenshots use the actual creator and permission evidence; do not invent a photographer. Publication needs public HTTPS delivery.

## Adsterra

[Official API overview](https://adsterra.com/api/) and [official publisher API guide](https://adsterra.com/blog/how-to-use-adsterra-publishers-api/) now document supported publisher reporting. This was verified rather than assuming no API exists. V1 here intentionally uses manual verified revenue entries / official CSV exports, with reference-based duplicate prevention. The API credential variable is reserved; automatic Adsterra API synchronization is not implemented or claimed tested.

No dashboard scraping, automated publisher login, traffic generation or automatic aggressive ad injection. The owner chooses policy-compliant placements manually in Blogger. Advertising approval is external; no revenue is guaranteed.

## Search Console and Analytics

[Search Analytics query](https://developers.google.com/webmaster-tools/v1/searchanalytics/query), [Analytics Data runReport](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport), [Search Console](https://search.google.com/search-console).

Authorized reporting pulls date/page search metrics or GA4 pageviews with pagination and bounded date windows, and upserts source-labeled records. Search Console is top-row data and can omit low-volume rows; Pacific reporting dates are preserved. GA dates follow property settings. Prefer Google source records over manual records when both exist rather than silently double-counting them. CSV imports must not mix aggregate site totals and URL-level records for the same source/date.

[Helpful content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), [generative AI guidance](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content), [Search Essentials](https://developers.google.com/search/docs/essentials). Use specific questions, descriptive headings, relevant internal links, accessible images and updates; avoid scaled low-value output. Sitemap verification checks retrieval/XML structure only. Submission and indexing are owner/external actions, not guaranteed outcomes.
