import sanitizeHtml from "sanitize-html";
import { linkKey } from "./internal-links";

export const promotionChannels = [
  { source: "linkedin", medium: "social", label: "LinkedIn" },
  { source: "reddit", medium: "social", label: "Developer community" },
  { source: "newsletter", medium: "email", label: "Newsletter" },
] as const;

export function promotionPack(
  article: {
    id: string;
    title: string;
    excerpt: string;
    html: string;
    publishedUrl: string;
  },
  blogUrl: string,
) {
  const canonical = linkKey(article.publishedUrl, blogUrl);
  if (!canonical) throw new Error("Article URL is outside the selected blog.");
  const clean = (text: string) =>
    sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} })
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  const title = clean(article.title);
  // Use saved editorial text only; don't fabricate outcomes or personal experience.
  const summary = clean(
    article.excerpt || article.html.replace(/<\/(p|h\d|li)>/gi, " "),
  ).slice(0, 280);
  const campaign = `article-${article.id}`;
  return {
    articleId: article.id,
    title,
    canonical,
    campaign,
    summary,
    channels: promotionChannels.map((channel) => {
      const url = new URL(canonical);
      for (const key of [...url.searchParams.keys()])
        if (key.startsWith("utm_")) url.searchParams.delete(key);
      url.searchParams.set("utm_source", channel.source);
      url.searchParams.set("utm_medium", channel.medium);
      url.searchParams.set("utm_campaign", campaign);
      const link = url.href;
      const text =
        channel.source === "reddit"
          ? `${title}\n\n${summary}\n\nFull walkthrough: ${link}\n\nDisclosure: this is an article from my blog.`
          : `${title}\n\n${summary}\n\nRead the guide: ${link}`;
      return { ...channel, url: link, text };
    }),
  };
}

export function searchOpportunities(
  rows: {
    keys?: string[] | null;
    clicks?: number | null;
    impressions?: number | null;
    ctr?: number | null;
    position?: number | null;
  }[],
  blogUrl: string,
) {
  return rows
    .flatMap((row) => {
      const [query, rawUrl] = row.keys || [];
      const url = rawUrl ? linkKey(rawUrl, blogUrl) : null;
      if (
        !query?.trim() ||
        !url ||
        !Number.isFinite(row.impressions) ||
        row.impressions! < 1 ||
        !Number.isFinite(row.clicks) ||
        row.clicks! < 0 ||
        row.clicks! > row.impressions! ||
        !Number.isFinite(row.ctr) ||
        row.ctr! < 0 ||
        row.ctr! > 1 ||
        !Number.isFinite(row.position)
      )
        return [];
      const action =
        row.position! <= 20 && row.ctr! < 0.03
          ? "Review whether the title and opening clearly answer this query."
          : "Check the existing answer for gaps; add a useful example or a related follow-up only when needed.";
      return [
        {
          query: query.slice(0, 500),
          url,
          impressions: row.impressions!,
          clicks: row.clicks!,
          ctr: row.ctr!,
          position: row.position!,
          action,
        },
      ];
    })
    .sort(
      (a, b) => b.impressions - a.impressions || a.query.localeCompare(b.query),
    )
    .slice(0, 30);
}
