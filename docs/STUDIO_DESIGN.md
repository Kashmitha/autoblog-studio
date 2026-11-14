# Studio design: supplied Seraph template

The only homepage is the existing owner workspace at `/`. The rejected marketing page, its illustrations and animation code have been removed; `/welcome` redirects to `/`. Authentication and all backend publishing controls are preserved.

The current design follows the owner's `font-launch-landing-page-v1.zip`, specifically its Seraph Foundry type specimen. This supersedes the earlier neutral dashboard styling. The archive was inspected as reference material; its scripts were not executed and its typeface shop, prices, licensing cart and fictional foundry text were not imported into Studio.

The template's actual Grenze Gotisch variable display face and Poppins body faces are self-hosted, with their SIL Open Font Licenses. Warm ivory paper (`#eeeee3`), forest ink (`#183e32`), olive (`#526f27`) and chartreuse (`#d9ef8b`) replace pink. Oversized blackletter headings, a tinted overprint band, four-point ornaments, calligraphic swashes and fine rules retain the specimen's visual language. The book-and-quill engraving is an original SVG; no AI-generated or third-party photograph is used in the interface.

The fixed sidebar has been replaced by a full-width masthead. Workspace, Publishing and Insights are native disclosure menus containing the existing Studio routes. Menus support keyboard opening, Escape, outside dismissal and automatic closing after navigation. On mobile the same routes appear in a drawer with explicit close and Escape controls. The homepage shortcuts lead to articles, media, calendar and search reports; New article and View calendar use the existing functions. Actual saved reporting and publishing controls remain below the overview specimen. Every other Studio screen adopts the template's display headings, Poppins controls, square paper panels, ruled tables and ink buttons. Dark mode, focus indicators and reduced motion are supported.

All reported data remains real; no presentation statistics or fabricated charts are added. The interface has no runtime dependency on Google Fonts or another font CDN. Existing article photographs and their attribution are unaffected by this interface design.

No credentials, AI provider selection, billing, scheduling, article approval or public Blogger state are changed by this design. This is a frontend-only refresh, not a hosted multi-tenant SaaS deployment.
