import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../infrastructure/prisma.service";
import { ArticlesService } from "./articles.service";
import { CommonsPhotoService } from "./commons-photo.service";
import { articlePhotoTerms } from "../domain/photo-preparation";
import { commonsAutoEnabled } from "../domain/commons-photo";

@Injectable()
export class PhotoPreparationService {
  constructor(
    private readonly db: PrismaService,
    private readonly articles: ArticlesService,
    private readonly commons: CommonsPhotoService,
  ) {}
  async queue() {
    const articles = await this.db.article.findMany({
      where: {
        publishingTarget: "local",
        status: { in: ["PLANNED", "RESEARCHING", "NEEDS_REVIEW"] },
      },
      include: {
        media: { include: { media: true } },
        editorialRuns: {
          where: { state: { in: ["QUEUED", "PROCESSING"] } },
          select: { id: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 51,
    });
    const attempts = await this.db.auditLog.findMany({
      where: {
        entityId: { in: articles.map((a) => a.id) },
        action: "ARTICLE_PHOTO_PREPARATION_BLOCKED",
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return {
      automaticDiscovery: commonsAutoEnabled(),
      hasMore: articles.length > 50,
      articles: articles.slice(0, 50).map((a) => {
        let lastAttempt = null;
        for (const attempt of attempts.filter((row) => row.entityId === a.id)) {
          try {
            const parsed = JSON.parse(attempt.message);
            if (parsed.version === a.version) {
              lastAttempt = {
                code: parsed.code,
                message: parsed.message,
                at: attempt.createdAt,
              };
              break;
            }
          } catch {
            /* Ignore unrelated historical records. */
          }
        }
        return {
          id: a.id,
          title: a.title,
          version: a.version,
          searchTerms: articlePhotoTerms(a),
          state: a.media.length
            ? "ATTACHED"
            : a.editorialRuns.length
              ? "WORKFLOW_BUSY"
              : a.html.trim()
                ? "MISSING_IMAGE"
                : "NEEDS_TEXT",
          image: a.media[0]?.media
            ? {
                title: a.media[0].media.title,
                url: a.media[0].media.url,
                alt: a.media[0].media.alt,
                attribution: a.media[0].media.attribution,
                sourceUrl: a.media[0].media.sourceUrl,
              }
            : null,
          lastAttempt,
        };
      }),
    };
  }
  async prepare(id: string, version: number, keywords?: string[]) {
    const article = await this.articles.get(id);
    if (
      article.version !== version ||
      article.publishingTarget !== "local" ||
      !["PLANNED", "RESEARCHING", "NEEDS_REVIEW"].includes(article.status)
    )
      throw new ConflictException(
        "Refresh this editable draft before preparing its image. Approved and Blogger articles are unchanged.",
      );
    if (
      await this.db.editorialRun.count({
        where: { articleId: id, state: { in: ["QUEUED", "PROCESSING"] } },
      })
    )
      throw new ConflictException(
        "The scheduled workflow is already preparing this article. Wait for it to finish.",
      );
    if (article.media.length)
      return {
        state: "ALREADY_ATTACHED",
        message: "An image is already attached; it has not been replaced.",
      };
    if (!article.html.trim())
      throw new ConflictException(
        "Write and save the article before choosing an illustrative photograph.",
      );
    const terms = articlePhotoTerms(article, keywords);
    let selected;
    try {
      selected = await this.commons.select(article, terms);
    } catch {
      return this.blocked(
        id,
        version,
        terms,
        "PROVIDER_UNAVAILABLE",
        "Photo discovery is temporarily unavailable. Your draft is saved; retry later without regenerating text.",
      );
    }
    if (!selected)
      return this.blocked(
        id,
        version,
        terms,
        commonsAutoEnabled() ? "NO_MATCH" : "DISCOVERY_DISABLED",
        commonsAutoEnabled()
          ? "No relevant, unused photograph passed the checks. Try more specific photo keywords or review a photo in Media library."
          : "No eligible library photo matched. Automatic Commons discovery is disabled; review a library photo or enable COMMONS_AUTO_IMPORT privately.",
      );
    const saved = await this.articles.attachAutomaticPhoto(
      id,
      selected.photo.id,
      version,
    );
    return {
      state: "ATTACHED",
      source: selected.source,
      version: saved.version,
      mediaId: selected.photo.id,
      message:
        "Real-photo candidate and attribution attached. Preview it and rerun quality checks before approval.",
    };
  }
  private async blocked(
    id: string,
    version: number,
    searchTerms: string[],
    code: string,
    message: string,
  ) {
    await this.db.auditLog.create({
      data: {
        action: "ARTICLE_PHOTO_PREPARATION_BLOCKED",
        entityId: id,
        message: JSON.stringify({ version, code, message, searchTerms }),
      },
    });
    return { state: "BLOCKED", code, message, searchTerms };
  }
}
