import { BadRequestException, Injectable } from "@nestjs/common";
import { DateTime } from "luxon";
import sanitizeHtml from "sanitize-html";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../infrastructure/prisma.service";
import { AiProvider } from "../infrastructure/ai.provider";
import { ArticlesService } from "./articles.service";
import { publicGet } from "../infrastructure/public-http";
import { safeHtml } from "../domain/quality";
import { GenerateDto } from "../api/dtos";
@Injectable()
export class AiService {
  constructor(
    private readonly db: PrismaService,
    private readonly articles: ArticlesService,
    private readonly provider: AiProvider,
  ) {}
  async generate(dto: GenerateDto) {
    if (
      process.env.AI_ENABLED !== "true" ||
      process.env.AI_BILLING_AUTHORIZED !== "true" ||
      !process.env.AI_API_KEY
    )
      throw new BadRequestException(
        "Paid AI is disabled. Configure credentials, pricing and explicit billing authorization locally first.",
      );
    const inputRate = Number(process.env.AI_INPUT_USD_PER_MILLION),
      outputRate = Number(process.env.AI_OUTPUT_USD_PER_MILLION),
      limit = Number(process.env.AI_MONTHLY_LIMIT_USD || 3),
      dailyLimit = Number(process.env.AI_DAILY_GENERATION_LIMIT || 2),
      maxTokens = Number(process.env.AI_MAX_OUTPUT_TOKENS || 2400),
      model = process.env.AI_MODEL || "gpt-4.1-mini";
    if (
      ![inputRate, outputRate, limit, dailyLimit, maxTokens].every(
        (v) => Number.isFinite(v) && v > 0,
      ) ||
      maxTokens > 10000
    )
      throw new BadRequestException(
        "Set valid provider pricing, spending limits and output token limit (max 10,000).",
      );
    const existing = await this.db.article.findMany({
      select: { title: true, publishedUrl: true },
      take: 100,
      orderBy: { updatedAt: "desc" },
    });
    let a = dto.articleId ? await this.articles.get(dto.articleId) : null;
    if (dto.task === "draft" && !a)
      throw new BadRequestException(
        "Select an article with reviewed primary sources first.",
      );
    if (
      a &&
      ["SCHEDULED", "PUBLISHING", "PUBLISHED", "APPROVED"].includes(a.status)
    )
      throw new BadRequestException(
        "Only editable draft articles can be generated.",
      );
    const research: { url: string; supports: string; text: string }[] = [];
    if (a) {
      if (!a.sources.length || a.sources.some((s) => !s.note))
        throw new BadRequestException(
          "Add sources and record the claims each supports.",
        );
      for (const source of a.sources.slice(0, 4)) {
        const r = await publicGet(source.url);
        if (r.status !== 200)
          throw new BadRequestException(
            `Research source unavailable: ${source.url}`,
          );
        research.push({
          url: source.url,
          supports: source.note,
          text: sanitizeHtml(r.body, { allowedTags: [], allowedAttributes: {} })
            .replace(/\s+/g, " ")
            .slice(0, 3500),
        });
      }
    }
    const prompt = JSON.stringify({
      task: dto.task,
      niche: dto.niche,
      title: a?.title,
      intent: a?.intent,
      existingTopics: existing,
      instructions:
        dto.task === "topics"
          ? "Propose five specific nonduplicative tutorials. Do not claim verified search demand; leave draft fields empty."
          : "Create a research-based original draft with cited supplied URLs, structured outline, excerpt, labels, internal links to relevant supplied published URLs, image terms and explicit uncertainty list. Require human code verification. Avoid unsupported first-person statements.",
      research,
    });
    if (Buffer.byteLength(prompt) > 32000)
      throw new BadRequestException(
        "Research context is too large. Reduce the source notes.",
      );
    const reserve =
      ((Buffer.byteLength(prompt) + 4096) * inputRate) / 1e6 +
      (maxTokens * outputRate) / 1e6;
    const now = DateTime.now().setZone("Asia/Colombo");
    const usage = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172143)`;
      const monthly = await tx.aiUsage.findMany({
        where: { createdAt: { gte: now.startOf("month").toJSDate() } },
      });
      const spend = monthly.reduce(
        (n, u) => n + Number(u.costUsd ?? u.reservedUsd),
        0,
      );
      if (spend + reserve > limit)
        throw new BadRequestException(
          "Monthly AI spending limit would be exceeded.",
        );
      if (
        monthly.filter((u) => u.createdAt >= now.startOf("day").toJSDate())
          .length >= dailyLimit
      )
        throw new BadRequestException("Daily AI generation limit reached.");
      return tx.aiUsage.create({ data: { model, reservedUsd: reserve } });
    });
    try {
      const result = await this.provider.generate(prompt, maxTokens, model);
      const cost =
        (result.inputTokens * inputRate + result.outputTokens * outputRate) /
        1e6;
      await this.db.aiUsage.update({
        where: { id: usage.id },
        data: {
          state: "COMPLETED",
          costUsd: cost,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        },
      });
      const data = result.data;
      if (a) {
        if (
          typeof data.html !== "string" ||
          typeof data.excerpt !== "string" ||
          !Array.isArray(data.labels) ||
          data.labels.some((l) => typeof l !== "string")
        )
          throw new Error("AI returned invalid draft fields.");
        const changed = await this.db.article.updateMany({
          where: { id: a.id, version: a.version, status: a.status },
          data: {
            html: safeHtml(data.html),
            excerpt: data.excerpt.slice(0, 500),
            labels: (data.labels as string[]).slice(0, 12),
            aiAssisted: true,
            disclosure: true,
            status: "NEEDS_REVIEW",
            approvedAt: null,
            version: { increment: 1 },
            generation: data as Prisma.InputJsonValue,
          },
        });
        if (!changed.count)
          throw new BadRequestException(
            "Article changed during generation; result was not applied. Usage is recorded.",
          );
        await this.db.auditLog.create({
          data: {
            action: "AI_DRAFT_CREATED",
            entityId: a.id,
            message:
              "Human review required; source accuracy and code remain unverified.",
          },
        });
        return { articleId: a.id, data, costUsd: cost };
      }
      return { data, costUsd: cost };
    } catch (e) {
      const current = await this.db.aiUsage.findUniqueOrThrow({
        where: { id: usage.id },
      });
      if (current.state === "RESERVED")
        await this.db.aiUsage.update({
          where: { id: usage.id },
          data: {
            state: "UNKNOWN",
            costUsd: reserve,
            error:
              "Provider request failed or result was incomplete. Reserved maximum retained conservatively until reconciliation.",
          },
        });
      throw new BadRequestException(
        e instanceof Error ? e.message : "AI generation failed.",
      );
    }
  }
}
