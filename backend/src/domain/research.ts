import sanitizeHtml from "sanitize-html";
export function referenceExcerpt(html: string) {
  const text = sanitizeHtml(
    html.replace(/<\/(?:p|h[1-6]|li|div|section|pre)>/gi, "$& "),
    {
      allowedTags: [],
      allowedAttributes: {},
      nonTextTags: [
        "script",
        "style",
        "textarea",
        "option",
        "nav",
        "header",
        "footer",
        "aside",
      ],
    },
  )
    .replace(/\s+/g, " ")
    .trim();
  // Git manuals put navigation and version history before the actual manual.
  const manual = text.search(/\bNAME\s+git-[a-z-]+\s+-/);
  return text.slice(manual >= 0 ? manual : 0).slice(0, 3500);
}
