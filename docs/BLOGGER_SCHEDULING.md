# Publishing while your computer is off

Studio offers two different scheduling options. **On Blogger** sends the approved article and future publication time to Google's servers now. Once Google confirms SCHEDULED, the computer and Docker can be switched off. **On this computer** uses the existing local queue, so this computer, Docker and the internet connection must be available at publication time.

## Schedule an approved article on Blogger

1. Connect the intended blog and complete the first live publishing checkpoint. Blogger scheduling is available only in live mode after that checkpoint.
2. Finish editorial review and save approval. Save all edits before opening Publish / schedule.
3. Choose **On Blogger · computer can be off**, enter a time at least five minutes in the future in Asia/Colombo, then choose **Schedule on Blogger**. The calendar offers the same option.
4. Wait for the **Managed by Blogger** confirmation with the accepted time. A local request alone is not confirmation.
5. Open Studio later to refresh linked statuses, or use **Sync Blogger status** on the article or calendar. PUBLISHED is recorded only after Google reports LIVE, using its publication timestamp and URL.

Local automation can remain paused for this workflow. The existing emergency stop blocks new cloud handoffs, but neither pause nor emergency stop can recall a schedule already accepted by Google. Use **Manage on Blogger** to change or cancel it there, then sync. If Google reports DRAFT, Studio shows that the schedule needs attention and keeps the linked article protected from local edits/republication. This version does not edit or cancel Google's schedules directly.

## Link a post scheduled manually

On the approved Studio article, choose **Link a post already scheduled on Blogger**. Select the matching title, review its status/date/ID, type the displayed confirmation phrase, and link it. Only a post on the selected blog with a matching title and SCHEDULED or LIVE status can be linked. This is a local metadata operation; it does not change Blogger's body, labels or date. The remote copy is authoritative for publishing; Studio retains the reviewed local body separately.

Linking marks the article as Blogger-managed and excludes it from local recurring scheduling, worker execution, local cancellation, edits, material changes and retries. A remote post ID can link to only one local article. The two owner-created schedules were linked using this operation after implementation; private identifiers and live verification evidence remain under ignored `.local/` files.

## Interrupted requests

Studio saves upload intent before creating a draft. If upload or scheduling times out, it does not automatically create or publish another post. A known remote ID can be checked with Sync. If no ID was received, inspect Blogger and link the matching scheduled/published post; if it is still a draft, finish scheduling it in Blogger first. Do not create another copy to resolve an uncertain response.

If a sync fails or the selected account/blog changes, the last confirmed state remains visible with a warning and its last-confirmed time. Reconnect the original blog and sync again. Sync never publishes a post or overwrites the article body.

## Implementation and limits

- `POST /api/blogger/articles/:id/schedule` uploads approved content (including labels, reviewed image markup and the optional footer), then calls Blogger posts.publish with `publishDate`. Both remote writes disable automatic HTTP retries; an ADMIN read must confirm the accepted status and date.
- `POST /api/blogger/articles/:id/link` verifies and links an existing remote post; `POST /api/blogger/articles/:id/sync` and `POST /api/blogger/sync` read linked statuses. All endpoints require the owner session, allowed Origin and CSRF token.
- Cloud jobs use target `blogger` and never enter the local publishing queue. Durable intent, the shared publication lock, optimistic article guards and unique remote IDs prevent a local retry from blindly inserting another copy.
- New handoffs honor current quality/approval, selected-blog authorization, emergency stop and scheduled-day reservations against the configured daily limit. Linking a manually created schedule records the owner's existing remote decision without changing its time or enforcing a new local quota on it.
- Exact-title duplicate detection reads paginated Blogger metadata, with a bounded fail-closed scan. It does not promise semantic duplicate detection or protection against a user simultaneously creating a separate copy directly in Blogger.
- This does not host Studio or generate new articles while the computer is off. Status updates occur when Studio is opened or explicitly synced. No hosting purchase or paid AI request is required.
- Google's scheduling parameter: https://developers.google.com/blogger/docs/3.0/reference/posts/publish
