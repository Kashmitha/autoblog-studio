import sanitizeHtml from "sanitize-html";
/** List only references actually fetched and supplied to the text provider. */
export function withResearchReferences(html: string, sourceUrls: string[]) {
  const linked = new Set<string>();
  sanitizeHtml(html, {
    transformTags: {
      a: (tagName, attribs) => {
        if (attribs.href) linked.add(attribs.href);
        return { tagName, attribs };
      },
    },
  });
  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const missing = [...new Set(sourceUrls)].filter((url) => {
    try {
      const u = new URL(url);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        !linked.has(url)
      );
    } catch {
      return false;
    }
  });
  return missing.length
    ? html +
        "\n<h2>Research references</h2><ul>" +
        missing
          .map((url) => `<li><a href="${escape(url)}">${escape(url)}</a></li>`)
          .join("") +
        "</ul>"
    : html;
}
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
