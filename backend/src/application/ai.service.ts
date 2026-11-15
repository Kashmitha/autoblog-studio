import { BadRequestException, Injectable } from "@nestjs/common";
import { DateTime } from "luxon";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../infrastructure/prisma.service";
import { AiProvider } from "../infrastructure/ai.provider";
import { ArticlesService } from "./articles.service";
import { publicGet } from "../infrastructure/public-http";
import { safeHtml } from "../domain/quality";
import { GenerateDto } from "../api/dtos";
import { referenceExcerpt } from "../domain/research";
import { aiConfiguration } from "../domain/ai-config";
@Injectable()
export class AiService {
  constructor(
    private readonly db: PrismaService,
    private readonly articles: ArticlesService,
    private readonly provider: AiProvider,
  ) {}
  async testConnection() {
    const config = aiConfiguration();
    if (!config.configured)
      throw new BadRequestException(
        "Configure the selected provider's API key privately, then recreate backend and worker.",
      );
    if (!["openai", "groq"].includes(config.provider))
      throw new BadRequestException("Choose a supported text provider first.");
    const url =
      config.provider === "groq"
        ? "https://api.groq.com/openai/v1/models"
        : "https://api.openai.com/v1/models";
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.provider === "groq" ? process.env.GROQ_API_KEY : process.env.AI_API_KEY}`,
        },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new BadRequestException(
        "Provider connection test could not complete. Check network and provider status.",
      );
    }
    if (!response.ok)
      throw new BadRequestException(
        `Provider connection test returned HTTP ${response.status}. Check the private key, permissions and quota.`,
      );
    const result = (await response.json()) as { data?: { id: string }[] };
    if (
      !Array.isArray(result.data) ||
      !result.data.some((m) => m.id === config.model)
    )
      throw new BadRequestException(
        "Provider access succeeded, but the selected model is unavailable. Check its exact ID and permissions.",
      );
    return {
      provider: config.provider,
      model: config.model,
      connected: true,
      generationReady: config.ready,
      blockers: config.blockers,
      message:
        "API key and selected model are accessible. No text was generated. This does not verify billing plan, completion quota or Blogger access.",
    };
  }
  async generate(dto: GenerateDto, expectedVersion?: number) {
    const config = aiConfiguration();
    if (!config.ready) throw new BadRequestException(config.blockers.join(" "));
    const {
      inputRate,
      outputRate,
      monthlyLimit: limit,
      dailyLimit,
      maxTokens,
      model,
    } = config;
    const existing = await this.db.article.findMany({
      select: { title: true, publishedUrl: true },
      take: 100,
      orderBy: { updatedAt: "desc" },
    });
    let a = dto.articleId ? await this.articles.get(dto.articleId) : null;
    if (a && expectedVersion !== undefined && a.version !== expectedVersion)
      throw new BadRequestException(
        "Article changed before generation. No provider request was sent.",
      );
    if (dto.task === "draft" && !a)
      throw new BadRequestException(
        "Select an article with reviewed primary sources first.",
      );
    if (
      a &&
      (a.publishingTarget === "blogger" ||
        ["SCHEDULED", "PUBLISHING", "PUBLISHED", "APPROVED"].includes(a.status))
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
          text: referenceExcerpt(r.body),
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
          : "Create an original, useful draft for this specific reader problem. Suggest a concise, concrete title faithful to the brief; vary title structure according to the problem rather than forcing lists or sensational promises. Cite the supplied source URLs, include a structured outline, excerpt, labels, relevant existing internal links, real-photo search terms and an explicit uncertainty list. Lead with the actual answer, explain prerequisites and limitations, and use supported examples. Do not fabricate experience, test results, output, benchmark figures or facts. Identify unverified code or claims in uncertainties. Never include image tags, synthetic-image requests, provider instructions or public AI-provenance footers in HTML. Avoid filler, repeated conclusions, stock introductions and unsupported first-person statements.",
      research,
      draftLength:
        dto.task === "draft"
          ? "Aim for 450–900 useful words with specific supported steps, caveats and examples. Do not pad a short answer; flag insufficient reference support in uncertainties."
          : undefined,
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
      return tx.aiUsage.create({
        data: { model: config.usageModel, reservedUsd: reserve },
      });
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
          where: {
            id: a.id,
            version: a.version,
            status: a.status,
            publishingTarget: "local",
          },
          data: {
            html: safeHtml(data.html),
            excerpt: data.excerpt.slice(0, 500),
            labels: (data.labels as string[]).slice(0, 12),
            aiAssisted: true,
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
