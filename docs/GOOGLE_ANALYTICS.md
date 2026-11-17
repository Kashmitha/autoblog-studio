# Google Analytics setup for Blogger

Studio can read GA4 pageviews after you configure actual tracking on the public blog. Analytics configuration is independent of article generation, real-photo selection, approval policy and Blogger schedules.

## 1. Create or choose the Analytics property

1. Open [Google Analytics](https://analytics.google.com/) using the Google account connected to Blogger. Reuse a matching GA4 property if you already have one.
2. Otherwise create an Analytics account if needed, then create a property named **Dev & AI Toolbox**. Choose **Sri Lanka / Asia-Colombo** as its reporting timezone and your preferred currency (Studio's financial records use USD).
3. Add a **Web** data stream for the public blog. Choose **HTTPS**, enter `devaitoolbox.blogspot.com`, and give the stream a recognizable name.
4. Under **Admin → Data streams → the Web stream**, copy its **Measurement ID**, beginning `G-`.
5. Under **Admin → Property details** (or the property selector), find the separate **numeric Property ID**. Do not use the stream ID, account ID, a UA tracking ID or the G- Measurement ID in its place.

References: [create a property and stream](https://support.google.com/analytics/answer/9304153?hl=en), [find the Measurement ID](https://support.google.com/analytics/answer/12270356?hl=en).

## 2. Install tracking in Blogger

1. Open Blogger and select **Dev & AI Toolbox**.
2. Open **Settings → Basic → Google Analytics Measurement ID**.
3. Paste the stream's **G- Measurement ID** and save.
4. Install it once. Do not also paste a second copy of the same tracking tag into the theme or an HTML gadget.

If using a first-generation Classic template, this native setting is not supported; follow Google's template guidance. Studio does not edit the public theme or install a tracker automatically.

Reference: [Google's Blogger tag setup](https://support.google.com/analytics/answer/14854594?hl=en), [Blogger compatibility guidance](https://support.google.com/blogger/answer/7039627?hl=en).

## 3. Enable reporting access

1. In the **existing Google Cloud project used by Studio's OAuth client**, enable [Google Analytics Data API](https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com).
2. Open **Studio → Blog connections → Google Analytics connection**.
3. Click **Authorize Google Analytics read access**, sign in with the same blog-owning account, and allow the requested Analytics read permission. The account also needs access to the GA4 property (Viewer or above for reports).
4. Enter the **numeric GA4 Property ID** and the matching **G- Measurement ID** in their separate fields.
5. Click **Save Analytics configuration**. Studio tests a read-only, blog-host-filtered report before saving. Existing Blogger checkpoints, Search Console settings and publishing policy are preserved.
6. **Test Analytics read access** can repeat the read without importing pageviews or generating events.

No additional API key, service account, OAuth client, paid AI call or `.env` edit is required by this setup panel. A legacy numeric `GA_PROPERTY_ID` remains a fallback until you save a Studio selection. The panel uses the already configured Google OAuth client; it does not create a Google Analytics property on your behalf.

Reference: [Google Analytics Data API quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart).

## 4. Confirm collection, then import

1. In Google Analytics, open **Reports → Realtime**.
2. Visit the public blog normally and navigate to a post. Allow time for the event to appear. Browser tracking protection, extensions, consent settings and theme integration can affect collection.
3. Confirm the visit appears in the **same property whose numeric ID you saved in Studio**. A successful API read alone does not confirm the G- ID belongs to that property or that tracking is installed.
4. Standard reports need processing time. New properties cannot supply historical visits from before tracking was installed. Empty results do not prove zero traffic.
5. In Studio open **Traffic & SEO → Sync official Google reports**, choose dates and click **Google Analytics**. Dates follow the GA4 property's timezone. Studio's publication schedule still uses Asia/Colombo independently.

## Import behavior

Imports read `date`, `pageLocation` and `screenPageViews`, filtered to the selected Blogger host. Studio validates the complete bounded report before one atomic upsert; a failed later page, changed property/blog, malformed row or unexpected host retains all prior pageview records. Repeated imports update the same date/URL/source instead of adding duplicates. Explicit reported zeros are retained; empty reports create no placeholder zeros. Analytics and Search Console metrics stay separately labeled.

This feature does not generate visitors, ad clicks, income or indexing requests, and does not add automatic daily Analytics imports. Search Console's existing daily read workflow remains separate.
