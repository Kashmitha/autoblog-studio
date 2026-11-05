import { safeHtml } from "./quality";
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function publicationHtml(a: {
  html: string;
  aiAssisted: boolean;
  disclosure: boolean;
  media: {
    media: {
      url: string;
      alt: string;
      profileUrl: string | null;
      creator: string;
      attribution: string;
      sourceUrl: string;
      licenseUrl: string;
      license: string;
    };
  }[];
}) {
  const figures = a.media
    .map(
      ({ media: m }) =>
        `<figure><img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.alt)}" loading="lazy" /><figcaption>${m.profileUrl ? `<a href="${escapeHtml(m.profileUrl)}">${escapeHtml(m.creator)}</a> · ` : ""}${escapeHtml(m.attribution)} — <a href="${escapeHtml(m.sourceUrl)}">Source</a> · <a href="${escapeHtml(m.licenseUrl)}">${escapeHtml(m.license)}</a></figcaption></figure>`,
    )
    .join("");
  return safeHtml(
    `${a.html}${figures}${a.aiAssisted && a.disclosure ? "<p><em>Prepared with AI assistance.</em></p>" : ""}`,
  );
}
