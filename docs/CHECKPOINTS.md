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

1. Verify the real blog/property in [Search Console](https://search.google.com/search-console). Set up a GA4 property and actual tracking in Blogger if desired.
2. Enable Search Console API and Google Analytics Data API in the same Google Cloud project.
3. Set SEARCH_CONSOLE_SITE_URL to the exact verified property (`https://.../` or `sc-domain:...`). Set GA_PROPERTY_ID to the numeric property ID. Store these locally in `.env`.
4. Restart API. In Integration setup, click **Authorize Google reporting scopes** and grant read-only reporting access.
5. In Traffic & SEO, sync a small date range. Compare date/page rows with the official report. Reporting delays, property timezones and Search Console top-row limits may explain differences.
6. Verify a sitemap URL in the app, then submit it manually under the correct Search Console property's Sitemaps section.

Success: real source-labeled records, with unavailable values left blank. This app does not initiate a payment. If the external platform requires a billable change, review before accepting.

Complete these steps and reply DONE.

## H — Optional deployment

No paid hosting is necessary for the local experiment. Before deploying, verify external integrations, production HTTPS/cookies, secret storage, backups/restoration and current dependency support. Review the actual provider price and free alternatives, then obtain explicit owner approval for any new recurring cost or irreversible action.

## Resume after DONE

Read PROGRESS.md and inspect configuration presence without printing secrets. Test the configured connection, respect the separate live-publication gate, and continue from the recorded next action. Do not repeat completed setup or ask for secrets in chat.

For the currently running Docker installation, after editing credentials recreate the API/worker with: docker compose --profile app up -d --no-deps --force-recreate backend worker. A simple docker restart does not reload .env.
