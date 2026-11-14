# Studio interface refresh

The only homepage is the existing owner workspace at `/`. The rejected marketing page, its illustrations and animation code have been removed; `/welcome` redirects to `/`. Authentication and all backend publishing controls are preserved.

The interface draws on [Linear's compact product navigation](https://linear.app/) and [Ghost's editorial focus](https://ghost.org/). Self-hosted variable Inter replaces the system font. Neutral white/slate surfaces, restrained emerald accents, consistent borders, tabular metrics, clearer form labels, readable status treatments and quieter panels apply across the workspace. Dark mode uses graphite rather than tinting every surface green. Mobile navigation, keyboard focus and reduced-motion preferences remain supported.

Screen titles describe actual tasks: Publishing overview, Articles, Topic planner, Article generator, Publishing calendar and Automation. All data remains real; no presentation statistics or fabricated charts are added. The interface has no runtime dependency on Google Fonts or another font CDN. The Inter SIL Open Font License is retained under `frontend/public/fonts/`.

No credentials, AI provider selection, billing, scheduling, article approval or public Blogger state are changed by this design. This is a frontend-only refresh, not a hosted multi-tenant SaaS deployment.
