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
export function referenceExcerpt(html: string, focus = "") {
  const clean = (value: string) =>
    sanitizeHtml(
      value.replace(/<\/(?:p|h[1-6]|li|div|section|pre)>/gi, "$& "),
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
  const text = clean(html);
  if (focus && text.length > 3500) {
    const ignored = new Set(
      "the and with from this that into when which their your source reference explain show without using article image illustrative choose supported primary reader claim examples existing subject never photograph".split(
        " ",
      ),
    );
    const tokens = [
      ...new Set(
        (focus.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []).filter(
          (t) => !ignored.has(t),
        ),
      ),
    ].slice(0, 70);
    // Option names are more useful than the manual's alphabetical introduction.
    const optionTokens: string[] = [];
    if (/\bcurl\b/i.test(focus)) {
      if (/head|header/i.test(focus))
        optionTokens.push("head", "show-headers", "include");
      if (/redirect/i.test(focus)) optionTokens.push("location", "max-redirs");
      tokens.push(...optionTokens);
    }
    const sections = html
      .split(/(?=<h[1-6]\b|<p\b[^>]*class=["'][^"']*\blevel0\b)/i)
      .map((part, index) => {
        const body = clean(part);
        const headingHtml =
          part.match(/^<(?:h[1-6]|p)\b[^>]*>[\s\S]*?<\/(?:h[1-6]|p)>/i)?.[0] ||
          "";
        const heading = clean(
          /^<h[1-6]\b/i.test(headingHtml) ||
            /class=["']nroffip["']/i.test(headingHtml)
            ? headingHtml
            : "",
        )
          .slice(0, 180)
          .toLowerCase();
        const words = new Set(body.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g));
        const headingWords = new Set(heading.match(/[a-z][a-z0-9-]{2,}/g));
        const score = tokens.reduce(
          (n, token) =>
            n +
            (words.has(token) ? 1 : 0) +
            (headingWords.has(token)
              ? optionTokens.includes(token)
                ? 30
                : 5
              : 0),
          0,
        );
        return { body, index, score };
      })
      .filter((p) => p.score > 0 && p.body.length > 60)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 5);
    if (sections.length)
      return sections
        .map((p) => p.body.slice(0, 680))
        .join("\n[Reference excerpt]\n")
        .slice(0, 3500);
  }
  // Git manuals put navigation and version history before the actual manual.
  const manual = text.search(/\bNAME\s+git-[a-z-]+\s+-/);
  return text.slice(manual >= 0 ? manual : 0).slice(0, 3500);
}
