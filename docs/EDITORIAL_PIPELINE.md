# Automated editorial pipeline

Installed on 13 November 2026, disabled by default. Open **Automation → Editorial pipeline**. This workflow prepares source-backed text, selects a related real photo from an owner-reviewed pool, checks quality and optionally schedules directly on the pinned Blogger blog under a standing owner policy. It never generates images.

Natural wording and varied titles are goals, not guarantees of human authorship or AI-detector results. Automated checks cannot certify factual accuracy, licensing, indexing, traffic or earnings. Internal AI provenance is retained; the optional public AI footer is off for pipeline drafts. Automatic approval is explicitly distinguished from individual human review in the editor and audit history.

## Current owner checkpoint

The working installation has eight empty Git reference briefs. Existing published articles and publishing checkpoints are preserved. Paid generation is disabled, automation is paused, the reviewed automatic photo pool is empty, and no editorial run has been started. The configured monthly limit remains $3. No paid-model or live-publication end-to-end test was performed for this feature.

## Activate in order

1. Review the starter briefs in Articles. Their official documentation links are reference starting points; the supplied scope notes do not claim completed fact-checking or command execution. You can supply your own empty briefs with at least two primary sources and support notes. Optional **Refill an empty brief queue** rotates curated Git documentation packs and asks the same draft call for a fresh supported question. Refill currently covers Git only; it makes no keyword-demand claim and needs no separate planning model call.
2. In Media library, import real photographs from Wikimedia Commons or upload your original photos. Check the actual photograph, license, author/source attribution, relevance and public HTTPS delivery URL. In Automation, select each photo, add accurate subject keywords, confirm its real-photo rights and allow it into the automatic pool. The application cannot establish that a file is a real photograph from appearance or metadata alone; this owner review is required. Reviews expire after 90 days. Photos used by another recent pipeline article, published article or scheduled article are excluded for seven days. Provide a varied pool, roughly fourteen relevant photos for a week's two-per-day target.
3. Privately configure `AI_API_KEY`, current input/output token prices, `AI_ENABLED=true` and `AI_BILLING_AUTHORIZED=true` only after accepting API charges. A ChatGPT subscription does not supply API credits. Keep `AI_MONTHLY_LIMIT_USD=3` or another explicitly authorized limit; both the spending reservation and daily-generation cap still apply. Never paste keys into chat or commit `.env`. Recreate backend and worker after environment changes.
4. Keep the worker running on your own always-on machine or a configured host. Resume global automation when ready for paid preparation. Check the heartbeat and all readiness blockers. Configure two different Sri Lanka times, such as 09:00 and 17:00; these are defaults, not proven best traffic times.
5. Begin with paid preparation and individual review if desired. For unattended publication, select **Publish under standing owner policy**, verify the displayed blog, and type the exact authorization shown before saving. This authorizes that version of the policy, not a claim that a human reviewed each future draft. The selected blog must have completed the existing live publishing checkpoint. Changing the blog or policy blocks incompatible pending runs.
6. **Prepare next future slot** queues one future attempt without making a model call in the request. The worker processes it. Inspect the run record, saved article, photo and remote Blogger schedule before relying on unattended operation. A confirmed Blogger-hosted schedule runs with your PC off; generation and handoff still require the worker to be running beforehand.

## What happens automatically

The worker looks for today's slots 5–30 minutes ahead and skips missed slots. A manual queue can prepare a later slot today or tomorrow. There are at most two attempted runs created per Sri Lanka day, not a promise of two successful posts. It does not burst through missed days.

Each run claims an empty brief and uses the existing metered text provider. Titles are checked against other Studio titles for duplicate or highly similar wording. Model uncertainty, source failures, insufficient text, quality warnings, duplicate topics or missing photos stop automatic publication. Command correctness still needs appropriate editorial verification; a reachable source is not proof that every generated claim is correct.

The model cannot insert arbitrary images. A relevant eligible pool photo is attached with attribution through the existing media system. If no photo matches, Commons candidates are discovered and the paid draft is retained as **BLOCKED_MEDIA**. Review/import a candidate and then **Resume photo step**; this does not regenerate the paid text. There is no unrelated-image or generated-image fallback.

Unsplash remains a manual picker because its current [API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines) require non-automated use. Commons is an alternative, but each file has its own [reuse conditions](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia). Free access is not a blanket license.

Passing runs in automatic mode receive a versioned standing-policy approval and use the existing durable Blogger scheduling flow, pinned to the selected blog. Existing daily publishing limits, emergency stop, checkpoint, remote intent/recovery and spending protections remain in force. Manual review mode stops at a prepared article.

## Interruptions and operating limits

Pause or emergency stop prevents further automatic work; already accepted Blogger schedules remain hosted there. Expired policy, edited article versions and revoked photo approval block continuation. A process interrupted for over 30 minutes is marked interrupted instead of replaying a possibly charged request. Uncertain remote writes require inspection/recovery and are not blindly retried. Budget exhaustion and failed runs do not automatically regenerate content.

Keep backups before migrations. This feature adds `20261113100000_editorial_pipeline` and `20261113103000_editorial_topic_refill`. Existing reporting/indexing sync is independent and does not gate publishing. No manual Google indexing request is needed for every post as part of this pipeline.
