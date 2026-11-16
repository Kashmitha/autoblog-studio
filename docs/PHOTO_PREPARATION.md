# Photo preparation queue

Open **Automation → Automatic photo preparation**. The queue lists up to 50 recently updated local drafts, including written/imported drafts that did not originate in the scheduled text workflow.

1. Write or generate and save the article text. Empty topic briefs show **Save article text first**.
2. Review the suggested photographic keywords; change them if needed. Keywords describe an illustrative real scene such as a laptop keyboard or server computer, not a fabricated screenshot of a command.
3. Click **Prepare image** for one draft or **Prepare up to 5 missing images** for a sequential batch. Stop ends the batch after its current request; leaving the page also stops later requests.
4. Preview the attached image and attribution in the article editor. Rerun quality checks and approve before using manual publishing or scheduling.

The article editor also has **Find and attach a real photo** for saved, unapproved articles without an image. Save any pending edits first. This action does not call the text provider, approve content, create a publication job or resume automation.

## Selection and mandatory workflow images

Selection uses an eligible, related, unused library photo first. When `COMMONS_AUTO_IMPORT=true`, Commons discovery is the fallback under the existing [metadata policy](AUTOMATIC_PHOTOS.md). Unknown subjects receive no unrelated technology-photo fallback. Unsplash search and attachment remain manual. No image-generation service is used.

The scheduled article workflow uses the same selector and atomic attachment check. **It requires a photo before quality checks, policy approval and Blogger scheduling.** If no candidate passes, its text draft waits at the photo stage; it never silently publishes a text-only fallback. The queue itself does not enable this workflow: its existing owner policy and pause/resume controls remain separate.

## Protection and retries

- Existing images are preserved. Approved, scheduled, published and Blogger-handed-off articles are excluded from the queue and rejected by preparation endpoints.
- Stale versions and draft approval during discovery are rejected at attachment time. A scheduled workflow already working on a draft blocks manual preparation.
- An atomic database claim prevents concurrent automatic requests from attaching the same recently used photo to different drafts. Recent draft attachments count toward the seven-day exclusion as well as scheduled/published use.
- Pool eligibility is checked again at attachment. The image, attribution and source remain in the normal publication renderer.
- Provider failure or no match preserves article text/version, records a version-specific blocker in the audit history and allows another attempt without regenerating text. A refresh retains the last blocker for that draft version.
- Photographic origin and all reuse rights cannot be proven by metadata. Automatically inspected Commons candidates retain their distinct provenance; this feature does not claim human review or detector guarantees.

The local worker must run to generate and prepare future articles. Once Blogger confirms a hosted schedule, that scheduled post can publish while the local computer is off. Two daily publication times still use Asia/Colombo and the existing daily limits.

No schema migration or additional image-provider key is required by this feature.
