# Single-use photo batches

Import and review real photographs through Media library, then add their subject keywords and confirm real-photo rights in Automation > Real-photo pool. Commons and original photographs are supported for unattended selection; Unsplash discovery/import remains manual; explicit curated-library enrollment supports downstream selection.

Unused shows reviewed eligible photographs without any article attachment or automatic consumption marker. Used includes drafts, scheduled and published articles. Needs review shows unused photographs that need pool review or rights updates. Selection requires keyword relevance; it never forces an unrelated photograph.

Automatic attachment atomically records consumption with the article claim. An automatic photo stays consumed after detachment. Existing attached photos are excluded regardless of age. Re-reviewing a photo does not reset consumption. Twenty suitable unused photos can cover up to ten days at two posts daily; relevance and all editorial/provider/publishing checks still apply. Refill before exhaustion. Empty or unmatched pools stop image preparation unless enabled Commons discovery supplies a suitable photo. A blocked run can resume its saved photo stage after refill; text is not regenerated. There is no guarantee of two successful publications daily.

## Automatic photo recovery

With standing automatic publishing enabled, the worker retries PHOTO/BLOCKED_MEDIA runs up to three times, at least two minutes after the preceding failed attempt. Only unchanged local NEEDS_REVIEW drafts under the same policy revision and selected blog qualify. More than ten minutes must remain before the slot. Pause and emergency stop are honored. Audit records retain the attempt budget across worker restarts. Existing blocked runs qualify if these conditions hold. Refill the pool before the next attempt to let it continue automatically.

This does not regenerate paid text, bypass quality or factual-review gates, backfill expired slots, or replay Blogger requests with uncertain outcomes. After the retry budget or scheduling window is exhausted, the saved run remains blocked for owner inspection.

## One daily post with image-led planning

Choose One post per day, enable topic refill and standing publishing policy, then save one Sri Lanka time. This mode selects an unused reviewed library photo before an AI call, chooses a related scope from the official reference packs, includes the photo subject in the writing brief, and pins the selected photo through attachment and scheduling. Empty or unsupported subjects stop before text generation. Arbitrary image subjects outside the supported source packs do not produce invented research.

During supported photo import, check real-photo automatic selection and enter subject keywords. This records the pool review as part of adding the image. Unsplash API search and import remain manual; explicit owner-curated enrollment is required for downstream selection. Do not relabel provider assets as original images. Local original uploads still need public HTTPS image delivery before publishing. Used/reserved filters apply to drafts and published posts; images are not recycled automatically.

Deployment needs an always-on backend and worker, persistent PostgreSQL/Redis and uploads, HTTPS, private environment secrets, and updated OAuth callback origins. A domain and Cloudflare account alone do not run the worker. The worker can publish a daily post when all checks succeed; it does not guarantee an uninterrupted one-post-per-day outcome in the presence of provider failures or unresolved facts.

## Owner-curated imported Unsplash library

The owner can explicitly enroll manually imported, rights-confirmed Unsplash assets for downstream single-use article selection via Automation > Use my manually imported Unsplash library. This does not run Unsplash search/import on a timer. Original provider IDs, images.unsplash.com hotlinks, attribution and download-event tracking at manual import are preserved. Search/import stays a human action; downstream publication is a distinct curated-library mode. This implementation does not certify provider approval of a particular use or non-AI origin.

Enrollment extracts descriptive subject tags from saved title and alt text. Identified renders/logos are labelled illustrations in their attribution. Origin is not inferred from the existence of a photographer profile. Used images cannot be re-enabled by enrollment. Future imports can opt in during import. One-post mode supports AI/Claude, MySQL, SQL Server and Azure reference scopes as well as the earlier developer scopes; unsupported or ambiguous subjects are not grounds to invent factual sources.

## Draft length and prepared-draft recovery

Automatic drafts use one shared 450-word minimum in their saved quality report and publishing gate. Generation asks for 550-800 useful words. One successful but short generation may receive a single source-backed expansion request under the same provider daily/spending limits; provider errors and ambiguous writes are not blindly replayed. If the second response remains incomplete, checks stop it with an explicit reason. Genuine unresolved claims still stop publication.

An owner-authorized corrected local draft with one attached image may resume through POST /api/editorial/runs/:id/resume-prepared with its current article version. Quality and uncertainty checks must pass under the unchanged policy and blog. The existing image is kept, text is not regenerated, and an expired slot moves to the next configured future slot rather than backdating. Approval remains AUTOMATIC_POLICY, never a claim of human editorial review.
