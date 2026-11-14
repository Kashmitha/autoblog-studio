# Studio design: glass workspace

The only homepage remains the owner workspace at `/`; `/welcome` redirects to it. The current owner-requested enhancement replaces the paper/blackletter presentation with a glass treatment inspired by the supplied Raycast reference. Existing navigation, authentication, articles, media, reporting and publishing controls retain their behavior.

## Visual system

- Light: pearl `#f5f2f6`, charcoal text `#282331`, muted burgundy accent `#963651`.
- Dark: charcoal `#141219`, warm white text `#f7f1f6`, coral accent `#f5acb7`.
- Plum/coral ambient glows sit behind frosted panels, fine borders and restrained shadows. Panels are approximately 91% opaque so the effect does not compromise dense text. Navigation menus are more opaque; text fields and dialogs use solid surfaces.
- Self-hosted Poppins headings and Inter body/controls, with existing font licenses. Article titles are 16px (15px on mobile); functional buttons/menu labels 14px; statuses 12px. The previous blackletter display face is superseded.
- The original folded-page/A vector monogram appears in the masthead, login, loading state and browser icon. The overview cover illustration is CSS/vector artwork, decorative and hidden from assistive technology. It is not a generated article photograph or a real publishing status.

The homepage remains functional: New article, View calendar and four editorial shortcuts lead to existing tools, with actual metrics below. No invented revenue, traffic, approval or scheduled-post counts are added. Existing article images and attribution are unchanged.

`frontend/src/app/glass-studio.css` is the final theme layer over the existing layout styles. The new mark lives in `components/studio-mark.tsx` and `app/icon.svg`. No extra runtime library, remote font service or image API is needed.

## Readability and access

The design follows the material principle of increasing opacity around dense content, informed by [Apple's materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials) and [color guidance](https://developer.apple.com/design/human-interface-guidelines/color). The supplied Raycast image guides mood and color, not a copied layout or branding.

44 targeted text/background checks, including extreme black/white backgrounds underneath translucent surfaces, have a minimum ratio of 5.12:1. This exceeds the [WCAG normal-text reference of 4.5:1](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html). These measurements are palette checks, not a complete accessibility certification.

Native menus retain keyboard opening, Escape/focus return, outside dismissal and route-change closing. The mobile drawer uses the same links. Focus rings remain visible, disabled controls remain distinguishable, and semantic success/warning/error colors are separately specified for both themes. Opaque fallbacks support reduced transparency, increased contrast and browsers without backdrop blur; reduced motion and forced colors are respected.

## Product boundary

This is a local frontend enhancement. It does not enable AI billing, resume automation, alter approval or Google checkpoints, upload articles, or change saved schedules. The existing Google reconnection requirement remains independent of the design.

A future subscription product needs customer accounts, tenant isolation, per-customer encrypted integrations, billing/entitlements, durable hosted scheduling, operations and recovery, and a production security review. The UI refresh alone does not establish those capabilities.
