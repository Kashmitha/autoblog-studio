import { Parser } from "htmlparser2";
const stop = new Set(
  "a an the to of in on for and or with without how why what is are do does can your you from this that using use file files guide tutorial tutorials beginner beginners changes change not be been being have has had it its their them they we our as at by into while when then than help current next should would will able".split(
    " ",
  ),
);
export function linkKey(raw: string, base: string) {
  try {
    const u = new URL(raw, base);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      u.origin !== new URL(base).origin
    )
      return null;
    u.hash = "";
    if (
      u.hostname.endsWith(".blogspot.com") &&
      ["0", "1"].includes(u.searchParams.get("m") || "")
    )
      u.searchParams.delete("m");
    return u.href;
  } catch {
    return null;
  }
}
export function linkedUrls(html: string, base: string) {
  const links = new Set<string>();
  let excluded = 0;
  const ignored = new Set(["script", "template", "noscript", "style"]);
  new Parser(
    {
      onopentag(name, attrs) {
        if (ignored.has(name)) excluded++;
        if (!excluded && name === "a" && attrs.href) {
          const key = linkKey(attrs.href, base);
          if (key) links.add(key);
        }
      },
      onclosetag(name) {
        if (ignored.has(name)) excluded = Math.max(0, excluded - 1);
      },
    },
    { decodeEntities: true },
  ).end(html);
  return links;
}
function terms(text: string) {
  return new Set(
    (text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}+#.-]*/gu) || []).filter(
      (t) => t.length > 1 && !stop.has(t),
    ),
  );
}
export interface LinkArticle {
  id: string;
  title: string;
  intent: string;
  labels: string[];
  niche: string;
  html: string;
  publishedUrl: string | null;
}
export function suggestInternalLinks(
  source: LinkArticle,
  candidates: LinkArticle[],
  blogUrl: string,
) {
  const existing = linkedUrls(source.html, blogUrl),
    own = source.publishedUrl ? linkKey(source.publishedUrl, blogUrl) : null;
  const keywords = terms(
    [source.title, source.intent, ...source.labels].join(" "),
  );
  const seen = new Set<string>();
  return candidates
    .flatMap((candidate) => {
      const url =
        candidate.publishedUrl && linkKey(candidate.publishedUrl, blogUrl);
      if (
        candidate.id === source.id ||
        !url ||
        url === own ||
        seen.has(url) ||
        existing.has(url)
      )
        return [];
      const sharedTerms = [
        ...terms(
          [candidate.title, candidate.intent, ...candidate.labels].join(" "),
        ),
      ]
        .filter((t) => keywords.has(t))
        .sort();
      if (!sharedTerms.length) return [];
      seen.add(url);
      return [
        {
          id: candidate.id,
          title: candidate.title,
          url,
          sharedTerms: sharedTerms.slice(0, 8),
          score:
            sharedTerms.length * 10 +
            (candidate.niche === source.niche ? 1 : 0),
        },
      ];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 5);
}
