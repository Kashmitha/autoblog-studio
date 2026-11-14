# Emerald AutoBlog Studio landing page

Open **http://localhost:3100/welcome**. This is the public product presentation; the existing owner workspace and sign-in remain at `/`. A link on sign-in opens the landing page. It is implemented in the existing Next.js app, with no separate hosting registration or changes to Blogger's theme.

The direction combines deep emerald, graphite, warm paper and electric mint. Oversized typography, drifting editorial covers, a continuously moving article ribbon and a connected publishing diagram take inspiration from Pitch's spacious, motion-led presentation. Artwork and copy are original to AutoBlog Studio; no Pitch or Marvel assets were copied. The covers are code-native editorial illustrations inspired by the blog's Git, Docker and developer topics, not generated stock photographs or private article screenshots.

Visitors can explore Shape / Refine / Publish tabs, open FAQ answers, pause motion, read the actual public blog or enter the existing workspace. Keyboard arrows/Home/End work in the tabs, mobile navigation has an expanded state, and reduced-motion preferences disable animation. The page makes no authentication, provider, reporting or publishing API calls. It contains no invented customer logos, testimonials, revenue claims, paid signup or functioning multi-tenant subscription service.

Landing copy distinguishes illustrative previews from the actual workspace and describes only existing product workflows. A separate future task would be needed to make this the production site's root or deploy a public SaaS service. Local installation does not expose private settings or deploy the owner workspace to the internet.

Groq setup is deliberately separate. The current text adapter remains OpenAI-specific; creating a Groq key does not automatically enable Groq generation. Keep keys out of the landing page and client bundles.
