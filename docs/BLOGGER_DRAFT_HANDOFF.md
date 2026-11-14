# Blogger draft handoff for final SEO review

The article editor now offers **Send to Blogger as draft** for an approved article on a live, verified Blogger connection. It uploads the existing text, labels and reviewed attachments as one draft. It needs no AI API key and does not generate text, publish, schedule, change ads or reserve a publishing slot.

## Use it

1. Review the prepared article, citations, examples and any photos in Studio. Save the current version and complete **Review & approve**. Resolve quality errors first.
2. Choose **Send to Blogger as draft**. Check the destination, title and version shown in the dialog. Type `CREATE BLOGGER DRAFT`, then choose **Create draft on Blogger**.
3. Wait for Blogger to confirm DRAFT. Studio records the returned post ID and locks its local body against further editing. The local approval is cleared: final review now happens in Blogger. Paused Studio automation does not prevent this owner-triggered private handoff; emergency stop does.
4. Choose **Manage on Blogger**. Review the uploaded title, content, labels and image credits. Open the post's **Search description**, review/copy the suggested summary and set the actual field there. If you want a custom permalink, configure it before the first publication. Do not change an existing published URL without redirect planning.
5. Save the draft in Blogger. Publish or schedule it there only after completing final review. Return to Studio and choose **Sync Blogger status**. Status sync reads the existing post; it does not overwrite Blogger's content or metadata.

Google's [post insertion API](https://developers.google.com/blogger/docs/3.0/reference/posts/insert) supports `isDraft=true`. Its [post resource](https://developers.google.com/blogger/docs/3.0/reference/posts) does not expose the Blogger editor's search-description/custom-permalink settings used here. The workspace excerpt is a suggestion to review, not a field silently synced to Google or a promised search snippet.

## Duplicate and interruption protection

The backend requires explicit confirmation, the current approved version, a passed fresh quality report, the verified destination, no existing/uncertain remote upload and no active publication job. It checks remote title matches before insertion and records the handoff intent durably before calling Google. Draft insertion has automatic HTTP retries disabled. Concurrent requests serialize with existing publication actions.

Once Google returns an ID, Studio saves it before confirming DRAFT. If a follow-up read fails, use **Sync Blogger status**; a second draft is not inserted. If insertion's response is lost before an ID is known, the article remains protected. Choose **Recover existing Blogger draft or post**, inspect the exact-title candidate on the original selected blog, type `LINK EXISTING BLOGGER POST` and link it. Do not create another copy manually while the outcome is uncertain. A mismatched or changed blog is blocked.

Intentional handoff drafts appear as NEEDS_REVIEW with a confirmed remote DRAFT status, not as a failed publication. Existing drafts left by an interrupted publishing operation retain their earlier failure/recovery behavior. There is no local publish job for this handoff. Owner-managed publication dates in Blogger are observed by sync; Studio's scheduling limits do not reserve or enforce slots manually chosen in Blogger. An accepted Blogger schedule can run with the PC off, and pausing Studio does not cancel it.

Deleting or abandoning a handed-off draft does not unlock or re-upload its Studio copy automatically. Inspect the remote copy and the reported error before taking further action. No return-to-Studio editing or automatic remote-content import is implemented by this workflow.

## Installation and verification

The additive migration `20261114090000_blogger_draft_handoff` records handoff intent separately from uncertain publication drafts. Back up the working database before deploying it. Installation leaves existing fields/settings and public posts unchanged.

Integration/provider tests use isolated mocks to verify no publish/schedule calls, concurrent requests, stale approval/version, missing CSRF, emergency stop, duplicate titles, lost insertion response and failed confirmation reads. No real Blogger handoff or publication was performed as an installation test; the existing prepared articles remain unapproved until the owner reviews them.
