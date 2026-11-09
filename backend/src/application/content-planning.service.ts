import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../infrastructure/prisma.service";
import { PlanningDto } from "../api/dtos";
import { suggestInternalLinks } from "../domain/internal-links";
const statuses = [
  "PLANNED",
  "RESEARCHING",
  "DRAFTING",
  "NEEDS_REVIEW",
  "APPROVED",
] as const;
@Injectable()
export class ContentPlanningService {
  constructor(private readonly db: PrismaService) {}
  async backlog() {
    const articles = await this.db.article.findMany({
      where: { publishingTarget: "local", status: { in: [...statuses] } },
      orderBy: [
        { backlogPriority: "desc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      select: {
        id: true,
        title: true,
        niche: true,
        intent: true,
        status: true,
        backlogPriority: true,
        planningNotes: true,
        planningVersion: true,
        html: true,
        labels: true,
        approvedAt: true,
        sources: { select: { checkedAt: true, httpStatus: true, note: true } },
        reports: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { passed: true, version: true },
        },
        version: true,
      },
    });
    return {
      articles: articles.map(({ html, sources, reports, version, ...a }) => ({
        ...a,
        hasDraft: !!html.trim(),
        sourceCount: sources.length,
        checkedSourceCount: sources.filter(
          (s) => s.checkedAt && s.httpStatus === 200 && s.note.trim(),
        ).length,
        qualityPassed:
          reports[0]?.passed === true && reports[0].version === version,
      })),
    };
  }
  async update(id: string, dto: PlanningDto) {
    return this.db.$transaction(async (tx) => {
      const updated = await tx.article.updateMany({
        where: {
          id,
          publishingTarget: "local",
          status: { in: [...statuses] },
          planningVersion: dto.planningVersion,
        },
        data: {
          backlogPriority: dto.backlogPriority,
          planningNotes: dto.planningNotes,
          planningVersion: { increment: 1 },
        },
      });
      if (!updated.count)
        throw new ConflictException(
          "The plan changed or this article is no longer in the backlog. Refresh before saving.",
        );
      await tx.auditLog.create({
        data: {
          action: "ARTICLE_PLAN_UPDATED",
          entityId: id,
          message:
            "Private planning notes and priority updated; editorial approval unchanged.",
        },
      });
      return { ok: true };
    });
  }
  async links(id: string) {
    const source = await this.db.article.findUnique({ where: { id } });
    if (!source) throw new NotFoundException("Article not found.");
    const connection = await this.db.integration.findUnique({
      where: { provider: "google" },
      select: { blogUrl: true },
    });
    const blogUrl = connection?.blogUrl;
    let configured = false;
    try {
      configured = !!blogUrl && new URL(blogUrl).protocol === "https:";
    } catch {
      /* incomplete connection */
    }
    if (!configured)
      return {
        articleVersion: source.version,
        suggestions: [],
        reason:
          "Select your owned blog in Blog connections to suggest published internal links.",
      };
    const candidates = await this.db.article.findMany({
      where: {
        status: "PUBLISHED",
        publishedUrl: { not: null },
        id: { not: id },
      },
      select: {
        id: true,
        title: true,
        niche: true,
        intent: true,
        labels: true,
        publishedUrl: true,
        html: true,
      },
    });
    return {
      articleVersion: source.version,
      suggestions: suggestInternalLinks(source, candidates, blogUrl!),
      reason:
        "Matches use saved titles, reader intent and labels. Review relevance; only confirmed published Studio posts on your selected blog are considered.",
    };
  }
}
