# Automatic Commons photographs

The article workflow now uses this sequence:

**Generate a source-backed draft → select an eligible library photograph → if necessary, discover and inspect Commons photographs → import a passing photo with provenance → attach photo and attribution → run quality checks → stop for review or hand the schedule to Blogger under the saved policy.**

## Activation

`COMMONS_AUTO_IMPORT=true` in private `.env` enables discovery after the eligible library has no related unused photo. The local installation has this flag enabled. Backend and worker must be recreated after changing it. The flag does not resume global automation, enable the editorial policy or create a public post. Those existing owner settings and destination checks still apply.

Automatic discovery requires no image-provider key. Groq is used only for article text and photographic search terms; no image-generation or vision-model service is used. Unsplash remains manual. Reviewed original photos continue to work.

## Metadata policy

A discovered candidate must have all of the following:

- A relevant developer-photography subject from the draft's image search terms. Queries are sanitized, limited to two, and each query considers at most 12 Commons files. Image availability checks are limited to three candidates per query.
- A JPEG bitmap hosted directly by Wikimedia Commons, sufficient dimensions, sensible aspect ratio and a file size no greater than 15 MB.
- A named creator and matching machine-readable CC0, CC BY 4.0 or CC BY-SA 4.0 license URL. Unknown licenses, NC/ND/fair-use/permission markers and explicit rights restrictions are excluded. Public-domain metadata not matching these supported licenses is left for manual review.
- Camera Make, Model and capture date metadata, plus a Commons file revision date. Both capture and revision must predate 2022. This intentionally excludes many legitimate newer photos as well as files with incomplete metadata.
- No known synthetic-image, rendering, diagram, screenshot, logo or inappropriate-content markers in the returned title, description, credit and categories.
- A successful JPEG availability check. Redirects are not followed for that check.

These are conservative automated checks, not proof against forged metadata, incorrect licenses, undisclosed third-party rights or an inaccurate subject description. Metadata establishes a candidate's eligibility under the configured policy; it does not certify every photo as non-AI. The library displays the review method. An owner can inspect the source and record a separate human review.

## Attachment and records

Imports store the Commons page ID, file hash, camera and date evidence, query, license, review timestamp and policy version. `humanReviewed=false` and `licenseCheckedBy=AUTOMATIC_COMMONS_METADATA_POLICY` distinguish these records from owner review. An audit entry is recorded. The image is identified as illustrative rather than a screenshot of the tutorial.

Source URL/file hash checks prevent duplicate records, and recent use within seven days is excluded. Existing unapproved or removed-from-pool records are not silently approved. Previously imported records can be reused after the exclusion window only while pool eligibility remains valid. Turning discovery off prevents new discovery/import; existing eligible library photos remain available.

The existing publication renderer includes attached images, alt text, photographer credit, source and license links. Discovery never uploads to Blogger directly. The text draft is preserved as `BLOCKED_MEDIA` if no candidate passes or Commons is unavailable. The photo stage can be retried without another model completion. No unrelated-image, generated-image or paid-provider fallback is used.

## Other providers

- **Pexels:** a possible next adapter. It has a programmatic photo API, requires a private key, credit and API-limit compliance, and prohibits generative-AI uploads. Not integrated in this checkpoint. [API documentation](https://www.pexels.com/api/documentation/), [content policy](https://www.pexels.com/legal-pages/acceptable-use-policy/).
- **Openverse:** a possible discovery adapter for openly licensed photographs. Its API supports photograph and commercial-license filters, but original-source rights and attribution still need verification. Not integrated. [API](https://api.openverse.org/v1/), [licensing limitations](https://openverse.org/about).
- **Unsplash:** available for manual search/import and article attachment. The current API guidance specifies non-automated use; it is not an unattended fallback. [Guidance](https://help.unsplash.com/en/articles/2511256-guideline-high-quality-authentic-experiences).

Commons references: [image metadata API](https://www.mediawiki.org/wiki/API:Imageinfo), [Exif metadata](https://commons.wikimedia.org/wiki/Commons:Exif), [reuse requirements](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia).
