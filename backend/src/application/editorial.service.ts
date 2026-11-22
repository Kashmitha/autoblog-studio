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
  AUTOMATIC_MIN_WORDS,
  editorialSlots,
  photoPolicy,
  EDITORIAL_ENABLE,
  EDITORIAL_PUBLISH,
  PHOTO_CONFIRMATION,
  choosePhoto,
  libraryImageTags,
  type PhotoCandidate,
} from "../domain/editorial";
import sanitizeHtml from "sanitize-html";
import { safeHtml } from "../domain/quality";
import { normalizeTopic } from "../domain/workflow";
import { aiConfiguration } from "../domain/ai-config";
import { referenceBriefs, chooseVariedBrief } from "../domain/reference-briefs";
import { CommonsPhotoService } from "./commons-photo.service";
import { articlePhotoTerms } from "../domain/photo-preparation";
import { commonsAutoEnabled } from "../domain/commons-photo";
import {
  readResearchSource,
  ResearchSourceUnavailable,
} from "../infrastructure/research-source";

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
    private readonly commons: CommonsPhotoService,
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
            provider: { in: ["WIKIMEDIA", "ORIGINAL", "UNSPLASH"] },
          },
          include: { articles: { select: { articleId: true } } },
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
    const ai = aiConfiguration();
    const paidReady = ai.ready; // retained API field for existing clients
    const blockers: string[] = [...ai.blockers];
    if (
      Number(process.env.AI_DAILY_GENERATION_LIMIT || 2) < settings.times.length
    )
      blockers.push(
        "Text-generation daily limit must cover the configured daily slots; the monthly spending cap still applies.",
      );
    if (!heartbeat || Date.now() - heartbeat.lastSeen.getTime() > 120000)
      blockers.push(
        "Start the worker on a computer or host that stays running.",
      );
    if (!automation || automation.paused)
      blockers.push(
        "Local automation is paused. Resume it when you want article preparation to run.",
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
          select: {
            id: true,
            title: true,
            status: true,
            publishedUrl: true,
            scheduledAt: true,
            publishedAt: true,
            remoteStatus: true,
            publishingTarget: true,
          },
        },
      },
    });
    const retries = await this.db.auditLog.groupBy({
      by: ["entityId"],
      where: {
        action: "EDITORIAL_PHOTO_AUTO_RETRY",
        entityId: { in: runs.map((run) => run.id) },
      },
      _count: { _all: true },
    });
    const eligiblePhotos = c.photos.filter(
      (photo) => photoPolicy(photo) && !photo.articles.length,
    );
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
    if (!eligiblePhotos.length && !commonsAutoEnabled())
      publishingBlockers.push(
        "Review real photographs and license rights, then add keywords to the automatic photo pool. Unsplash search/import remain manual; enroll the curated library to use saved assets.",
      );
    if ((c.automation?.dailyLimit || 0) < c.settings.times.length)
      publishingBlockers.push(
        "Set the publishing daily limit to cover the configured daily slots (one or two).",
      );
    return {
      settings: c.settings,
      blogUrl: c.google?.blogUrl || null,
      paidReady: c.paidReady,
      generationReady: c.paidReady,
      aiProvider: aiConfiguration().provider,
      aiFreePlan: aiConfiguration().free,
      automaticCommonsDiscovery: commonsAutoEnabled(),
      enablePhrase: aiConfiguration().free
        ? "ENABLE EDITORIAL DRAFTS"
        : EDITORIAL_ENABLE,
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
        eligible: photoPolicy(photo) && !photo.articles.length,
        used:
          photo.articles.length > 0 ||
          !!(photo.metadata as { automaticPhotoUse?: unknown } | null)
            ?.automaticPhotoUse,
      })),
      runs: runs.map((run) => ({
        ...run,
        ...(run.article?.publishingTarget === "blogger" &&
        ["SCHEDULED", "LIVE"].includes(run.article.remoteStatus || "")
          ? {
              state:
                run.article.remoteStatus === "LIVE" ? "PUBLISHED" : "SCHEDULED",
              stage: "DONE",
              message: `Blogger confirmed ${run.article.remoteStatus}. Publication: ${DateTime.fromJSDate(
                (run.article.remoteStatus === "LIVE"
                  ? run.article.publishedAt
                  : run.article.scheduledAt) || run.slotAt,
              )
                .setZone("Asia/Colombo")
                .toFormat(
                  "d LLL yyyy, HH:mm",
                )} Sri Lanka time. This row's slot is the original preparation request.`,
            }
          : {}),
        photoRetries:
          retries.find((row) => row.entityId === run.id)?._count._all || 0,
      })),
      nextSlots: editorialSlots(c.settings.times, new Date(), true).slice(0, 2),
      workerLastSeen: c.heartbeat?.lastSeen || null,
    };
  }
  async save(input: EditorialInput) {
    if (
      ![1, 2].includes(input.times.length) ||
      new Set(input.times).size !== input.times.length
    )
      throw new BadRequestException(
        "Choose one daily time, or two different times, in Asia/Colombo.",
      );
    const c = await this.context();
    if (input.enabled) {
      if (
        input.confirmation !==
        (input.autoPublish
          ? EDITORIAL_PUBLISH
          : aiConfiguration().free
            ? "ENABLE EDITORIAL DRAFTS"
            : EDITORIAL_ENABLE)
      )
        throw new BadRequestException(
          "Type the displayed authorization phrase to enable this workflow.",
        );
      const status = await this.status();
      const blockers = (
        input.autoPublish ? status.publishingBlockers : status.draftBlockers
      ).filter(
        (message) =>
          !(input.autoPlan && message.startsWith("Add source-backed")) &&
          !message.startsWith("Text-generation daily limit") &&
          !message.startsWith("Set the publishing daily limit"),
      );
      if (
        Number(process.env.AI_DAILY_GENERATION_LIMIT || 2) < input.times.length
      )
        blockers.push(
          "Text-generation limit must cover the selected daily slots.",
        );
      if (
        input.autoPublish &&
        (c.automation?.dailyLimit || 0) < input.times.length
      )
        blockers.push("Publishing limit must cover the selected daily slots.");
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
          message: `Owner ${input.enabled ? "enabled" : "disabled"} ${input.autoPublish ? "automatic-policy publishing" : "review-only drafting"}; ${saved.times.length} daily slot(s); revision ${saved.revision}.`,
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
      for (const { title, niche, intent, sources, angle } of referenceBriefs) {
        const slug = `editorial-brief-${normalizeTopic(title).replaceAll(" ", "-").slice(0, 70)}`;
        if (existing.has(normalizeTopic(title)) || slugs.has(slug)) continue;
        await tx.article.create({
          data: {
            title,
            slug,
            niche,
            intent: `${intent} Title approach: ${angle}; choose a natural problem-specific title rather than forcing a repeated template.`,
            status: "PLANNED",
            planningNotes:
              "Starter reference brief. Source scope is not a claim that code or factual support was manually verified. Review sources before unattended use.",
            sources: {
              create: sources.map((url) => ({
                url,
                title: `${niche} primary reference`,
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
  async enrollLibrary() {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172262)`;
      const images = await tx.mediaAsset.findMany({
        where: { provider: "UNSPLASH", rightsConfirmed: true },
        include: { articles: { select: { articleId: true } } },
      });
      let enrolled = 0;
      for (const image of images) {
        const meta = image.metadata as Prisma.JsonObject;
        if (
          image.articles.length ||
          meta.automaticPhotoUse ||
          !meta.providerPhotoId ||
          meta.licenseCheckedBy !== "owner" ||
          image.license !== "Unsplash" ||
          !image.url.startsWith("https://images.unsplash.com/") ||
          !image.alt
        )
          continue;
        const tags = libraryImageTags(image.title, image.alt);
        if (!tags.length) continue;
        const illustration = /3d|render|illustration|logo/i.test(
          `${image.title} ${image.alt}`,
        );
        await tx.mediaAsset.update({
          where: { id: image.id },
          data: {
            metadata: {
              ...meta,
              editorialPhoto: {
                enabled: true,
                tags,
                confirmedAt: new Date().toISOString(),
                confirmedBy: "owner",
                reviewKind: "OWNER_CURATED_LIBRARY",
                imageKind: illustration
                  ? "ILLUSTRATION_OR_LOGO"
                  : "IMPORTED_IMAGE_UNVERIFIED_ORIGIN",
              },
            },
            attribution:
              illustration && !image.attribution.includes("Illustration / logo")
                ? `${image.attribution} - Illustration / logo; not a photograph of the tutorial.`
                : image.attribution,
          },
        });
        enrolled++;
      }
      await tx.auditLog.create({
        data: {
          action: "OWNER_CURATED_LIBRARY_ENABLED",
          entityId: "owner",
          message: `Owner authorized ${enrolled} manually imported library images for downstream article selection. No automated Unsplash discovery or import. Metadata does not certify non-AI origin.`,
        },
      });
      return { enrolled };
    });
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
        !["WIKIMEDIA", "ORIGINAL", "UNSPLASH"].includes(photo.provider) ||
        ![
          "CC0",
          "Public domain",
          "CC BY 4.0",
          "CC BY-SA 4.0",
          "Original work",
          "Unsplash",
        ].includes(photo.license) ||
        !photo.alt ||
        !photo.url.startsWith("https://") ||
        !tags.length)
    )
      throw new BadRequestException(
        "Confirm a real photograph, commercial reuse rights, public HTTPS delivery and relevant keywords. Manually imported Unsplash assets require curated-library enrollment.",
      );
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172262)`;
      const currentPhoto = await tx.mediaAsset.findUniqueOrThrow({
        where: { id },
      });
      await tx.mediaAsset.update({
        where: { id },
        data: {
          metadata: {
            ...(currentPhoto.metadata as Prisma.JsonObject),
            editorialPhoto: {
              enabled,
              tags,
              confirmedAt: new Date().toISOString(),
              confirmedBy: "owner",
              ...(photo.provider === "UNSPLASH"
                ? { reviewKind: "OWNER_CURATED_LIBRARY" }
                : {}),
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
    const ahead =
      c.settings.autoPublish &&
      c.settings.autoPlan &&
      c.settings.times.length === 1;
    if (ahead && !manual && !(await this.hasTextAllowance()))
      return {
        queued: false,
        note: "Waiting for the daily text allowance to reset; existing Blogger schedules are retained.",
      };
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172260)`;
      const start = DateTime.now().setZone("Asia/Colombo").startOf("day");
      if (
        !ahead &&
        (await tx.editorialRun.count({
          where: {
            createdAt: {
              gte: start.toJSDate(),
              lt: start.plus({ days: 1 }).toJSDate(),
            },
          },
        })) >= c.settings.times.length
      )
        return {
          queued: false,
          note: "The configured daily editorial attempt limit has been reached. No automatic text regeneration retry is allowed.",
        };
      let reservedDay = false;
      for (const slot of editorialSlots(
        c.settings.times,
        new Date(),
        manual,
        ahead,
      )) {
        const day = DateTime.fromJSDate(slot.at).setZone("Asia/Colombo");
        if (
          ahead &&
          (await tx.editorialRun.count({
            where: {
              slotAt: {
                gte: day.startOf("day").toJSDate(),
                lte: day.endOf("day").toJSDate(),
              },
            },
          })) >= c.settings.times.length
        )
          continue;
        const reservations = await tx.publishJob.count({
          where: {
            scheduledAt: {
              gte: day.startOf("day").toJSDate(),
              lte: day.endOf("day").toJSDate(),
            },
            state: { notIn: ["CANCELED", "FAILED"] },
          },
        });
        if (reservations >= (c.automation?.dailyLimit || 1)) {
          reservedDay = true;
          continue;
        }
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
        note: reservedDay
          ? "An existing publication already fills the daily limit for the available date. Its Blogger schedule is retained; no duplicate draft was generated."
          : "No unreserved slot is currently available. Missed slots are not backfilled in a burst.",
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
  async resumePrepared(id: string, version: number) {
    const run = await this.db.editorialRun.findUniqueOrThrow({ where: { id } });
    const policy = await this.active(run);
    const article = run.articleId
      ? await this.articles.get(run.articleId)
      : null;
    if (
      !policy.autoPublish ||
      run.state !== "NEEDS_REVIEW" ||
      !["PHOTO", "CHECKS", "READY"].includes(run.stage) ||
      !article ||
      article.version !== version ||
      article.status !== "NEEDS_REVIEW" ||
      article.publishingTarget !== "local" ||
      article.remotePostId ||
      article.media.length !== 1
    )
      throw new ConflictException(
        "Only an unchanged, corrected local draft with one attached image can resume under the original automatic policy.",
      );
    const uncertainties = (
      article.generation as { uncertainties?: unknown } | null
    )?.uncertainties;
    if (!Array.isArray(uncertainties) || uncertainties.length)
      throw new ConflictException(
        "Resolve and record the remaining factual uncertainties before resuming.",
      );
    const report = await this.articles.quality(article.id);
    if (
      !report.passed ||
      (report.issues as unknown as { code: string }[]).some(
        (i) => i.code !== "EDITORIAL_REVIEW",
      )
    )
      throw new ConflictException(
        "Resolve the saved quality issues before resuming.",
      );
    const slot =
      run.slotAt.getTime() >= Date.now() + 10 * 60000
        ? { key: run.slotKey, at: run.slotAt }
        : editorialSlots(policy.times, new Date(), true)[0];
    if (!slot)
      throw new ConflictException("No future publication slot is available.");
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172260)`;
      const current = await tx.article.findUniqueOrThrow({
        where: { id: article.id },
      });
      if (
        current.version !== version ||
        current.status !== "NEEDS_REVIEW" ||
        current.publishingTarget !== "local"
      )
        throw new ConflictException("Draft changed while resuming.");
      const changed = await tx.editorialRun.updateMany({
        where: { id, state: "NEEDS_REVIEW", policyRevision: policy.revision },
        data: {
          state: "QUEUED",
          stage: "READY",
          articleVersion: version,
          slotKey: slot.key,
          slotAt: slot.at,
          finishedAt: null,
          message:
            "Corrected saved draft queued for policy checks and a future Blogger schedule; no text regeneration.",
        },
      });
      if (!changed.count)
        throw new ConflictException("Run changed while resuming.");
      await tx.auditLog.create({
        data: {
          action: "EDITORIAL_CORRECTED_DRAFT_RESUMED",
          entityId: id,
          message: `Saved version ${version}; original slot ${run.slotAt.toISOString()}; new slot ${slot.at.toISOString()}. No claim of human review.`,
        },
      });
    });
    return { queued: true, slotAt: slot.at };
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
  private async hasTextAllowance() {
    const start = DateTime.now()
      .setZone("Asia/Colombo")
      .startOf("day")
      .toJSDate();
    return (
      (await this.db.aiUsage.count({
        where: { createdAt: { gte: start }, state: { not: "RATE_LIMITED" } },
      })) < aiConfiguration().dailyLimit
    );
  }
  private async recordCorrection(run: EditorialRun) {
    const attempts = await this.db.auditLog.count({
      where: { action: "EDITORIAL_TEXT_CORRECTION", entityId: run.id },
    });
    if (attempts >= 3)
      throw new BadRequestException(
        "The three bounded source-backed corrections did not produce a publishable article.",
      );
    await this.db.auditLog.create({
      data: {
        action: "EDITORIAL_TEXT_CORRECTION",
        entityId: run.id,
        message: `Source-backed correction ${attempts + 1}/3; existing daily provider and spending limits still apply.`,
      },
    });
  }
  private async deferCorrection(
    run: EditorialRun,
    version: number,
    reason: string,
  ) {
    const policy = await this.active(run);
    if (
      !policy.autoPublish ||
      !policy.autoPlan ||
      policy.times.length !== 1 ||
      run.slotAt.getTime() <= Date.now() + 10 * 60000
    )
      return false;
    if (
      (await this.db.auditLog.count({
        where: { action: "EDITORIAL_TEXT_CORRECTION", entityId: run.id },
      })) >= 3
    )
      return false;
    await this.db.editorialRun.update({
      where: { id: run.id },
      data: {
        state: "WAITING_AI",
        stage: "TEXT_REPAIR",
        articleVersion: version,
        finishedAt: new Date(),
        message: `Automatic source-backed correction is waiting for allowance and backoff: ${reason.slice(0, 450)} No approval is required while recovery is pending; no unverified claim will be published.`,
      },
    });
    return true;
  }
  /** Resume only explicitly rejected/pre-request work, never ambiguous remote writes. */
  private async recoverPreparation() {
    const c = await this.context();
    if (!c.settings.autoPublish) return;
    const runs = await this.db.editorialRun.findMany({
      where: {
        state: { in: ["WAITING_SOURCE", "WAITING_AI"] },
        policyRevision: c.settings.revision,
        blogId: c.settings.blogId,
        slotAt: { gt: new Date(Date.now() + 10 * 60000) },
        finishedAt: { lt: new Date(Date.now() - 5 * 60000) },
      },
      take: 2,
      orderBy: { slotAt: "asc" },
    });
    for (const run of runs) {
      if (run.state === "WAITING_AI" && !(await this.hasTextAllowance()))
        continue;
      const attempts = await this.db.auditLog.count({
        where: { action: "EDITORIAL_PREPARATION_RESUMED", entityId: run.id },
      });
      if (
        attempts >= 8 ||
        Date.now() - run.finishedAt!.getTime() <
          Math.min(60, 5 * 2 ** attempts) * 60000
      )
        continue;
      if (run.articleId) {
        const a = await this.db.article.findUnique({
          where: { id: run.articleId },
        });
        if (
          !a ||
          a.version !== run.articleVersion ||
          a.publishingTarget !== "local" ||
          a.remotePostId ||
          !["NEEDS_REVIEW", "DRAFTING"].includes(a.status)
        )
          continue;
      }
      await this.db.$transaction(async (tx) => {
        const changed = await tx.editorialRun.updateMany({
          where: { id: run.id, state: run.state },
          data: {
            state: "QUEUED",
            finishedAt: null,
            message:
              "Automatic preparation recovery queued under the unchanged owner policy.",
          },
        });
        if (changed.count)
          await tx.auditLog.create({
            data: {
              action: "EDITORIAL_PREPARATION_RESUMED",
              entityId: run.id,
              message: `Bounded attempt ${attempts + 1}/8 after ${run.state}; no ambiguous completion or Blogger write is replayed.`,
            },
          });
      });
    }
  }
  /** Retry only saved, unchanged photo-blocked drafts; never replay text or remote writes. */
  private async recoverPhotos() {
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172260)`;
      const policy = await tx.editorialSettings.findUnique({
        where: { id: "owner" },
      });
      const automation = await tx.automationSettings.findUnique({
        where: { id: "owner" },
      });
      const google = await tx.integration.findUnique({
        where: { provider: "google" },
        select: { blogId: true },
      });
      if (
        !policy?.enabled ||
        !policy.autoPublish ||
        automation?.paused ||
        automation?.emergencyStop
      )
        return;
      const now = new Date();
      const runs = await tx.editorialRun.findMany({
        where: {
          state: "BLOCKED_MEDIA",
          stage: "PHOTO",
          policyRevision: policy.revision,
          blogId: google?.blogId || null,
          slotAt: { gt: new Date(now.getTime() + 10 * 60000) },
          finishedAt: { lte: new Date(now.getTime() - 2 * 60000) },
        },
        orderBy: { slotAt: "asc" },
        take: 2,
      });
      for (const run of runs) {
        if (!run.articleId) continue;
        const count = await tx.auditLog.count({
          where: { action: "EDITORIAL_PHOTO_AUTO_RETRY", entityId: run.id },
        });
        if (count >= 3) continue;
        const article = await tx.article.findUnique({
          where: { id: run.articleId },
        });
        if (
          !article ||
          article.version !== run.articleVersion ||
          article.status !== "NEEDS_REVIEW" ||
          article.publishingTarget !== "local"
        )
          continue;
        const changed = await tx.editorialRun.updateMany({
          where: { id: run.id, state: "BLOCKED_MEDIA", stage: "PHOTO" },
          data: {
            state: "QUEUED",
            finishedAt: null,
            message: `Automatic photo retry ${count + 1}/3 queued. Uses the saved draft; no text regeneration.`,
          },
        });
        if (changed.count)
          await tx.auditLog.create({
            data: {
              action: "EDITORIAL_PHOTO_AUTO_RETRY",
              entityId: run.id,
              message: `Attempt ${count + 1}/3 for unchanged saved draft ${article.id}.`,
            },
          });
      }
    });
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
      await this.recoverPhotos();
      await this.recoverPreparation();
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
        if (
          a.version !== run.articleVersion ||
          a.publishingTarget !== "local" ||
          a.remotePostId ||
          !(
            ["TEXT", "TEXT_REPAIR"].includes(run.stage)
              ? ["NEEDS_REVIEW", "DRAFTING"]
              : ["NEEDS_REVIEW"]
          ).includes(a.status)
        )
          throw new ConflictException(
            "Saved draft changed; photo-stage retry stopped.",
          );
      } else {
        const c = await this.context();
        const recent = await this.db.article.findMany({
          where: { html: { not: "" } },
          select: { niche: true },
          orderBy: { updatedAt: "desc" },
          take: 30,
        });
        const imageLed = policy.autoPlan && policy.times.length === 1;
        const imagePlans = imageLed
          ? referenceBriefs
              .map((pack) => {
                const photo = choosePhoto(
                  c.photos.filter((p) => !p.articles.length),
                  `${pack.title} ${pack.intent} ${articlePhotoTerms({ ...pack, generation: null }).join(" ")}`,
                );
                return { ...pack, photo };
              })
              .filter((plan) => plan.photo)
          : [];
        let imagePlan = imageLed
          ? chooseVariedBrief(
              imagePlans,
              recent.map((a) => a.niche),
            )
          : undefined;
        if (imageLed) {
          const remaining = [...imagePlans];
          let checked = 0;
          while (imagePlan && checked++ < 4) {
            try {
              const reads = await Promise.all(
                imagePlan.sources.map((url) => readResearchSource(url)),
              );
              imagePlan = {
                ...imagePlan,
                sources: reads.map((read) => read.sourceUrl),
              };
              break;
            } catch {
              remaining.splice(
                remaining.findIndex((plan) => plan === imagePlan),
                1,
              );
              imagePlan = chooseVariedBrief(
                remaining,
                recent.map((a) => a.niche),
              );
            }
          }
          if (imagePlans.length && (!imagePlan || checked > 4))
            throw new ResearchSourceUnavailable(
              "Matching source-backed topics are temporarily unavailable. Waiting before another source check; no text request was sent.",
            );
        }
        if (imageLed && !imagePlan?.photo)
          throw new BadRequestException(
            "No unused library photograph matches the supported source-backed topics. Refill the reviewed library before the next daily slot.",
          );
        if (imagePlan?.photo) {
          run.candidates = [
            {
              mediaId: imagePlan.photo.id,
              title: imagePlan.photo.title,
              sourceUrl: imagePlan.photo.sourceUrl || "",
            },
          ];
          await this.db.editorialRun.update({
            where: { id: run.id },
            data: { candidates: run.candidates as Prisma.InputJsonValue },
          });
        }
        let candidate = chooseVariedBrief(
          imageLed ? [] : c.readyBriefs,
          recent.map((a) => a.niche),
        );
        if (!candidate && policy.autoPlan) {
          const count = await this.db.editorialRun.count({
            where: { articleId: { not: null } },
          });
          const pack =
            imagePlan ||
            chooseVariedBrief(
              referenceBriefs,
              recent.map((a) => a.niche),
            ) ||
            referenceBriefs[count % referenceBriefs.length];
          candidate = await this.db.article.create({
            data: {
              title: `A new practical question about ${pack.niche}`,
              slug: `editorial-topic-${run.id}`,
              niche: pack.niche,
              status: "PLANNED",
              intent: `${imagePlan?.photo ? `Illustrative image subject: ${imagePlan.photo.title}. ${imagePlan.photo.alt}. Choose an article relevant to this image. It may be a render, illustration or logo; never call it a real photograph or claim it documents executed tests or a product screenshot. ` : ""}Choose a new specific reader problem justified by these primary references. Reference scope: ${pack.intent} Prefer a ${pack.angle} when useful; do not force a repeated title formula. Avoid every supplied existing topic. Do not invent executed tests or unsupported output; record uncertainty when the references cannot substantiate a claim.`,
              planningNotes:
                "Automatically planned from owner-enabled primary-reference packs across developer topics. This is not a claim of human fact checking or search demand.",
              sources: {
                create: pack.sources.map((url) => ({
                  url,
                  title: `${pack.niche} primary reference`,
                  note: `Reference scope: ${pack.intent} Source availability and generated claims still need validation; no human fact-check claim is made.`,
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
      }
      a = await this.articles.get(a.id);
      if (run.stage === "SOURCES") {
        await this.articles.verifySources(a.id);
        a = await this.articles.get(a.id);
        if (a.sources.some((source) => source.httpStatus !== 200))
          throw new ResearchSourceUnavailable(
            "Saved draft sources remain unavailable; text will not be regenerated.",
          );
        await this.db.editorialRun.update({
          where: { id: run.id },
          data: { stage: "PHOTO", articleVersion: a.version },
        });
      }
      if (!run.articleId || ["TEXT", "TEXT_REPAIR"].includes(run.stage)) {
        await this.active(run);
        let textRepairUsed = run.stage === "TEXT_REPAIR";
        if (textRepairUsed) await this.recordCorrection(run);
        let generated: Awaited<ReturnType<AiService["generate"]>>;
        try {
          generated = await this.ai.generate(
            { task: "draft", articleId: a.id, niche: a.niche },
            a.version,
            textRepairUsed
              ? "Repair the supplied saved draft using only the fetched references. Remove unsupported claims or replace them with documented narrower explanations. Do not simply clear uncertainties. Label illustrative examples, omit invented output and unsupported platform differences. Keep genuinely unresolved factual claims in uncertainties. Return a complete replacement article of 550-800 words. This resumes the single correction allowance after a pre-request limit or explicit rejection."
              : undefined,
          );
        } catch (error) {
          if (
            !policy.autoPublish ||
            !(error instanceof BadRequestException) ||
            !error.message.includes("(json_validate_failed)")
          )
            throw error;
          await this.active(run);
          textRepairUsed = true;
          await this.recordCorrection(run);
          await this.db.editorialRun.update({
            where: { id: run.id },
            data: {
              stage: "TEXT_REPAIR",
              articleVersion: a.version,
              message:
                "Groq rejected incomplete structured output. Using the one text-repair allowance to request a complete article; existing provider limits still apply.",
            },
          });
          generated = await this.ai.generate(
            { task: "draft", articleId: a.id, niche: a.niche },
            a.version,
            "The provider rejected the previous response because required article fields were missing. Return the COMPLETE JSON object, including html with the full article body, title, excerpt, outline, labels, imageSearchTerms, uncertainties and topics: []. Do not return a partial patch. Use only the supplied references and keep unresolved claims in uncertainties. This is the only automatic repair attempt.",
          );
        }
        a = await this.articles.get(a.id);
        // Save completed preparation before an optional correction can fail.
        // The pinned library image is already selected for this source-backed
        // brief; attaching it is not approval or permission to publish.
        const existingTitles = (
          await this.db.article.findMany({
            where: { id: { not: a.id } },
            select: { title: true },
          })
        ).map((row) => row.title);
        if (!acceptableTitle(generated.data.title, existingTitles))
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
        a = await this.articles.get(a.id);
        const pinnedImage = Array.isArray(run.candidates)
          ? run.candidates.find(
              (candidate) =>
                candidate &&
                typeof candidate === "object" &&
                !Array.isArray(candidate) &&
                typeof candidate.mediaId === "string",
            )
          : null;
        if (
          !a.media.length &&
          pinnedImage &&
          typeof pinnedImage === "object" &&
          !Array.isArray(pinnedImage) &&
          typeof pinnedImage.mediaId === "string"
        ) {
          await this.active(run);
          await this.articles.attachAutomaticPhoto(
            a.id,
            pinnedImage.mediaId,
            a.version,
          );
          a = await this.articles.get(a.id);
        }
        await this.db.editorialRun.update({
          where: { id: run.id },
          data: { articleVersion: a.version },
        });
        const words = sanitizeHtml(a.html, {
          allowedTags: [],
          allowedAttributes: {},
        })
          .split(/\s+/)
          .filter(Boolean).length;
        const uncertain =
          !Array.isArray(generated.data.uncertainties) ||
          generated.data.uncertainties.length > 0;
        if (
          policy.autoPublish &&
          !textRepairUsed &&
          (words < AUTOMATIC_MIN_WORDS || uncertain)
        ) {
          await this.active(run);
          await this.db.editorialRun.update({
            where: { id: run.id },
            data: {
              stage: "TEXT_REPAIR",
              articleVersion: a.version,
              message: `Draft has ${words} words${uncertain ? " and unresolved claims" : ""}; attempting one source-backed correction within the existing daily provider limits.`,
            },
          });
          await this.recordCorrection(run);
          generated = await this.ai.generate(
            { task: "draft", articleId: a.id, niche: a.niche },
            a.version,
            `Repair the supplied previous draft using only the fetched references. It has ${words} words (minimum ${AUTOMATIC_MIN_WORDS}). Resolve its explicit uncertainties by removing unsupported claims or replacing them with documented, narrower explanations. Do not simply clear the uncertainty list. Clearly label illustrative examples, omit invented output and OS/version differences not in the references, and state documented caveats in the article. If the references cannot resolve a claim, keep it in uncertainties. Aim for 550-800 useful words without padding. This is the only automatic text-repair attempt.`,
          );
          a = await this.articles.get(a.id);
        }
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
        a = await this.articles.get(a.id);
        await this.db.editorialRun.update({
          where: { id: run.id },
          data: { stage: "SOURCES", articleVersion: a.version },
        });
        await this.articles.verifySources(a.id);
        a = await this.articles.get(a.id);
        if (a.sources.some((source) => source.httpStatus !== 200))
          throw new ResearchSourceUnavailable(
            "Saved draft sources became unavailable; waiting to recheck without regenerating text.",
          );
        await this.db.editorialRun.update({
          where: { id: run.id },
          data: { articleVersion: a.version, stage: "PHOTO" },
        });
      }
      const generation = a.generation as {
        uncertainties?: unknown;
        imageSearchTerms?: unknown;
      };
      const searchTerms = Array.isArray(generation.imageSearchTerms)
        ? generation.imageSearchTerms
            .filter((term): term is string => typeof term === "string")
            .slice(0, 5)
        : [];
      const terms = searchTerms.join(" ");
      let photo: PhotoCandidate | null = a.media[0]?.media || null;
      await this.active(run);
      try {
        const pinned = Array.isArray(run.candidates)
          ? run.candidates.find(
              (v) =>
                v &&
                typeof v === "object" &&
                !Array.isArray(v) &&
                typeof v.mediaId === "string",
            )
          : null;
        if (
          !photo &&
          pinned &&
          typeof pinned === "object" &&
          !Array.isArray(pinned) &&
          typeof pinned.mediaId === "string"
        ) {
          const planned = await this.db.mediaAsset.findUnique({
            where: { id: pinned.mediaId },
          });
          photo = planned && photoPolicy(planned) ? planned : null;
        } else if (!photo)
          photo = (await this.commons.select(a, searchTerms))?.photo || null;
      } catch {
        /* Preserve the generated draft if image discovery is unavailable. */
      }
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
            candidates:
              Array.isArray(run.candidates) &&
              run.candidates.some(
                (v) =>
                  v &&
                  typeof v === "object" &&
                  !Array.isArray(v) &&
                  typeof v.mediaId === "string",
              )
                ? (run.candidates as Prisma.InputJsonValue)
                : candidates,
            finishedAt: new Date(),
            message:
              "No relevant photo passed the available pool or automatic Commons checks. Review Commons candidates in Media library, confirm real-photo rights and add pool keywords, then resume this photo stage without regenerating text. With automatic publishing enabled, Studio also retries this saved photo stage up to three times, two minutes apart, while the slot is more than ten minutes away.",
          },
        });
        return;
      }
      await this.active(run);
      if (!a.media.length)
        await this.articles.attachAutomaticPhoto(a.id, photo.id, a.version);
      a = await this.articles.get(a.id);
      await this.db.editorialRun.update({
        where: { id: run.id },
        data: { stage: "CHECKS", articleVersion: a.version },
      });
      const report = await this.articles.quality(a.id);
      const issues = report.issues as unknown as { code: string }[];
      if (
        !report.passed ||
        issues.some((issue) => issue.code !== "EDITORIAL_REVIEW")
      ) {
        if (
          issues.some((issue) => issue.code === "THIN_CONTENT") &&
          issues.every((issue) =>
            ["THIN_CONTENT", "EDITORIAL_REVIEW"].includes(issue.code),
          ) &&
          (await this.deferCorrection(
            run,
            a.version,
            "Expand the saved incomplete draft with supported explanation, not filler.",
          ))
        )
          return;
        throw new BadRequestException(
          `Quality checks stopped this run: ${(
            report.issues as unknown as { code: string; message: string }[]
          )
            .filter((i) => i.code !== "EDITORIAL_REVIEW")
            .map((i) => i.message)
            .join(" ")}`,
        );
      }
      if (
        !Array.isArray(generation.uncertainties) ||
        generation.uncertainties.length
      ) {
        if (
          await this.deferCorrection(
            run,
            a.version,
            "Remove or substantiate the saved unresolved claims; do not merely clear uncertainties.",
          )
        )
          return;
        await this.db.editorialRun.update({
          where: { id: run.id },
          data: {
            state: "NEEDS_REVIEW",
            stage: "READY",
            articleVersion: a.version,
            finishedAt: new Date(),
            message: `Photo and attribution are attached, but automatic source repair did not resolve: ${
              Array.isArray(generation.uncertainties)
                ? generation.uncertainties
                    .filter((v): v is string => typeof v === "string")
                    .join(" ")
                    .slice(0, 650)
                : "Missing uncertainty assessment."
            } This run was not scheduled.`,
          },
        });
        return;
      }
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
    } catch (error) {
      const detail =
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof ResearchSourceUnavailable
          ? error.message.slice(0, 500)
          : "Check the saved draft, sources and provider usage.";
      const current = await this.db.editorialRun.findUnique({
        where: { id: run.id },
      });
      const waitingSource = error instanceof ResearchSourceUnavailable;
      const waitingAi =
        ["TEXT", "TEXT_REPAIR"].includes(current?.stage || "") &&
        /Daily AI generation limit reached|Groq rate or token quota reached/.test(
          detail,
        );
      const saved = current?.articleId
        ? await this.db.article.findUnique({
            where: { id: current.articleId },
            select: { version: true },
          })
        : null;
      await this.db.editorialRun.update({
        where: { id: run.id },
        data: {
          state:
            current?.stage === "BLOGGER"
              ? "REMOTE_ATTENTION"
              : waitingSource
                ? "WAITING_SOURCE"
                : waitingAi
                  ? "WAITING_AI"
                  : "NEEDS_REVIEW",
          ...(saved ? { articleVersion: saved.version } : {}),
          finishedAt: new Date(),
          message:
            current?.stage === "BLOGGER"
              ? "Inspect Blogger and saved remote intent before any retry. This request will not be replayed automatically."
              : waitingSource || waitingAi
                ? `Waiting automatically: ${detail} The saved stage will resume with backoff while its slot is future and the original policy remains active.`
                : `Preparation stopped: ${detail} No automatic regeneration or publication retry.`,
        },
      });
    }
  }
}
