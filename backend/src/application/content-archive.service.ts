import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../infrastructure/prisma.service";
export const archiveLimits = {
  articles: 500,
  media: 2000,
  bytes: 20 * 1024 * 1024,
};
const coverage = {
  included: [
    "Article HTML, titles, reader intent, excerpts and labels",
    "Private planning notes and priorities",
    "Primary source URLs, support notes and saved check dates",
    "Media references, alt text, licenses and attribution",
    "Saved publication references and AI provenance",
  ],
  excluded: [
    "Passwords, OAuth tokens, API keys and owner sessions",
    "Original uploaded image files",
    "Publishing jobs, approvals, automation and integration settings",
    "Traffic, finances, indexing reports and diagnostic history",
  ],
  limitation:
    "This content archive is not a complete database backup. Import creates review drafts only; it does not restore live publishing state. Keep database dumps, original uploads and the encryption key separately using the documented backup procedure.",
};
const articleSelect = {
  id: true,
  title: true,
  slug: true,
  niche: true,
  intent: true,
  excerpt: true,
  html: true,
  labels: true,
  aiAssisted: true,
  disclosure: true,
  version: true,
  backlogPriority: true,
  planningNotes: true,
  status: true,
  publishedUrl: true,
  canonicalUrl: true,
  publishedAt: true,
  remotePostId: true,
  remoteBlogId: true,
  createdAt: true,
  updatedAt: true,
  sources: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      url: true,
      title: true,
      note: true,
      checkedAt: true,
      httpStatus: true,
    },
  },
  media: { orderBy: { mediaId: "asc" }, select: { mediaId: true } },
} satisfies Prisma.ArticleSelect;
const mediaSelect = {
  id: true,
  title: true,
  url: true,
  alt: true,
  creator: true,
  sourceUrl: true,
  profileUrl: true,
  provider: true,
  license: true,
  licenseUrl: true,
  attribution: true,
  rightsConfirmed: true,
  checkedAt: true,
  createdAt: true,
} satisfies Prisma.MediaAssetSelect;
@Injectable()
export class ContentArchiveService {
  constructor(private readonly db: PrismaService) {}
  async summary() {
    const [articles, sources, media] = await this.db.$transaction(
      [
        this.db.article.count(),
        this.db.source.count(),
        this.db.mediaAsset.count(),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      articles,
      sources,
      media,
      limits: archiveLimits,
      coverage,
      withinCountLimits:
        articles <= archiveLimits.articles && media <= archiveLimits.media,
    };
  }
  async export() {
    const snapshot = await this.db.$transaction(
      async (tx) => {
        const [articleCount, mediaCount] = await Promise.all([
          tx.article.count(),
          tx.mediaAsset.count(),
        ]);
        if (
          articleCount > archiveLimits.articles ||
          mediaCount > archiveLimits.media
        )
          throw new BadRequestException(
            "The workspace exceeds this content archive’s record limits. Use the database backup procedure for a complete copy; no partial archive was created.",
          );
        const [articles, media] = await Promise.all([
          tx.article.findMany({
            select: articleSelect,
            orderBy: { id: "asc" },
          }),
          tx.mediaAsset.findMany({
            select: mediaSelect,
            orderBy: { id: "asc" },
          }),
        ]);
        return { articles, media };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 10000,
        timeout: 20000,
      },
    );
    const exportedAt = new Date().toISOString();
    const archive = {
      format: "autoblog-studio-content",
      schemaVersion: 1,
      exportedAt,
      displayTimezone: "Asia/Colombo",
      timestamps:
        "ISO 8601 UTC; publication status is a saved reference, not a new live check.",
      coverage,
      counts: {
        articles: snapshot.articles.length,
        sources: snapshot.articles.reduce(
          (sum, a) => sum + a.sources.length,
          0,
        ),
        media: snapshot.media.length,
      },
      ...snapshot,
    };
    const json = JSON.stringify(archive, null, 2);
    if (Buffer.byteLength(json, "utf8") > archiveLimits.bytes)
      throw new BadRequestException(
        "The content archive exceeds 20 MiB. Use the database backup procedure; no partial archive was created.",
      );
    return {
      json,
      exportedAt,
      filename: `autoblog-content-${exportedAt.slice(0, 10)}.json`,
    };
  }
}
