import type { Prisma } from "@prisma/client";
import { commonsPhotoQueries } from "./commons-photo";

export type PhotoArticle = {
  title: string;
  niche: string;
  intent: string;
  generation: unknown;
};

/** Illustrative photography, never a purported screenshot of a tutorial. */
export function articlePhotoTerms(article: PhotoArticle, requested?: string[]) {
  if (requested) return commonsPhotoQueries(requested);
  const generated = (
    article.generation as { imageSearchTerms?: unknown } | null
  )?.imageSearchTerms;
  const terms = commonsPhotoQueries(
    Array.isArray(generated)
      ? generated.filter((v): v is string => typeof v === "string")
      : [],
  );
  if (terms.length) return terms;
  const topic = `${article.niche} ${article.title}`;
  if (/\b(docker|containers?|servers?|devops|networks?)\b/i.test(topic))
    return ["server computer", "data center"];
  if (
    /\b(git|github|python|javascript|typescript|node|programming|browser|http|curl|developer|web)\b/i.test(
      topic,
    )
  )
    return ["laptop keyboard", "computer workstation"];
  return [];
}

export function recentPhotoUse(
  articleId: string,
  now = new Date(),
): Prisma.ArticleMediaWhereInput {
  const gte = new Date(now.getTime() - 7 * 86400000);
  return {
    articleId: { not: articleId },
    article: {
      OR: [
        { editorialRuns: { some: { createdAt: { gte } } } },
        { publishedAt: { gte } },
        { scheduledAt: { gte } },
        {
          status: {
            in: [
              "PLANNED",
              "RESEARCHING",
              "DRAFTING",
              "NEEDS_REVIEW",
              "APPROVED",
            ],
          },
          updatedAt: { gte },
        },
      ],
    },
  };
}
