import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { DateTime } from "luxon";
import { Prisma, type EditorialRun } from "@prisma/client";
import { PrismaService } from "../infrastructure/prisma.service";
import { ArticlesService } from "./articles.service";
import { AiService } from "./ai.service";
import { MediaService } from "./media.service";
import { CloudPublishingService } from "./cloud-publishing.service";
import {
  acceptableTitle,
  choosePhoto,
  editorialSlots,
  photoPolicy,
  starterBriefs,
  EDITORIAL_ENABLE,
  EDITORIAL_PUBLISH,
  PHOTO_CONFIRMATION,
} from "../domain/editorial";
import { safeHtml } from "../domain/quality";
import { normalizeTopic } from "../domain/workflow";
import sanitizeHtml from "sanitize-html";

export type EditorialInput = {
  enabled: boolean;
  autoPublish: boolean;
  autoPlan?: boolean;
  times: string[];
  revision: number;
  confirmation: string;
};
@Injectable()
export class EditorialService {
  private ticking = false;
  constructor(
    private readonly db: PrismaService,
    private readonly articles: ArticlesService,
    private readonly ai: AiService,
    private readonly media: MediaService,
    private readonly cloud: CloudPublishingService,
  ) {}

  private async context() {
    const [saved, automation, google, heartbeat, photos, briefs] =
      await Promise.all([
        this.db.editorialSettings.findUnique({ where: { id: "owner" } }),
        this.db.automationSettings.findUnique({ where: { id: "owner" } }),
        this.db.integration.findUnique({
          where: { provider: "google" },
          select: {
            blogId: true,
            blogUrl: true,
            firstLiveTestAuthorizedAt: true,
            liveTestSucceededAt: true,
          },
        }),
        this.db.workerHeartbeat.findFirst({
          orderBy: { lastSeen: "desc" },
          select: { lastSeen: true },
        }),
        this.db.mediaAsset.findMany({
          where: {
            rightsConfirmed: true,
            provider: { in: ["WIKIMEDIA", "ORIGINAL"] },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        }),
        this.db.article.findMany({
          where: {
            html: "",
            status: { in: ["PLANNED", "RESEARCHING", "NEEDS_REVIEW"] },
            editorialRuns: { none: {} },
          },
          include: { sources: true },
          orderBy: [{ backlogPriority: "desc" }, { createdAt: "asc" }],
          take: 100,
        }),
      ]);
    const settings = saved || {
      id: "owner",
      enabled: false,
      autoPublish: false,
      autoPlan: false,
      blogId: null,
      times: ["09:00", "17:00"],
      revision: 0,
      authorizedAt: null,
    };
    const readyBriefs = briefs.filter(
      (a) =>
        a.sources.length >= 2 &&
        a.sources.every((source) => !!source.note.trim()),
    );
    const paidReady =
      process.env.AI_ENABLED === "true" &&
      process.env.AI_BILLING_AUTHORIZED === "true" &&
      !!process.env.AI_API_KEY &&
      [
        "AI_INPUT_USD_PER_MILLION",
        "AI_OUTPUT_USD_PER_MILLION",
        "AI_MONTHLY_LIMIT_USD",
      ].every((name) => Number(process.env[name]) > 0);
    const blockers: string[] = [];
    if (!paidReady)
      blockers.push(
        "Configure the text provider, current token prices and explicit API billing authorization in private .env.",
      );
    if (Number(process.env.AI_DAILY_GENERATION_LIMIT || 2) < 2)
      blockers.push(
        "Text-generation daily limit must allow two drafts; the monthly spending cap still applies.",
      );
    if (!heartbeat || Date.now() - heartbeat.lastSeen.getTime() > 120000)
      blockers.push(
        "Start the worker on a computer or host that stays running.",
      );
    if (!automation || automation.paused)
      blockers.push(
        "Local automation is paused. Resume it only when you want paid generation to run.",
      );
    if (automation?.emergencyStop) blockers.push("Emergency stop is enabled.");
    if (!readyBriefs.length && !settings.autoPlan)
      blockers.push(
        "Add source-backed empty topic briefs; at least two reference URLs and support notes are required per brief.",
      );
    return {
      settings,
      automation,
      google,
      paidReady,
      blockers,
      readyBriefs,
      photos,
      heartbeat,
    };
  }
  async status() {
    const c = await this.context();
    const runs = await this.db.editorialRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        article: {
          select: { id: true, title: true, status: true, publishedUrl: true },
        },
      },
    });
    const eligiblePhotos = c.photos.filter((photo) => photoPolicy(photo));
    const publishingBlockers = [...c.blockers];
    if (
      process.env.BLOGGER_MODE !== "live" ||
      !c.google?.blogId ||
      !c.google.liveTestSucceededAt ||
      !c.google.firstLiveTestAuthorizedAt
    )
      publishingBlockers.push(
        "Complete the selected blog's live publishing checkpoint.",
      );
    if (!eligiblePhotos.length)
      publishingBlockers.push(
        "Review real photographs and license rights, then add keywords to the automatic photo pool. Unsplash stays manual.",
      );
    if ((c.automation?.dailyLimit || 0) < 2)
      publishingBlockers.push(
        "Set the publishing daily limit to at least two; the pipeline itself never exceeds two slots per day.",
      );
    return {
      settings: c.settings,
      blogUrl: c.google?.blogUrl || null,
      paidReady: c.paidReady,
      monthlyLimitUsd:
        Number(process.env.AI_MONTHLY_LIMIT_USD) > 0
          ? Number(process.env.AI_MONTHLY_LIMIT_USD)
          : null,
      draftBlockers: c.blockers,
      publishingBlockers,
      readyBriefs: c.readyBriefs.map((a) => ({
        id: a.id,
        title: a.title,
        sources: a.sources.length,
      })),
      pool: c.photos.map((photo) => ({
        id: photo.id,
        title: photo.title,
        url: photo.url,
        alt: photo.alt,
        sourceUrl: photo.sourceUrl,
        provider: photo.provider,
        license: photo.license,
        metadata: {
          editorialPhoto:
            (photo.metadata as { editorialPhoto?: Prisma.JsonValue } | null)
              ?.editorialPhoto || null,
        },
        eligible: photoPolicy(photo),
      })),
      runs,
      nextSlots: editorialSlots(c.settings.times, new Date(), true).slice(0, 2),
      workerLastSeen: c.heartbeat?.lastSeen || null,
    };
  }
  async save(input: EditorialInput) {
    if (input.times.length !== 2 || new Set(input.times).size !== 2)
      throw new BadRequestException(
        "Choose two different daily times in Asia/Colombo.",
      );
    const c = await this.context();
    if (input.enabled) {
      if (
        input.confirmation !==
        (input.autoPublish ? EDITORIAL_PUBLISH : EDITORIAL_ENABLE)
      )
        throw new BadRequestException(
          "Type the displayed authorization phrase to enable this workflow.",
        );
      const status = await this.status();
      const blockers = (
        input.autoPublish ? status.publishingBlockers : status.draftBlockers
      ).filter(
        (message) =>
          !(input.autoPlan && message.startsWith("Add source-backed")),
      );
      if (blockers.length) throw new BadRequestException(blockers.join(" "));
    }
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172260)`;
      const current = await tx.editorialSettings.findUnique({
        where: { id: "owner" },
      });
      if ((current?.revision || 0) !== input.revision)
        throw new ConflictException(
          "Editorial settings changed. Refresh before saving.",
        );
      const values = {
        enabled: input.enabled,
        autoPublish: input.autoPublish,
        autoPlan: input.autoPlan ?? current?.autoPlan ?? false,
        times: input.times.slice().sort(),
        blogId: c.google?.blogId || null,
        authorizedAt: input.enabled
          ? new Date()
          : current?.authorizedAt || null,
      };
      const saved = current
        ? await tx.editorialSettings.update({
            where: { id: "owner" },
            data: { ...values, revision: { increment: 1 } },
          })
        : await tx.editorialSettings.create({
            data: { id: "owner", ...values },
          });
      await tx.auditLog.create({
        data: {
          action: "EDITORIAL_POLICY_SAVED",
          message: `Owner ${input.enabled ? "enabled" : "disabled"} ${input.autoPublish ? "automatic-policy publishing" : "review-only drafting"}; maximum two daily slots; revision ${saved.revision}.`,
        },
      });
      return saved;
    });
  }
  async starters() {
    let created = 0;
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172260)`;
      const saved = await tx.article.findMany({
        select: { title: true, slug: true },
      });
      const existing = new Set(saved.map((a) => normalizeTopic(a.title)));
      const slugs = new Set(saved.map((a) => a.slug));
      for (const [title, first, second, intent] of starterBriefs) {
        const slug = `editorial-brief-${normalizeTopic(title).replaceAll(" ", "-").slice(0, 70)}`;
        if (existing.has(normalizeTopic(title)) || slugs.has(slug)) continue;
        await tx.article.create({
          data: {
            title,
            slug,
            niche: "Git & GitHub",
            intent,
            status: "PLANNED",
            planningNotes:
              "Starter reference brief. Source scope is not a claim that code or factual support was manually verified. Review sources before unattended use.",
            sources: {
              create: [first, second].map((doc) => ({
                url: `https://git-scm.com/docs/${doc}`,
                title: `Official ${doc} reference`,
                note: `Reference scope: ${intent} This source note is a brief, not a statement of completed human fact checking.`,
              })),
            },
          },
        });
        existing.add(normalizeTopic(title));
        slugs.add(slug);
        created++;
      }
    });
    return { created };
  }
  async photo(
    id: string,
    enabled: boolean,
    tags: string[],
    confirmation: string,
  ) {
    tags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
    const photo = await this.db.mediaAsset.findUniqueOrThrow({ where: { id } });
    if (
      enabled &&
      (confirmation !== PHOTO_CONFIRMATION ||
        !photo.rightsConfirmed ||
        !["WIKIMEDIA", "ORIGINAL"].includes(photo.provider) ||
        ![
          "CC0",
          "Public domain",
          "CC BY 4.0",
          "CC BY-SA 4.0",
          "Original work",
        ].includes(photo.license) ||
        !photo.alt ||
        !photo.url.startsWith("https://") ||
        !tags.length)
    )
      throw new BadRequestException(
        "Confirm a real photograph, commercial reuse rights, public HTTPS delivery and relevant keywords. Unsplash images cannot enter unattended selection.",
      );
    const metadata =
      photo.metadata &&
      typeof photo.metadata === "object" &&
      !Array.isArray(photo.metadata)
        ? (photo.metadata as Prisma.JsonObject)
        : {};
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172142)`;
      await tx.mediaAsset.update({
        where: { id },
        data: {
          metadata: {
            ...metadata,
            editorialPhoto: {
              enabled,
              tags,
              confirmedAt: new Date().toISOString(),
              confirmedBy: "owner",
            },
          },
        },
      });
    });
    return { ok: true };
  }
  async queue(manual = true) {
    const c = await this.context();
    if (!c.settings.enabled)
      throw new BadRequestException("Enable the editorial workflow first.");
    if (c.blockers.length) throw new BadRequestException(c.blockers.join(" "));
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172260)`;
      const start = DateTime.now().setZone("Asia/Colombo").startOf("day");
      if (
        (await tx.editorialRun.count({
          where: {
            createdAt: {
              gte: start.toJSDate(),
              lt: start.plus({ days: 1 }).toJSDate(),
            },
          },
        })) >= 2
      )
        return {
          queued: false,
          note: "Two editorial slots have already been attempted today. No automatic regeneration retry is allowed.",
        };
      for (const slot of editorialSlots(c.settings.times, new Date(), manual)) {
        if (await tx.editorialRun.findUnique({ where: { slotKey: slot.key } }))
          continue;
        const run = await tx.editorialRun.create({
          data: {
            slotKey: slot.key,
            slotAt: slot.at,
            policyRevision: c.settings.revision,
            blogId: c.settings.blogId,
          },
        });
        return { queued: true, run };
      }
      return {
        queued: false,
        note: "No unreserved slot is currently available. Missed slots are not backfilled in a burst.",
      };
    });
  }
  async resume(id: string) {
    const run = await this.db.editorialRun.findUniqueOrThrow({ where: { id } });
    const c = await this.context();
    if (
      !c.settings.enabled ||
      c.settings.revision !== run.policyRevision ||
      c.blockers.some((message) => !message.startsWith("Add source-backed"))
    )
      throw new ConflictException(
        "Restore the original enabled policy and clear its blockers before resuming this saved draft.",
      );
    const changed = await this.db.editorialRun.updateMany({
      where: { id, state: "BLOCKED_MEDIA", stage: "PHOTO" },
      data: {
        state: "QUEUED",
        message: "Owner requested photo-stage retry; no paid regeneration.",
        finishedAt: null,
      },
    });
    if (!changed.count)
      throw new ConflictException(
        "Only a photo-blocked saved draft can resume. Other failures require manual inspection.",
      );
    return { ok: true };
  }
  private async active(run: EditorialRun) {
    const [policy, settings, google] = await Promise.all([
      this.db.editorialSettings.findUnique({ where: { id: "owner" } }),
      this.db.automationSettings.findUnique({ where: { id: "owner" } }),
      this.db.integration.findUnique({
        where: { provider: "google" },
        select: { blogId: true },
      }),
    ]);
    if (
      !policy?.enabled ||
      policy.revision !== run.policyRevision ||
      settings?.paused ||
      settings?.emergencyStop ||
      (run.blogId && google?.blogId !== run.blogId)
    )
      throw new ConflictException(
        "Editorial policy, pause state or selected blog changed. Inspect the saved draft before proceeding.",
      );
    return policy;
  }
  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.db.editorialRun.updateMany({
        where: {
          state: "PROCESSING",
          startedAt: { lt: new Date(Date.now() - 30 * 60000) },
        },
        data: {
          state: "INTERRUPTED",
          finishedAt: new Date(),
          message:
            "Interrupted run. Inspect article, usage and Blogger status manually; it will not be replayed.",
        },
      });
      const c = await this.context();
      if (
        !c.settings.enabled ||
        !c.paidReady ||
        c.automation?.paused ||
        c.automation?.emergencyStop
      )
        return;
      if (
        !(await this.db.editorialRun.findFirst({ where: { state: "QUEUED" } }))
      ) {
        try {
          await this.queue(false);
        } catch {
          return;
        }
      }
      const run = await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172260)`;
        if (await tx.editorialRun.findFirst({ where: { state: "PROCESSING" } }))
          return null;
        const next = await tx.editorialRun.findFirst({
          where: { state: "QUEUED" },
          orderBy: { slotAt: "asc" },
        });
        if (!next) return null;
        return tx.editorialRun.update({
          where: { id: next.id },
          data: { state: "PROCESSING", startedAt: new Date() },
        });
      });
      if (run) await this.process(run);
    } finally {
      this.ticking = false;
    }
  }
  private async process(run: EditorialRun) {
    try {
      let policy = await this.active(run);
      let a;
      if (run.articleId) {
        a = await this.articles.get(run.articleId);
        if (a.version !== run.articleVersion || a.status !== "NEEDS_REVIEW")
          throw new ConflictException(
            "Saved draft changed; photo-stage retry stopped.",
          );
      } else {
        const c = await this.context();
        let candidate = c.readyBriefs[0];
        if (!candidate && policy.autoPlan) {
          const count = await this.db.editorialRun.count({
            where: { articleId: { not: null } },
          });
          const [, first, second] = starterBriefs[count % starterBriefs.length];
          candidate = await this.db.article.create({
            data: {
              title: "A new practical question from Git references",
              slug: `editorial-topic-${run.id}`,
              niche: "Git & GitHub",
              status: "PLANNED",
              intent:
                "Choose a new specific reader problem justified by these official references. Avoid every supplied existing topic. Draft a concrete, accurate tutorial with a natural title. Do not invent executed tests or unsupported output; record uncertainty when the references cannot substantiate a claim.",
              planningNotes:
                "Automatically planned from the owner-enabled curated Git reference packs. This is not a claim of human fact checking or search demand.",
              sources: {
                create: [first, second].map((doc) => ({
                  url: `https://git-scm.com/docs/${doc}`,
                  title: `Official ${doc} reference`,
                  note: "Reusable reference scope for an owner-enabled automatically planned Git tutorial. Source availability and generated claims still need validation; no human fact-check claim is made.",
                })),
              },
            },
            include: { sources: true },
          });
        }
        if (!candidate)
          throw new BadRequestException(
            "No source-backed topic brief is ready.",
          );
        a = await this.db.$transaction(async (tx) => {
          const changed = await tx.article.updateMany({
            where: {
              id: candidate.id,
              version: candidate.version,
              html: "",
              status: candidate.status,
              editorialRuns: { none: {} },
            },
            data: { status: "DRAFTING", version: { increment: 1 } },
          });
          if (!changed.count)
            throw new ConflictException("Topic brief changed before claim.");
          const saved = await tx.article.findUniqueOrThrow({
            where: { id: candidate.id },
          });
          await tx.editorialRun.update({
            where: { id: run.id },
            data: {
              articleId: saved.id,
              articleVersion: saved.version,
              stage: "TEXT",
            },
          });
          return saved;
        });
        await this.active(run);
        const generated = await this.ai.generate(
          { task: "draft", articleId: a.id, niche: a.niche },
          a.version,
        );
        a = await this.articles.get(a.id);
        const titles = (
          await this.db.article.findMany({
            where: { id: { not: a.id } },
            select: { title: true },
          })
        ).map((row) => row.title);
        if (!acceptableTitle(generated.data.title, titles))
          throw new BadRequestException(
            "Generated title is invalid or overlaps an existing topic. Review this draft.",
          );
        await this.articles.update(a.id, {
          title: (generated.data.title as string).trim(),
          niche: a.niche,
          intent: a.intent,
          excerpt: a.excerpt,
          html: safeHtml(a.html, false),
          labels: a.labels,
          aiAssisted: true,
          disclosure: false,
          version: a.version,
        });
        await this.articles.verifySources(a.id);
        a = await this.articles.get(a.id);
        await this.db.editorialRun.update({
          where: { id: run.id },
          data: { articleVersion: a.version, stage: "PHOTO" },
        });
      }
      const generation = a.generation as {
        uncertainties?: unknown;
        imageSearchTerms?: unknown;
      };
      if (
        !Array.isArray(generation.uncertainties) ||
        generation.uncertainties.length
      ) {
        await this.db.editorialRun.update({
          where: { id: run.id },
          data: {
            state: "NEEDS_REVIEW",
            finishedAt: new Date(),
            message:
              "The model flagged uncertainty or unverified examples. Owner review is required; no automatic approval.",
          },
        });
        return;
      }
      const terms = Array.isArray(generation.imageSearchTerms)
        ? generation.imageSearchTerms
            .filter((term): term is string => typeof term === "string")
            .slice(0, 5)
            .join(" ")
        : "";
      const photos = await this.db.mediaAsset.findMany({
        where: {
          rightsConfirmed: true,
          provider: { in: ["WIKIMEDIA", "ORIGINAL"] },
          articles: {
            none: {
              article: {
                id: { not: a.id },
                OR: [
                  {
                    editorialRuns: {
                      some: {
                        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
                      },
                    },
                  },
                  { publishedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
                  { scheduledAt: { gte: new Date(Date.now() - 7 * 86400000) } },
                ],
              },
            },
          },
        },
        take: 200,
      });
      const photo = choosePhoto(photos, `${a.title} ${a.intent} ${terms}`);
      if (!photo) {
        let candidates: Prisma.InputJsonValue = [];
        try {
          candidates = (
            await this.media.search(
              (terms || a.title).slice(0, 120),
              "wikimedia",
            )
          ).slice(0, 5) as unknown as Prisma.InputJsonValue;
        } catch {
          /* Discovery failure is not permission to use an unrelated or synthetic image. */
        }
        await this.db.editorialRun.update({
          where: { id: run.id },
          data: {
            state: "BLOCKED_MEDIA",
            stage: "PHOTO",
            articleVersion: a.version,
            candidates,
            finishedAt: new Date(),
            message:
              "No relevant recently reviewed photo is available. Review Commons candidates in Media library, confirm real-photo rights and add pool keywords, then resume this photo stage without regeneration.",
          },
        });
        return;
      }
      await this.active(run);
      await this.articles.attach(a.id, photo.id);
      a = await this.articles.get(a.id);
      const report = await this.articles.quality(a.id);
      if (
        sanitizeHtml(a.html, { allowedTags: [], allowedAttributes: {} })
          .split(/\s+/)
          .filter(Boolean).length < 450
      )
        throw new BadRequestException(
          "Automatic drafts must provide at least 450 useful words; review the incomplete draft.",
        );
      const issues = report.issues as unknown as { code: string }[];
      if (
        !report.passed ||
        issues.some((issue) => issue.code !== "EDITORIAL_REVIEW")
      )
        throw new BadRequestException(
          "Quality or originality checks need owner attention. No automated approval.",
        );
      policy = await this.active(run);
      if (!policy.autoPublish) {
        await this.db.editorialRun.update({
          where: { id: run.id },
          data: {
            state: "NEEDS_REVIEW",
            stage: "READY",
            articleVersion: a.version,
            finishedAt: new Date(),
            message:
              "Original text and licensed photo prepared. Review-only mode: owner approval is still required.",
          },
        });
        return;
      }
      if (!run.blogId)
        throw new BadRequestException(
          "Automatic publishing has no pinned blog.",
        );
      if (run.slotAt.getTime() < Date.now() + 5 * 60000)
        throw new ConflictException(
          "Publication slot was missed. Review the saved draft before manual scheduling.",
        );
      await this.db.$transaction(async (tx) => {
        const current = await tx.editorialSettings.findUnique({
          where: { id: "owner" },
        });
        if (
          !current?.enabled ||
          !current.autoPublish ||
          current.revision !== run.policyRevision
        )
          throw new ConflictException(
            "Editorial policy changed before automatic approval.",
          );
        const changed = await tx.article.updateMany({
          where: {
            id: a.id,
            version: a.version,
            status: "NEEDS_REVIEW",
            publishingTarget: "local",
          },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
            generation: {
              ...(a.generation as Prisma.JsonObject),
              editorialApproval: {
                kind: "AUTOMATIC_POLICY",
                version: a.version,
                revision: run.policyRevision,
                at: new Date().toISOString(),
              },
            },
          },
        });
        if (!changed.count)
          throw new ConflictException(
            "Draft changed before automatic approval.",
          );
        await tx.articleEvent.create({
          data: {
            articleId: a.id,
            from: "NEEDS_REVIEW",
            to: "APPROVED",
            reason: `Owner-authorized automatic editorial policy revision ${run.policyRevision}; not a human editorial review.`,
          },
        });
        await tx.auditLog.create({
          data: {
            action: "ARTICLE_AUTOMATIC_POLICY_APPROVED",
            entityId: a.id,
            message:
              "Standing owner policy accepted automated checks. No claim of human fact checking or AI-detector reliability.",
          },
        });
      });
      await this.active(run);
      await this.db.editorialRun.update({
        where: { id: run.id },
        data: { stage: "BLOGGER", articleVersion: a.version },
      });
      if (run.slotAt.getTime() < Date.now() + 5 * 60000)
        throw new ConflictException(
          "Publication slot was missed. Schedule the prepared article manually; no backdated catch-up publication.",
        );
      const scheduled = await this.cloud.schedule(
        a.id,
        run.slotAt.toISOString(),
        {
          expectedBlogId: run.blogId,
          expectedPhotoId: photo.id,
          automatic: true,
        },
      );
      await this.db.editorialRun.update({
        where: { id: run.id },
        data: {
          state: "SCHEDULED",
          stage: "DONE",
          finishedAt: new Date(),
          message: `Blogger confirmed its schedule at ${scheduled.scheduledAt?.toISOString()}. Computer can be off after acceptance.`,
        },
      });
    } catch {
      const current = await this.db.editorialRun.findUnique({
        where: { id: run.id },
      });
      await this.db.editorialRun.update({
        where: { id: run.id },
        data: {
          state:
            current?.stage === "BLOGGER" ? "REMOTE_ATTENTION" : "NEEDS_REVIEW",
          finishedAt: new Date(),
          message:
            current?.stage === "BLOGGER"
              ? "Inspect Blogger and saved remote intent before any retry. This request will not be replayed automatically."
              : "Preparation stopped. Check the saved article, quality report, policy, sources and provider usage. No automatic regeneration or publication retry.",
        },
      });
    }
  }
}
