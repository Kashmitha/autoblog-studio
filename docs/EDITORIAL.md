# Editorial preferences

Owner preference recorded on 4 November 2026: the site aims to earn income through useful developer content, written in natural, direct language. Avoid generic AI phrasing, repetitive structures, padded introductions and keyword stuffing. Prefer a specific answer, concrete examples, expected outputs and clear explanations of limitations. Preserve the author's own edits and voice.

Do not invent personal experience, tests, benchmarks, quotes or human-only authorship. AI-detector results, search rankings, ad approval and earnings cannot be guaranteed. Keep verified research and human editorial approval as the quality controls.

The owner does not want a stock AI-assistance sentence appended to every article. Public footer display is an optional article setting, off for new drafts. Workspace AI provenance stays recorded separately and is not rendered in the article. Turning the footer on adds only "Prepared with AI assistance."; it does not claim that an unfinished draft was reviewed. Public-footer changes invalidate any prior editorial approval through the normal article update flow.

For a short Git tutorial, tested commands and their expected output can be sufficient. Add an original terminal screenshot when it clarifies an important step. Avoid irrelevant stock photos. Any attached image still needs real provenance, permission/license checks, alt text and public HTTPS delivery before publication.

## Blogger settings in Studio

| Setting | Current behavior |
| --- | --- |
| Title and article body | Sent to Blogger by the publisher. |
| Labels | Enter comma-separated labels in the editor; these are sent as Blogger post labels. |
| Images | Reviewed attached media is appended with alt text, credits and source/license links. Private uploads need public delivery first. |
| Publishing time | On Blogger sends approved content and a future date to Google now; once confirmed, publication does not require this computer. On this computer uses the local worker and requires the computer/Docker to run; pause defers local jobs. See BLOGGER_SCHEDULING.md. |
| Permalink | Blogger generates the public URL. Studio records the returned URL. Its internal slug and canonical reference do not set it. |
| Custom permalink | Not implemented through Studio. Blogger's editor supports this setting before publication. Studio currently creates and publishes in one worker job, with no intermediate remote-draft editing screen. |
| Search description | Not synced. Studio's excerpt is a workspace summary, not Blogger's per-post search description. |
| Canonical reference | Workspace reference only; it does not write a public canonical tag. |
| Robots, comments and theme settings | Not configured per post by Studio; manage them in Blogger. |

Custom permalink/search-description work should use Blogger's editor until a separate remote-draft review flow is implemented and verified. Do not add unsupported API fields or treat an internal reference as a public SEO setting.

References: [Blogger post resource](https://developers.google.com/blogger/docs/3.0/reference/posts), [Blogger custom permalink help](https://support.google.com/blogger/answer/41373), [Google Search AI guidance](https://developers.google.com/search/blog/2023/02/google-search-and-ai-content).
