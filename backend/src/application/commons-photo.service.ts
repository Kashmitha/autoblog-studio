import { Injectable } from "@nestjs/common";
import { PrismaService } from "../infrastructure/prisma.service";
import {
  commonsAutoEnabled,
  commonsPhotoQueries,
  inspectCommonsPhoto,
  type CommonsFile,
} from "../domain/commons-photo";
import { photoPolicy } from "../domain/editorial";

@Injectable()
export class CommonsPhotoService {
  constructor(private readonly db: PrismaService) {}
  async discover(terms: string[], articleId: string) {
    if (!commonsAutoEnabled()) return null;
    for (const query of commonsPhotoQueries(terms)) {
      const url = new URL("https://commons.wikimedia.org/w/api.php");
      url.search = new URLSearchParams({
        action: "query",
        format: "json",
        generator: "search",
        gsrsearch: query,
        gsrnamespace: "6",
        gsrlimit: "12",
        prop: "imageinfo|categories",
        cllimit: "50",
        iiprop: "url|size|mime|mediatype|sha1|timestamp|metadata|extmetadata",
      }).toString();
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "AutoBlogStudio/0.1 (editorial photo selection; two posts daily)",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error(
          `Commons photo discovery returned HTTP ${response.status}.`,
        );
      const body = (await response.json()) as {
        query?: { pages?: Record<string, CommonsFile> };
        error?: unknown;
      };
      if (body.error)
        throw new Error("Commons photo discovery could not complete.");
      const candidates = Object.values(body.query?.pages || {})
        .map((p) => inspectCommonsPhoto(p, query))
        .filter((p) => p !== null)
        .sort((a, b) => b.relevance - a.relevance);
      // Bound image availability checks; no crawling or unrelated fallback.
      for (const candidate of candidates.slice(0, 3)) {
        let image: Response;
        try {
          image = await fetch(candidate.url, {
            method: "HEAD",
            redirect: "error",
            signal: AbortSignal.timeout(10000),
          });
        } catch {
          continue;
        }
        if (
          !image.ok ||
          !image.headers
            .get("content-type")
            ?.toLowerCase()
            .startsWith("image/jpeg")
        )
          continue;
        const { evidence, relevance, ...asset } = candidate;
        const saved = await this.db.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172261)`;
          const existing = await tx.mediaAsset.findFirst({
            where: {
              OR: [
                { url: asset.url },
                { sourceUrl: asset.sourceUrl },
                {
                  metadata: {
                    path: ["commonsAutoReview", "sha1"],
                    equals: evidence.sha1,
                  },
                },
              ],
            },
          });
          if (existing) {
            if (!photoPolicy(existing)) return null;
            const recentUse = await tx.articleMedia.count({
              where: {
                mediaId: existing.id,
                articleId: { not: articleId },
                article: {
                  OR: [
                    {
                      editorialRuns: {
                        some: {
                          createdAt: {
                            gte: new Date(Date.now() - 7 * 86400000),
                          },
                        },
                      },
                    },
                    {
                      publishedAt: { gte: new Date(Date.now() - 7 * 86400000) },
                    },
                    {
                      scheduledAt: { gte: new Date(Date.now() - 7 * 86400000) },
                    },
                  ],
                },
              },
            });
            return recentUse ? null : existing;
          }
          const now = new Date();
          const media = await tx.mediaAsset.create({
            data: {
              ...asset,
              rightsConfirmed: true,
              checkedAt: now,
              metadata: {
                licenseCheckedBy: "AUTOMATIC_COMMONS_METADATA_POLICY",
                commonsAutoReview: {
                  ...evidence,
                  reviewedAt: now.toISOString(),
                  policyVersion: 1,
                  humanReviewed: false,
                  provenanceLimit:
                    "Camera metadata and pre-2022 file revision evidence; not proof against forged metadata or undisclosed third-party rights.",
                },
                editorialPhoto: {
                  enabled: true,
                  tags: [query],
                  confirmedAt: now.toISOString(),
                  reviewKind: "AUTOMATIC_COMMONS_METADATA",
                },
              },
            },
          });
          await tx.auditLog.create({
            data: {
              action: "COMMONS_PHOTO_AUTOMATICALLY_REVIEWED",
              entityId: media.id,
              message: `Automated metadata policy, not human review. Commons page ${evidence.pageId}; ${asset.license}.`,
            },
          });
          return media;
        });
        if (saved) return saved;
      }
    }
    return null;
  }
}
