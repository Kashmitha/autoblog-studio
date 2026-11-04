import sanitizeHtml from "sanitize-html";
import { similarity } from "./workflow";
export interface Issue {
  code: string;
  severity: "error" | "warning";
  message: string;
  evidence: string;
}
export const safeHtml = (html: string) =>
  sanitizeHtml(html, {
    allowedTags: [
      "p",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "a",
      "strong",
      "em",
      "blockquote",
      "pre",
      "code",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "br",
      "hr",
      "figure",
      "figcaption",
      "img",
    ],
    allowedAttributes: {
      a: ["href", "title"],
      img: ["src", "alt", "width", "height", "loading"],
    },
    allowedSchemes: ["https"],
    allowProtocolRelative: false,
    transformTags: {
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, loading: "lazy" },
      }),
    },
  });
export function checkQuality(
  article: {
    id: string;
    title: string;
    html: string;
    excerpt: string;
    aiAssisted: boolean;
    disclosure: boolean;
    sources: {
      url: string;
      checkedAt: Date | null;
      httpStatus: number | null;
      note: string;
    }[];
    media: {
      media: {
        rightsConfirmed: boolean;
        alt: string;
        creator: string;
        attribution: string;
        license: string;
        checkedAt: Date;
        url?: string;
      };
    }[];
  },
  others: { id: string; title: string; html: string }[],
  options: { minWords?: number; sourceMaxAgeDays?: number } = {},
) {
  const issues: Issue[] = [];
  const issue = (
    code: string,
    severity: Issue["severity"],
    message: string,
    evidence: string,
  ) => issues.push({ code, severity, message, evidence });
  const plain = sanitizeHtml(article.html, {
    allowedTags: [],
    allowedAttributes: {},
  });
  const words = plain.split(/\s+/).filter(Boolean);
  const links = [...article.html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)].map(
    (m) => m[1].replaceAll("&amp;", "&"),
  );
  const inlineImages = [
    ...article.html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi),
  ].map((m) => m[1].replaceAll("&amp;", "&"));
  for (const url of inlineImages) {
    if (!article.media.some(({ media }) => media.url === url))
      issue(
        "UNTRACKED_IMAGE",
        "error",
        "Every inline image must have an attached, reviewed licensing record.",
        url,
      );
  }
  for (const tag of article.html.match(/<img\b[^>]*>/gi) || []) {
    if (!/\balt="[^"]+"/i.test(tag))
      issue(
        "IMAGE_ALT",
        "error",
        "Every inline image needs meaningful alt text.",
        tag.slice(0, 200),
      );
  }
  const minWords = options.minWords ?? 180,
    sourceMaxAgeDays = options.sourceMaxAgeDays ?? 30;
  if (words.length < minWords)
    issue(
      "THIN_CONTENT",
      "error",
      `Add a useful, complete article (configured minimum ${minWords} words).`,
      `${words.length} words`,
    );
  if (article.html !== safeHtml(article.html))
    issue(
      "UNSAFE_HTML",
      "error",
      "Remove unsafe or unsupported HTML.",
      "HTML differs from the allowlisted rendering.",
    );
  if (!/<h2[ >]/i.test(article.html))
    issue(
      "HEADINGS",
      "error",
      "Add descriptive section headings.",
      "No h2 found.",
    );
  if (!article.excerpt.trim())
    issue(
      "EXCERPT",
      "error",
      "Write a descriptive excerpt.",
      "Excerpt is empty.",
    );
  if (!article.sources.length)
    issue(
      "NO_SOURCES",
      "error",
      "Add primary research sources and check the links.",
      "No sources attached.",
    );
  for (const s of article.sources) {
    if (
      !s.checkedAt ||
      s.httpStatus === null ||
      s.httpStatus < 200 ||
      s.httpStatus >= 400
    )
      issue(
        "SOURCE_UNVERIFIED",
        "error",
        "Verify the source URL before approval.",
        s.url,
      );
    else if (Date.now() - s.checkedAt.getTime() > sourceMaxAgeDays * 86400000)
      issue(
        "SOURCE_STALE",
        "error",
        `Recheck sources older than ${sourceMaxAgeDays} days.`,
        s.url,
      );
    if (!links.includes(s.url))
      issue(
        "MISSING_CITATION",
        "error",
        "Cite each research source in the article.",
        s.url,
      );
    if (!s.note.trim())
      issue(
        "FACT_CHECK",
        "error",
        "Record what this source supports after reviewing it.",
        s.url,
      );
  }
  for (const other of others) {
    if (other.id === article.id) continue;
    const topic = similarity(article.title, other.title);
    const body = similarity(
      plain,
      sanitizeHtml(other.html, { allowedTags: [], allowedAttributes: {} }),
    );
    if (topic > 0.8 || (words.length > 180 && body > 0.85))
      issue(
        "DUPLICATE",
        "error",
        "Review potential overlap with another article.",
        other.title,
      );
  }
  for (const { media: m } of article.media) {
    if (m.url && !m.url.startsWith("https://"))
      issue(
        "IMAGE_DELIVERY",
        "error",
        "Host this original image at a public HTTPS URL before approval. Local uploads are private previews.",
        m.url,
      );
    if (
      !m.rightsConfirmed ||
      !m.creator ||
      !m.attribution ||
      !m.alt ||
      /nc|no derivatives|unknown/i.test(m.license)
    )
      issue(
        "IMAGE_RIGHTS",
        "error",
        "Confirm commercial rights, creator, alt text and attribution.",
        m.attribution || "Missing credit",
      );
  }
  const counts = new Map<string, number>();
  words.forEach((w) => {
    const k = w.toLowerCase().replace(/[^a-z]/g, "");
    if (k.length > 5) counts.set(k, (counts.get(k) || 0) + 1);
  });
  for (const [w, n] of counts)
    if (n / Math.max(words.length, 1) > 0.06)
      issue(
        "REPETITION",
        "warning",
        "Reduce repeated wording.",
        `${w}: ${n} occurrences`,
      );
  if (
    /guaranteed (income|rankings|revenue)|click (on |the )?ads|undetectable ai/i.test(
      plain,
    )
  )
    issue(
      "CLAIMS",
      "error",
      "Remove misleading advertising or ranking claims.",
      "Potentially misleading claim detected.",
    );
  issue(
    "EDITORIAL_REVIEW",
    "warning",
    "Human review must verify technical claims, code, originality, current policy and image context.",
    "Automated checks cannot certify factual accuracy, originality, search ranking or policy compliance.",
  );
  const passed = !issues.some((i) => i.severity === "error");
  return {
    passed,
    score: Math.max(
      0,
      100 -
        issues.filter((i) => i.severity === "error").length * 15 -
        issues.filter((i) => i.severity === "warning").length * 3,
    ),
    issues,
  };
}
