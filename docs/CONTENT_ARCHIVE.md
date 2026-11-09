# Portable content archive

Open **Settings → Portable content archive → Download content archive**. This downloads a JSON file named `autoblog-content-YYYY-MM-DD.json`. The date in the filename and the manifest's exportedAt timestamp use UTC. Settings shows the time of the download request in Asia/Colombo; confirm the completed file in your browser's downloads.

The archive contains all saved Studio articles, including unfinished ideas and published work: HTML, title, reader intent, excerpt, labels, private planning notes/priorities, internal AI provenance and public-footer preference, source URLs/support notes/check dates, publication references and timestamps. Media entries preserve reference URLs, alt text, creator, license, attribution and rights-review flags, including unattached library assets. Article media IDs refer to entries in the archive's media array.

The manifest identifies `format: autoblog-studio-content` and `schemaVersion: 1`, with export time, counts and explicit coverage. URLs and content are saved references, not freshly checked external results. Export makes no Blogger, Google, AI or ad-network calls, does not edit article content, and creates no publication jobs.

## What this does not back up

This is a portable content copy, not a database restore file. It excludes users, sessions, password hashes, OAuth tokens, provider keys, integration settings, original uploaded image bytes, media storage metadata, approvals, publishing jobs, automation settings, quality/audit history, indexing/diagnostic history, traffic and financial records. Free-text article and research notes are deliberately included and may themselves contain private information the editor wrote.

Manual import with a preview is available as described below. It creates review drafts rather than restoring an approved or live publishing workflow. A publication status in the archive is descriptive, not authority to republish. Media reference URLs do not contain original image bytes; private preview URLs may require the original installation and session.

For complete recovery use the [database backup procedure](DEPLOYMENT.md), plus separate copies of uploaded originals and the original environment/encryption key. Store archives in your personal backup location. GitHub contains application code, not these downloads or the live database. `autoblog-content*.json` is excluded by both Git and Docker context rules when saved inside the project.

## Import into another installation

1. In **Settings → Import content archive**, select the saved JSON file (at most 20 MiB).
2. Choose **Preview archive import**. Inspect the new-draft/media counts and individual article decisions. Preview changes no records.
3. Choose **Import as review drafts** when there is new content to copy. Existing original article/media IDs and previously imported copies are skipped. If everything exists, the button is disabled. An archive imported into its original workspace therefore normally creates nothing.
4. Open **Content backlog**. Re-check sources, facts and examples, re-add originals or reviewed licensed images, inspect the preview and follow normal quality/approval steps.

New articles enter NEEDS_REVIEW with version 1, no approval, publication ID, published URL, remote ownership or job. Reader intent, labels, planning notes/priorities, AI provenance and footer preference are preserved. Source support notes remain, but HTTP check results/dates reset. Unsafe markup and all inline images are removed before saving; changed HTML is identified in preview. Links and saved text remain subject to editorial review.

Media credits are copied as ARCHIVE references with rightsConfirmed false and no usable delivery URL. The Media library displays these without requesting the archived URL and explains how to re-add the image and replace the reference. Re-importing an original does not automatically replace the article's archived attachment; the editor must detach that reference and attach the reviewed asset. Private storage metadata and original bytes are never accepted from the archive.

Imports use an atomic transaction and a serialized import lock. Concurrent attempts cannot create duplicate copies of the same archive content. The preview fingerprint must match the submitted file; reselecting a file clears the preview. Existing original IDs are skipped even if their current contents differ: import never rolls an existing article back. The same previously imported copy is recognized by a stable content/source identity even after its editorial state changes; imports are not a merge or revision tool. Editing archive content can produce a separate new draft, so preview the decisions.

There are no Blogger, Google, paid AI or media-download calls in preview/import. Imported content does not reconnect an existing Blogger post. Accounts, credentials, finances, automation, approval and historical publishing state still require a full database restore or separate setup.

## Implementation and limits

- Owner-protected GET `/api/content/archive` gives saved counts/coverage; GET `/api/content/archive/export` returns an attachment. No public download URL or unauthenticated export exists.
- Owner-protected multipart POST `/api/content/archive/preview` accepts one file; POST `/api/content/archive/import` accepts the file plus its fingerprint. Both retain exact Origin/CSRF guards. Format/version, count consistency, field lengths/types, unique IDs, source URLs and media references are validated before any write. Unknown credential, approval and provider fields are not restored.
- A repeatable-read database snapshot includes articles, sources and media consistently. Explicit select lists exclude credential-bearing relations, generation/provider metadata and private media storage metadata. No environment values are read by the export service.
- Maximum 500 articles, 2,000 media entries and 20 MiB of serialized UTF-8 JSON. Over-limit workspaces fail explicitly; no truncated archive is sent. The summary gives count eligibility, while the final export enforces actual byte size. Use a full database backup for larger workspaces.
- Responses use Cache-Control no-store; the attachment uses application/json, nosniff and a fixed date-based filename. The browser verifies success and content type before creating its local download. Errors retain the summary and allow retry.
- The last download request shown in Settings is a client-side observation for that visit, not proof of completed disk storage or a retained server backup. No backup-status timestamp is fabricated after a failed request.

No schema migration or new dependency was required. Tests cover owner protection, empty archives, preserved content/source notes/credits, secret and metadata exclusions, unchanged existing approval/content/jobs, count/byte limits, native browser JSON downloads, retry feedback, responsive layout, malformed imports, HTML sanitization, repeat/concurrent imports and fresh review state. Actual owner export verification compares all four real article bodies, labels, planning values and source notes and scans for known runtime credential values without logging them. Actual import verification uses the same saved archive, confirms all four articles and one media reference are skipped, creates no duplicates and preserves published content.
