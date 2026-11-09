# Content backlog and internal links

Installed 9 November 2026. These tools work without paid AI or waiting for indexing confirmation.

## Plan the next article

Open **Topic planner**. Add a specific working title, topic area and reader intent using the existing Create planned article form. The new **Content backlog** includes local articles in PLANNED, RESEARCHING, DRAFTING, NEEDS_REVIEW and APPROVED stages. Published, scheduled, rejected, failed and Blogger-managed articles are excluded.

The backlog sorts High, Medium, Low, then Not set priorities, with oldest ideas first within each priority. Search titles, topic areas, reader intent and private notes, or filter by stage and priority. Each row shows whether a body exists, source checks with support notes, and whether the latest saved quality report passed for the current article version. These indicators do not replace editorial review or establish source freshness.

Expand **Priority and private notes** to record tests, examples and research work. Save plan persists these separately from editorial content. Notes never enter Blogger publication HTML, and changing them does not reset approval or increment the editorial version. A separate planning version rejects stale concurrent updates. Refresh backlog before retrying a conflicting save. Planning changes are rejected once an article leaves the editable backlog.

## Add a relevant internal link

Open an article and find **Related published posts**, then choose **Find related posts**. Suggestions use the saved title, reader intent and labels. Save those fields first if changed. Matching is a local shared-term heuristic, with a same-topic tie-breaker; it is not a semantic relevance guarantee, search-volume estimate or ranking promise.

Only confirmed PUBLISHED Studio articles on the selected blog's exact HTTPS origin are considered. Unrelated posts without shared terms, self-links, other blogs and already linked URLs are excluded. Blogspot m=0/m=1 variants and URL fragments are normalized for duplicate detection; other query parameters are retained. At most five suggestions appear, showing the shared terms. The tool does not contact Google, crawl the blog or load unrelated ads. It cannot discover older Blogger posts that have not been imported into Studio.

Choose **Add link to draft** to append a related-reading paragraph to the unsaved body. Titles and URLs are escaped. The button disables once that URL exists in the current unsaved HTML. Review relevance, move the paragraph to an appropriate place, edit its anchor text if needed, then **Save draft** and run quality checks. Saving changed HTML resets approval through the existing workflow. A save/version change clears suggestions so they can be requested against the saved version.

Published, scheduled and other locked articles can display suggestions for planning a revision, but insertion is disabled. This feature does not edit published posts, schedule anything or bypass approval.

## Current owner state

Blogger read-back on 9 November confirmed the 7 November tracked-file tutorial and 8 November branch-comparison tutorial are LIVE. All four Studio tutorials are now published. The actual backlog is therefore empty until the owner creates another planned article. The unstaging article has three related published-post suggestions; its body remains unchanged.

## Implementation and checks

- Ninth additive migration: `20261109090000_content_backlog`, adding backlogPriority (database constraint 0–3), planningNotes and planningVersion to Article. A working database backup preceded application; no existing editorial fields were migrated.
- Owner-protected GET `/api/articles/backlog`, PATCH `/api/articles/:id/planning`, GET `/api/articles/:id/internal-links`. Mutation routes retain Origin/CSRF protection and DTO limits. Planning updates include an audit event without the private notes in its message.
- Unit tests cover safe URL identity, mobile variants, parsed anchors, self/duplicate/existing-link exclusion, matching and result limits. Integration tests verify authentication, validation, stage eligibility, optimistic updates and preserved approval/content. Browser checks cover persistence, filtering, escaped unsaved insertion, duplicate prevention and normal draft save.
- 109 unit and 83 isolated integration tests passed. All 22 browser cases passed across the initial run and corrected-locator rerun. Type checks and production builds passed. Actual owner UI checks verify desktop/mobile empty backlog, three real suggestions and disabled insertion for published content. Private before/after evidence confirms unchanged real articles and publishing controls.
