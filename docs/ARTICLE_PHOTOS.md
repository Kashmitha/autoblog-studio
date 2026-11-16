# Review and attach article photos

Open an editable article and scroll to **Article images**. This workflow needs no text AI key. It uses photographs and screenshots already imported into Media library; it does not search external providers or generate images.

1. Save any unsaved article changes first. A remotely scheduled, publishing or published article cannot be changed through this chooser.
2. Search the library by title, alt text or photographer and optionally filter by provider. Archived credit references and images already attached to the article are excluded.
3. Choose **Preview a library image**. Review the image, its descriptive alt text, creator, visible credit and source/license links. Selecting, searching and filtering do not change the article.
4. Click **Attach selected image**. This explicitly adds the selected image through the existing article-media endpoint; existing attachments are retained. The server invalidates prior editorial approval/version evidence as before. Remove an existing image separately if you intend to replace it.
5. Inspect the article preview, recheck quality and save fresh editorial approval before scheduling. No publication is authorized by attaching a photograph.

Imported Unsplash photos can be manually attached here. They remain excluded from the automatic photo pool. Commons and original photos still require separate rights and real-photo confirmation for automatic selection.

An image without confirmed rights review cannot be attached through the chooser. A private original may be attached to a draft, but it needs public HTTPS delivery before publication. Archived references must be re-imported and reviewed first. Source/license links are shown only for HTTPS addresses. License metadata is evidence for review, not a guarantee of rights or subject relevance.

If the library cannot be loaded, the chooser distinguishes that failure from an empty result and blocks attachment. **Refresh media library** retries the read. A failed attachment remains visible for inspection/retry; it does not silently select another photo or publish anything.

No schema or backend changes are required. Keys, billing, global automation, existing attachments and publishing state are unchanged by installing this UI.
