import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../infrastructure/prisma.service";
import {
  parseContentArchive,
  ParsedContentArchive,
} from "../domain/archive-import";
@Injectable()
export class ContentImportService {
  constructor(private readonly db: PrismaService) {}
  private parse(buffer: Buffer) {
    try {
      return parseContentArchive(buffer);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }
  private async plan(
    parsed: ParsedContentArchive,
    tx: Pick<PrismaClient, "article" | "mediaAsset"> = this.db,
  ) {
    const [articles, media] = await Promise.all([
      tx.article.findMany({
        where: {
          OR: [
            { id: { in: parsed.articles.map((a) => a.sourceId) } },
            { slug: { in: parsed.articles.map((a) => a.slug) } },
          ],
        },
        select: { id: true, slug: true },
      }),
      tx.mediaAsset.findMany({
        where: { id: { in: parsed.media.flatMap((m) => [m.sourceId, m.id]) } },
        select: { id: true },
      }),
    ]);
    const existingArticles = new Set(articles.flatMap((a) => [a.id, a.slug])),
      existingMedia = new Set(media.map((m) => m.id));
    return {
      fingerprint: parsed.fingerprint,
      articles: parsed.articles.map((a) => ({
        sourceId: a.sourceId,
        title: a.data.title,
        action:
          existingArticles.has(a.sourceId) || existingArticles.has(a.slug)
            ? "skip"
            : "create",
        htmlAdjusted: a.htmlAdjusted,
      })),
      media: parsed.media.map((m) => {
        const targetId = existingMedia.has(m.sourceId) ? m.sourceId : m.id;
        const action = existingMedia.has(targetId) ? "skip" : "create";
        existingMedia.add(targetId);
        return { sourceId: m.sourceId, title: m.data.title, action, targetId };
      }),
      notice:
        "New articles become NEEDS_REVIEW drafts. Publication IDs, approvals, jobs and source checks are not restored. Media credits are retained as unreviewed references; originals must be re-added. Inline images and unsafe HTML are removed. Existing records are never overwritten.",
    };
  }
  preview(buffer: Buffer) {
    return this.plan(this.parse(buffer));
  }
  async import(buffer: Buffer, fingerprint: string) {
    const parsed = this.parse(buffer);
    if (parsed.fingerprint !== fingerprint)
      throw new BadRequestException(
        "The file changed after preview. Preview it again before importing.",
      );
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172204)`;
        const plan = await this.plan(
          parsed,
          tx as unknown as Pick<PrismaClient, "article" | "mediaAsset">,
        );
        const mediaMap = new Map(
          plan.media.map((m) => [m.sourceId, m.targetId]),
        );
        let createdMedia = 0,
          createdArticles = 0;
        for (const m of parsed.media) {
          if (
            plan.media.find((x) => x.sourceId === m.sourceId)!.action === "skip"
          )
            continue;
          // An archived URL is evidence only, never a new verified image or local upload path.
          await tx.mediaAsset.upsert({
            where: { id: m.id },
            create: {
              id: m.id,
              ...m.data,
              url: "",
              provider: "ARCHIVE",
              rightsConfirmed: false,
              checkedAt: new Date(0),
              metadata: { archiveReference: m.reference },
            },
            update: {},
          });
          createdMedia++;
        }
        for (const a of parsed.articles) {
          if (
            plan.articles.find((x) => x.sourceId === a.sourceId)!.action ===
            "skip"
          )
            continue;
          await tx.article.create({
            data: {
              ...a.data,
              slug: a.slug,
              status: "NEEDS_REVIEW",
              approvedAt: null,
              generation: { archiveSourceId: a.sourceId },
              sources: {
                create: a.sources.map((s) => ({
                  ...s,
                  checkedAt: null,
                  httpStatus: null,
                })),
              },
              media: {
                create: a.media.map((id) => ({ mediaId: mediaMap.get(id)! })),
              },
            },
          });
          createdArticles++;
        }
        if (createdArticles || createdMedia)
          await tx.auditLog.create({
            data: {
              action: "CONTENT_ARCHIVE_IMPORTED",
              message: `Created ${createdArticles} review drafts and ${createdMedia} unreviewed media references. No publication performed.`,
            },
          });
        return {
          createdArticles,
          createdMedia,
          skippedArticles: parsed.articles.length - createdArticles,
          skippedMedia: parsed.media.length - createdMedia,
        };
      },
      { maxWait: 10000, timeout: 60000 },
    );
  }
}
