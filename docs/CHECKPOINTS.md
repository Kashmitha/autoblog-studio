# Owner action checkpoints

All independent local development and verification should be completed before asking for these account-specific actions. Never paste keys, passwords, client secrets or refresh tokens in chat. Store secrets only in the ignored root `.env`. No live publication is authorized by the master build request alone.

## B + C — Google project and Blogger OAuth (required to test live Blogger)

Why: the account owner must create/choose a Google Cloud project, grant OAuth consent and select the actual blog. The developer cannot grant these account permissions for you.

1. Open [Google Cloud Console](https://console.cloud.google.com/), create/select a personal project.
2. Open [Blogger API v3](https://console.cloud.google.com/apis/library/blogger.googleapis.com) and enable it.
3. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview). Configure app branding/contact information, choose an appropriate audience, and add your Google account as a test user if the app is in testing.
4. Create an OAuth client of type **Web application**. Register the exact authorized redirect URI:
   `http://localhost:3100/api/integrations/google/callback`
5. Put the client ID in GOOGLE_CLIENT_ID and client secret in GOOGLE_CLIENT_SECRET in root `.env`. Keep GOOGLE_REDIRECT_URI equal to the URI above. Leave BLOGGER_MODE=mock and automation paused for this connection step.
6. Restart the NestJS backend and worker. Open [Blog connections](http://localhost:3100/connections), sign in with the local owner password, and click **Connect Blogger**. Complete Google's consent in your own browser.
7. Click **Test connection**, then **Load owned blogs**, select the actual blog, and click **Select blog**. Inspect the blog URL carefully.

Success: the connection test reports success and the selected owned/authored blog URL appears. No real publication should occur. No payment is required for this app's local setup or connection step; if any external console requires paid activation, stop and review before accepting it. See [official OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server) and [Blogger API guide](https://developers.google.com/blogger/docs/3.0/using).

Complete these steps and reply DONE.

## Recover expired Google access

If scheduling or Test connection reports expired/revoked Google access (`invalid_grant`), the saved grant must be renewed by the owner:

1. Open [Blog connections](http://localhost:3100/connections) and click **Reconnect Google**. Do not disconnect first.
2. Sign in with the same Google account that owns the selected Blogger blog and complete consent.
3. Click **Test connection** and verify the selected blog URL is still correct.
4. Return to the approved article and request its future Blogger schedule again. Choose a time at least five minutes ahead.

Reconnecting preserves the selected blog and publishing checkpoint when ownership verification succeeds. It does not publish or schedule an article. An authentication failure during the scheduling preflight happens before any upload intent is recorded; uncertain upload outcomes must still be synced or reconciled instead of retried blindly.

## Separate first live publication authorization

Only after the connection is verified:

1. Create/review an actual article, primary citations, technical examples and image credits. Pass validation and approve it with editorial notes.
2. In Blog connections, type **AUTHORIZE FIRST LIVE BLOGGER TEST** and select the authorization action. This alone does not publish.
3. Set BLOGGER_MODE=live in `.env` and restart **both** API and worker. Confirm the interface says live integration.
4. In that approved article, choose **Publish / schedule**, explicitly select the first-live-test checkbox, and queue the test.
5. Resume Automation (clear emergency stop if needed). Review the Job history result and open the returned public Blogger URL.
6. Verify there is exactly one post; inspect text, citations, responsive images, attribution, optional footer preference, labels and canonical/indexability behavior. Confirm the remote publication status in Blogger itself.

After the first successful authorized test, subsequently approved articles may publish according to your settings. This test creates a real public post. It is not performed automatically during the build. Blogger approval, policy compliance and ad-network approval remain external responsibilities.

Complete these steps and reply DONE.

## D — Optional paid AI provider

Why: a provider key and API billing/credits belong to the owner, and require an explicit budget decision. Local manual drafting works without this.

1. Review [official model pricing](https://developers.openai.com/api/docs/pricing) and [API keys](https://platform.openai.com/api-keys). Check your actual account's model availability and API credit/billing requirements.
2. If you approve paid API use, create a dedicated restricted project/key, set provider-side usage/budget controls and purchase only the credits you choose. Payment may be required; do not enable this merely to finish setup.
3. In local `.env`, set AI_API_KEY, AI_MODEL and current AI_INPUT_USD_PER_MILLION / AI_OUTPUT_USD_PER_MILLION. Keep AI_MONTHLY_LIMIT_USD within the $0–$10 overall budget; default is $3. Set AI_DAILY_GENERATION_LIMIT=2 initially.
4. Only after authorizing the expense, set AI_BILLING_AUTHORIZED=true and AI_ENABLED=true. Restart API and worker.
5. Add primary sources plus support notes to one editable article, then generate a single draft. Verify it remains NEEDS_REVIEW, usage/cost and internal AI provenance are recorded, the optional public footer matches your preference and no publication occurs.

Success: a source-based draft and real usage record, with editorial approval still required. Never post the key in chat. A ChatGPT subscription is not assumed to include API credits.

Complete these steps and reply DONE.

## E — Optional Unsplash developer access

Commons search and original-image handling do not need this.

1. Read [Unsplash API documentation](https://unsplash.com/documentation) and register a developer application at [Unsplash Developers](https://unsplash.com/developers).
2. Review the current permitted use, approval and rate-limit requirements. Do not assume production approval or a permanent free tier.
3. Store the access key as UNSPLASH_ACCESS_KEY in `.env`, then restart API.
4. Search in Media library, inspect a candidate's source/license and real creator, add useful alt text and confirm rights. Import once.
5. Verify attribution/profile/source links, hotlinked image delivery and the successful download-event response. No payment is initiated by this implementation.

Complete these steps and reply DONE.

## F — Adsterra publisher account and placements

1. Visit the [official publisher portal](https://publishers.adsterra.com/). Sign in if you already have an account; otherwise register as a publisher and verify your email.
2. Open Websites → Add Website. Enter the full HTTPS URL of your existing blog, select its actual category and request a display/native banner unit. Submit for review; report the actual Pending or Approved status. Once approved, open the site → Get code and save the issued snippet locally for placement review. Complete any required ownership verification. The app cannot guarantee acceptance or earnings.
3. Review current Blogger and Adsterra rules and manually place only approved, non-disruptive ad code into an appropriate Blogger theme/gadget location. Avoid misleading ads, forced redirects and aggressive overlays.
4. When actual reports exist, export the official CSV, normalize to the documented columns and import into Monetization. Give each report a stable unique reference. Keep estimates separate.
5. Verify imported totals against the publisher report. No dashboard scraping or automated login is used. API sync is a future extension; ADSTERRA_API_KEY is currently unused.

No purchase is made by the app. Review any externally proposed payment independently. See [official publisher API guide](https://adsterra.com/blog/how-to-use-adsterra-publishers-api/).

Complete these steps and reply DONE.

## G — Optional Search Console and Google Analytics reporting

The owner already has the blog property and reports sitemap Success. Do not repeat those steps. Studio's API access is a separate connection.

1. Enable **Search Console API** in the existing Blogger Google Cloud project if needed. Keep the existing OAuth client and redirect URI.
2. Open **Blog connections → Search Console connection → Connect Search Console read access**. Complete Google's consent with the same account as Blogger. Analytics consent is separate and optional.
3. Choose **Load verified properties**, select the already verified matching property and **Use this property**. The UI saves it locally; SEARCH_CONSOLE_SITE_URL remains an environment fallback, not a required duplicate setup step.
4. On the published article, refresh **Google indexing** and compare its stored verdict and crawl time with Search Console. This is not Test Live URL and does not request indexing. Scheduled articles stay ineligible until Blogger confirms publication.
5. In Traffic & SEO, sync a small date range. Compare real date/page rows with the official report. Reporting delays, property timezones and Search Console top-row limits may explain differences. See [the complete guide](SEARCH_CONSOLE.md).
6. For optional pageviews, configure actual GA4 tracking/property, enable Analytics Data API and use **Blog connections → Google Analytics connection** to authorize read access and save the numeric Property ID plus G- Measurement ID. Follow [the GA4 setup guide](GOOGLE_ANALYTICS.md). Legacy GA_PROPERTY_ID remains a fallback. This is not required for indexing inspection or search clicks/impressions.

Success: real source-labeled records, with unavailable values left blank. This app does not initiate a payment. If the external platform requires a billable change, review before accepting.

Complete these steps and reply DONE.

## H — Optional deployment

No paid hosting is necessary for the local experiment. Before deploying, verify external integrations, production HTTPS/cookies, secret storage, backups/restoration and current dependency support. Review the actual provider price and free alternatives, then obtain explicit owner approval for any new recurring cost or irreversible action.

## Resume after DONE

Current content checkpoint, 9 November: the owner explicitly authorized verified checkpoint recovery and immediate publication of both approved Git tutorials. Both are now confirmed LIVE with exact approved HTML/labels, unique remote posts and public HTTP 200. Automation was paused again and no local publication remains pending. The same-blog checkpoint-reset bug is fixed and actual reselection preserves the recovered dates; no repeated first-test setup is needed for this unchanged blog. Do not republish either article. The next business follow-up is actual readership and publisher earnings reports; no earnings are inferred from publication.

Read PROGRESS.md and inspect configuration presence without printing secrets. Test the configured connection, respect the separate live-publication gate, and continue from the recorded next action. Do not repeat completed setup or ask for secrets in chat.

For the currently running Docker installation, after editing credentials recreate the API/worker with: docker compose --profile app up -d --no-deps --force-recreate backend worker. A simple docker restart does not reload .env.

## Recovering an expired Google authorization

If Blogger scheduling or status reads say Google access expired or was revoked:

1. Open the existing Google Cloud project, then **Google Auth Platform ? Audience**. An External application in **Testing** issues refresh tokens that expire after seven days when Blogger/reporting scopes are requested. For the deployed owner application, use **Publish app / In production** and complete any requirements Google displays. Production status removes that testing expiry; it cannot prevent a user revoking access or other token invalidation.
2. In Studio **Blog connections**, choose **Reconnect Google** and sign in with the same blog-owning account. Keep the selected blog and existing publishing checkpoints. Do not delete the integration or create another client merely to reconnect.
3. The worker checks Google access before starting paid automatic preparation. If a confirmed authorization error happened before any Blogger write, the run shows **Waiting Auth**; its approved article and attached photo remain saved. After reconnection it schedules the existing article under the unchanged policy. Missed dates move to an unoccupied future policy slot, without a catch-up burst or another AI draft.
4. An ambiguous response after a remote write remains **Remote Attention**. Inspect/link the existing Blogger post; never blindly replay it.
5. The worker checks accepted Blogger schedules every five minutes and saves confirmed LIVE status in Studio. A failed read retains the last confirmed state and displays its error; it does not prove publication failed.

Google reference: https://developers.google.com/identity/protocols/oauth2#expiration

Changing Google Cloud to **In production** does not replace a refresh token already issued in Testing. Complete a fresh consent flow using **Blog connections ? Reconnect Google**, then return to Studio. The badge shows **Reconnect required** after a rejected grant; cancelled consent shows a warning and keeps the old credentials. Only a successful callback records restored authorization. The direct reconnect route uses the signed-in Studio session and an uncached redirect. Connection tests refresh the badge on both success and failure. A healthy worker means its process is running; it does not mean Google has authorized publication.
