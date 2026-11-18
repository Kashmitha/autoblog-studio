# Single-use photo batches

Import and review real photographs through Media library, then add their subject keywords and confirm real-photo rights in Automation > Real-photo pool. Commons and original photographs are supported for unattended selection; Unsplash remains manual.

Unused shows reviewed eligible photographs without any article attachment or automatic consumption marker. Used includes drafts, scheduled and published articles. Needs review shows unused photographs that need pool review or rights updates. Selection requires keyword relevance; it never forces an unrelated photograph.

Automatic attachment atomically records consumption with the article claim. An automatic photo stays consumed after detachment. Existing attached photos are excluded regardless of age. Re-reviewing a photo does not reset consumption. Twenty suitable unused photos can cover up to ten days at two posts daily; relevance and all editorial/provider/publishing checks still apply. Refill before exhaustion. Empty or unmatched pools stop image preparation unless enabled Commons discovery supplies a suitable photo. A blocked run can resume its saved photo stage after refill; text is not regenerated. There is no guarantee of two successful publications daily.

## Automatic photo recovery

With standing automatic publishing enabled, the worker retries PHOTO/BLOCKED_MEDIA runs up to three times, at least two minutes after the preceding failed attempt. Only unchanged local NEEDS_REVIEW drafts under the same policy revision and selected blog qualify. More than ten minutes must remain before the slot. Pause and emergency stop are honored. Audit records retain the attempt budget across worker restarts. Existing blocked runs qualify if these conditions hold. Refill the pool before the next attempt to let it continue automatically.

This does not regenerate paid text, bypass quality or factual-review gates, backfill expired slots, or replay Blogger requests with uncertain outcomes. After the retry budget or scheduling window is exhausted, the saved run remains blocked for owner inspection.

## One daily post with image-led planning

Choose One post per day, enable topic refill and standing publishing policy, then save one Sri Lanka time. This mode selects an unused reviewed library photo before an AI call, chooses a related scope from the official reference packs, includes the photo subject in the writing brief, and pins the selected photo through attachment and scheduling. Empty or unsupported subjects stop before text generation. Arbitrary image subjects outside the supported source packs do not produce invented research.

During supported photo import, check real-photo automatic selection and enter subject keywords. This records the pool review as part of adding the image. Unsplash API imports remain manual under the provider guidelines; do not relabel them as original images. Local original uploads still need public HTTPS image delivery before publishing. Used/reserved filters apply to drafts and published posts; images are not recycled automatically.

Deployment needs an always-on backend and worker, persistent PostgreSQL/Redis and uploads, HTTPS, private environment secrets, and updated OAuth callback origins. A domain and Cloudflare account alone do not run the worker. The worker can publish a daily post when all checks succeed; it does not guarantee an uninterrupted one-post-per-day outcome in the presence of provider failures or unresolved facts.
