import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ArticleStatus, Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../infrastructure/prisma.service";
import { ArticleDto, SourceDto } from "../api/dtos";
import { safeHtml, checkQuality } from "../domain/quality";
import { assertTransition } from "../domain/workflow";
import { publicGet } from "../infrastructure/public-http";
export const articleInclude = {
  sources: true,
  media: { include: { media: true } },
  reports: { orderBy: { createdAt: "desc" as const }, take: 1 },
  events: { orderBy: { createdAt: "desc" as const }, take: 30 },
  jobs: { orderBy: { createdAt: "desc" as const } },
};
@Injectable()
export class ArticlesService {
  constructor(readonly db: PrismaService) {}
  list() {
    return this.db.article.findMany({
      orderBy: { updatedAt: "desc" },
      include: { reports: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
  }
  async get(id: string) {
    const a = await this.db.article.findUnique({
      where: { id },
      include: articleInclude,
    });
    if (!a) throw new NotFoundException("Article not found.");
    return a;
  }
  async create(dto: ArticleDto) {
    const { version, ...data } = dto;
    return this.db.$transaction(async (tx) => {
      const a = await tx.article.create({
        data: {
          ...data,
          disclosure: dto.disclosure ?? false,
          html: safeHtml(dto.html || ""),
          slug:
            dto.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .slice(0, 100) +
            "-" +
            randomBytes(3).toString("hex"),
          status: dto.html ? "NEEDS_REVIEW" : "PLANNED",
        },
      });
      await tx.auditLog.create({
        data: { action: "ARTICLE_CREATED", entityId: a.id, message: a.title },
      });
      return a;
    });
  }
  async update(id: string, dto: ArticleDto) {
    const a = await this.get(id);
    if (["SCHEDULED", "PUBLISHING", "PUBLISHED"].includes(a.status))
      throw new ConflictException(
        "Unschedule before editing. Published articles are immutable in V1; create a revision.",
      );
    if (dto.version !== a.version)
      throw new ConflictException(
        "Article changed in another session. Refresh before saving.",
      );
    const { version, ...data } = dto;
    return this.db.$transaction(async (tx) => {
      const updated = await tx.article.updateMany({
        where: { id, version: a.version, status: a.status },
        data: {
          ...data,
          aiAssisted: a.aiAssisted || dto.aiAssisted === true,
          disclosure: dto.disclosure ?? a.disclosure,
          html: safeHtml(dto.html ?? a.html),
          version: { increment: 1 },
          status: "NEEDS_REVIEW",
          approvedAt: null,
        },
      });
      if (!updated.count)
        throw new ConflictException("Concurrent edit detected.");
      await tx.auditLog.create({
        data: {
          action: "ARTICLE_EDITED",
          entityId: id,
          message: "Approval and quality validation invalidated by edit.",
        },
      });
      return tx.article.findUniqueOrThrow({ where: { id } });
    });
  }
  async addSource(id: string, dto: SourceDto) {
    return this.mutateMaterials(id, async (tx) => {
      if (
        (await tx.source.count({ where: { articleId: id } })) >= 12 &&
        !(await tx.source.findUnique({
          where: { articleId_url: { articleId: id, url: dto.url } },
        }))
      )
        throw new BadRequestException(
          "Use at most 12 focused primary sources per article.",
        );
      return tx.source.upsert({
        where: { articleId_url: { articleId: id, url: dto.url } },
        create: { articleId: id, ...dto },
        update: {
          title: dto.title,
          note: dto.note,
          checkedAt: null,
          httpStatus: null,
        },
      });
    });
  }
  private async mutateMaterials<T>(
    id: string,
    mutate: (tx: Prisma.TransactionClient) => Promise<T>,
    expectedVersion?: number,
  ): Promise<T> {
    return this.db.$transaction(async (tx) => {
      const a = await tx.article.findUniqueOrThrow({ where: { id } });
      if (["SCHEDULED", "PUBLISHING", "PUBLISHED"].includes(a.status))
        throw new ConflictException(
          "Unschedule before changing article materials.",
        );
      if (expectedVersion !== undefined && a.version !== expectedVersion)
        throw new ConflictException(
          "Article changed while source verification was running. Retry on the current version.",
        );
      const changed = await tx.article.updateMany({
        where: { id, version: a.version, status: a.status },
        data: {
          version: { increment: 1 },
          approvedAt: null,
          status: "NEEDS_REVIEW",
        },
      });
      if (!changed.count)
        throw new ConflictException(
          "Article changed while updating materials.",
        );
      return mutate(tx);
    });
  }
  async verifySources(id: string) {
    const a = await this.get(id);
    const checked: { id: string; httpStatus: number }[] = [];
    for (const s of a.sources) {
      try {
        const r = await publicGet(s.url);
        checked.push({ id: s.id, httpStatus: r.status });
      } catch {
        checked.push({ id: s.id, httpStatus: 0 });
      }
    }
    await this.mutateMaterials(
      id,
      async (tx) => {
        for (const s of checked)
          await tx.source.update({
            where: { id: s.id },
            data: { checkedAt: new Date(), httpStatus: s.httpStatus },
          });
      },
      a.version,
    );
    return this.quality(id);
  }
  async quality(id: string) {
    const a = await this.get(id);
    const others = await this.db.article.findMany({
      where: { id: { not: id } },
      select: { id: true, title: true, html: true },
    });
    const report = checkQuality(a, others, {
      minWords: Math.max(80, Number(process.env.QUALITY_MIN_WORDS) || 180),
      sourceMaxAgeDays: Math.max(
        1,
        Number(process.env.QUALITY_SOURCE_MAX_AGE_DAYS) || 30,
      ),
    });
    return this.db.qualityReport.create({
      data: {
        articleId: id,
        version: a.version,
        ...report,
        issues: report.issues as unknown as Prisma.InputJsonValue,
      },
    });
  }
  async transition(id: string, to: ArticleStatus, reason: string) {
    const a = await this.get(id);
    try {
      assertTransition(a.status, to);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (to === "APPROVED") {
      const report = await this.quality(id);
      if (!report.passed)
        throw new BadRequestException(
          "Resolve the blocking quality issues before approval.",
        );
    }
    return this.db.$transaction(async (tx) => {
      const changed = await tx.article.updateMany({
        where: { id, version: a.version, status: a.status },
        data: { status: to, approvedAt: to === "APPROVED" ? new Date() : null },
      });
      if (!changed.count)
        throw new ConflictException("Article changed during review.");
      await tx.articleEvent.create({
        data: { articleId: id, from: a.status, to, reason },
      });
      await tx.auditLog.create({
        data: { action: "ARTICLE_" + to, entityId: id, message: reason },
      });
      return tx.article.findUniqueOrThrow({ where: { id } });
    });
  }
  async removeSource(id: string, sourceId: string) {
    await this.mutateMaterials(id, (tx) =>
      tx.source.deleteMany({ where: { id: sourceId, articleId: id } }),
    );
    return { ok: true };
  }
  async attach(id: string, mediaId: string) {
    await this.mutateMaterials(id, (tx) =>
      tx.articleMedia.upsert({
        where: { articleId_mediaId: { articleId: id, mediaId } },
        create: { articleId: id, mediaId },
        update: {},
      }),
    );
    return this.get(id);
  }
  async detach(id: string, mediaId: string) {
    await this.mutateMaterials(id, (tx) =>
      tx.articleMedia.deleteMany({
        where: { articleId: id, mediaId },
      }),
    );
    return this.get(id);
  }
}
