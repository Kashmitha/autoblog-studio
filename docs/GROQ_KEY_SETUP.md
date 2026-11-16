# Groq setup and automatic publishing

Groq is implemented as a separate backend text provider. The existing OpenAI integration remains available via `AI_PROVIDER=openai`. Keys never go to the browser or the other provider. No fallback provider is called when Groq fails.

## Connect Groq privately

1. Open [Groq API Keys](https://console.groq.com/keys), sign in and create a key named `AutoBlog Studio`.
2. Verify your own account is on the **Free** plan. Studio cannot read or enforce your Groq billing plan. If you upgrade the Groq account, API usage may be charged even when Studio is configured as free.
3. In the root private `.env`, use the settings below. Replace the key placeholder privately; never paste the key into chat, GitHub or screenshots.

```dotenv
AI_PROVIDER=groq
GROQ_API_KEY=your_private_key_here
GROQ_PLAN=free
GROQ_FREE_TIER_CONFIRMED=true
GROQ_MODEL=openai/gpt-oss-20b
AI_ENABLED=true
AI_BILLING_AUTHORIZED=false
AI_MAX_OUTPUT_TOKENS=4000
AI_DAILY_GENERATION_LIMIT=2
AI_MONTHLY_LIMIT_USD=3
```

The local provider/model settings have been prepared, but the key is blank and free-plan confirmation is false until the owner completes them. Existing paid billing authorization is not enabled. Token prices are not needed in declared Free mode: Studio records zero estimated cost and real token counts, with the request limit still enforced. This is not an invoice or independent billing verification. Failed/uncertain attempts also count toward the daily cap.

4. Recreate the backend and worker to load `.env`:

```powershell
docker compose --profile app up -d --no-deps --force-recreate backend worker
```

5. Refresh **Blog connections**. Confirm Groq and the selected model appear, then click **Test text provider**. This reads accessible models; it does not generate content or verify remaining completion quota. Click Blogger **Test connection** as well.

Groq model availability and quotas can change. Both `openai/gpt-oss-20b` and `openai/gpt-oss-120b` are supported with strict JSON output. No repeated retries, paid fallback or account/key rotation is used. A quota failure stops the attempt with an actionable error. The 4000-token output ceiling includes reasoning; actual request/context limits still apply. An incomplete draft stops for review.

## Prepare two automatic posts

The existing **Automation → Article and photo workflow** is the main workflow; another scheduler is not required.

1. Ensure there are at least two useful empty briefs with two source URLs and support notes each. Existing briefs are shown in the workflow.
2. Automatic Commons discovery is now available with `COMMONS_AUTO_IMPORT=true`. The workflow prefers eligible library photos, then searches and imports a candidate passing its metadata policy when a match is missing. A prefilled pool is optional when discovery is enabled; if no candidate passes, the saved draft waits for photo review. See [automatic photo policy](AUTOMATIC_PHOTOS.md). Unsplash selection remains manual. Photos used within seven days are skipped.
3. Resume local automation, keeping emergency stop off and the daily publication limit at least two.
4. In the article/photo workflow, enable **article preparation** and **Publish under standing owner policy after automated gates pass**. Choose the two Sri Lanka times, type the displayed publishing authorization and save. This permits real future posts after quality, source, originality, photo, quota and destination checks pass.
5. Use **Prepare next future slot** for each desired future slot. The worker prepares the article and photo, then asks Blogger to schedule it. Check the run result and the actual scheduled date. Wait until the first run completes and at least a minute has passed before preparing the second slot to reduce per-minute quota failures. The button selects the next eligible slot; verify it is the intended date rather than assuming it means tomorrow.
6. Confirm both posts are **scheduled on Blogger**, with the correct blog and dates. Once Blogger confirms a schedule, the local computer can be off. Before handoff, the worker and Docker must keep running; they cannot prepare articles while the PC is off.

For the requested next day, the target is **16 November 2026**, normally 09:00 and 17:00 Asia/Colombo under the saved times. If preparing ahead, explicitly verify those dates on each Blogger schedule. Publishing/indexing and revenue are separate; automatic publication does not guarantee Google indexing, traffic or income.

Review-only mode uses `ENABLE EDITORIAL DRAFTS` for Groq Free. Automatic publishing uses `AUTHORIZE AUTOMATIC EDITORIAL PUBLISHING`. Model uncertainty, insufficient source support or an unrelated/unavailable photo stops the run for review. Resume a blocked photo stage after adding an eligible image rather than regenerating the text.

## Paid providers

For paid Groq, set `GROQ_PLAN=paid`, configure current input/output token prices and explicitly authorize billing. For OpenAI use `AI_PROVIDER=openai`, `AI_API_KEY`, `AI_MODEL`, current prices and billing authorization. Monthly reservation and daily limits apply. No secrets are accepted through the UI.

Official references: [models](https://console.groq.com/docs/models), [structured output](https://console.groq.com/docs/structured-outputs), [rate limits](https://console.groq.com/docs/rate-limits), [billing](https://console.groq.com/docs/billing-faqs).
