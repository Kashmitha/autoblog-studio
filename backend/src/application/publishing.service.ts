import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleDestroy,
} from "@nestjs/common";
import { Queue, UnrecoverableError } from "bullmq";
import { DateTime } from "luxon";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../infrastructure/prisma.service";
import { ArticlesService } from "./articles.service";
import { LiveBloggerAdapter } from "../infrastructure/blogger.service";
import { safeHtml } from "../domain/quality";
import { env } from "../config";
export const redisConnection = () => {
  const u = new URL(env.redis);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined,
    username: u.username || undefined,
    ...(u.protocol === "rediss:" ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
};
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export class DeferredPublication extends Error {}
@Injectable()
export class PublishingService implements OnModuleDestroy {
  readonly queue = new Queue(process.env.PUBLISH_QUEUE || "autoblog-publish", {
    connection: {
      ...redisConnection(),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    },
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 1000 },
    },
  });
  constructor(
    readonly db: PrismaService,
    private readonly articles: ArticlesService,
    private readonly blogger: LiveBloggerAdapter,
  ) {}
  async onModuleDestroy() {
    await this.queue.close();
  }
  async schedule(id: string, at: string, liveTest = false) {
    let blogId: string | undefined;
    const date = new Date(at);
    if (!Number.isFinite(date.getTime()) || date.getTime() < Date.now() - 60000)
      throw new BadRequestException(
        "Choose a current or future publication time.",
      );
    const a = await this.articles.get(id);
    if (a.status !== "APPROVED")
      throw new BadRequestException("Only approved articles can be scheduled.");
    if (!(await this.articles.quality(id)).passed)
      throw new BadRequestException("Quality checks no longer pass.");
    if (env.bloggerMode === "live") {
      const i = await this.db.integration.findUnique({
        where: { provider: "google" },
      });
      if (
        !i?.blogId ||
        !i.firstLiveTestAuthorizedAt ||
        (!i.liveTestSucceededAt && !liveTest)
      )
        throw new BadRequestException(
          "Connect a blog and explicitly authorize the first live test before scheduling.",
        );
      blogId = i.blogId!;
      if (a.remoteBlogId && a.remoteBlogId !== blogId)
        throw new BadRequestException(
          "This article has a draft on another blog. Create a new article for the newly selected blog.",
        );
    }
    const job = await this.db.$transaction(async (tx) => {
      const changed = await tx.article.updateMany({
        where: { id, status: "APPROVED", version: a.version },
        data: { status: "SCHEDULED", scheduledAt: date },
      });
      if (!changed.count)
        throw new ConflictException("Article changed while scheduling.");
      const j = await tx.publishJob.create({
        data: {
          articleId: id,
          key: `${id}-${a.version}-${randomBytes(4).toString("hex")}`,
          scheduledAt: date,
          mode: env.bloggerMode,
          liveTest,
          blogId,
        },
      });
      await tx.articleEvent.create({
        data: {
          articleId: id,
          from: "APPROVED",
          to: "SCHEDULED",
          reason: "Owner scheduled article.",
        },
      });
      return j;
    });
    try {
      await this.enqueue(job.id, date);
    } catch {
      await this.db.auditLog.create({
        data: {
          action: "QUEUE_PENDING",
          entityId: job.id,
          message:
            "Database schedule saved; worker reconciliation will dispatch when Redis is available.",
        },
      });
    }
    return job;
  }
  async enqueue(id: string, date: Date) {
    await this.queue.add(
      "publish",
      { id },
      { jobId: id, delay: Math.max(0, date.getTime() - Date.now()) },
    );
  }
  async cancel(id: string) {
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172142)`;
      const a = await tx.article.findUniqueOrThrow({ where: { id } });
      if (a.status !== "SCHEDULED")
        throw new BadRequestException(
          "Only scheduled articles can be canceled.",
        );
      await tx.publishJob.updateMany({
        where: { articleId: id, state: "PENDING" },
        data: { state: "CANCELED" },
      });
      await tx.article.update({
        where: { id },
        data: { status: "APPROVED", scheduledAt: null },
      });
      await tx.articleEvent.create({
        data: {
          articleId: id,
          from: "SCHEDULED",
          to: "APPROVED",
          reason: "Owner canceled publication.",
        },
      });
    });
    return { ok: true };
  }
  async reconcile() {
    const jobs = await this.db.publishJob.findMany({
      where: { state: { in: ["PENDING", "RUNNING"] } },
      take: 500,
      orderBy: { scheduledAt: "asc" },
    });
    for (const j of jobs) {
      const queued = await this.queue.getJob(j.id);
      if (!queued) await this.enqueue(j.id, j.scheduledAt);
      else if ((await queued.getState()) === "failed")
        await this.recordFailure(
          j.id,
          new Error(
            queued.failedReason ||
              "Queue exhausted its retries; owner review required.",
          ),
          true,
        );
    }
    const cutoff = new Date(Date.now() - 3 * 60000);
    await this.db.workerHeartbeat.deleteMany({
      where: { lastSeen: { lt: cutoff } },
    });
    await this.fillRecurring();
  }
  async fillRecurring() {
    const s = await this.db.automationSettings.findUnique({
      where: { id: "owner" },
    });
    if (!s || s.paused || s.emergencyStop) return;
    if (env.bloggerMode === "live") {
      const i = await this.db.integration.findUnique({
        where: { provider: "google" },
      });
      if (!i?.liveTestSucceededAt) return;
    }
    const now = DateTime.now().setZone(s.timezone);
    for (let day = 0; day < 7; day++) {
      const date = now.plus({ days: day });
      const start = date.startOf("day").toJSDate(),
        end = date.endOf("day").toJSDate();
      let count = await this.db.publishJob.count({
        where: {
          scheduledAt: { gte: start, lte: end },
          state: { not: "CANCELED" },
        },
      });
      for (const time of [...new Set(s.times)].sort()) {
        if (count >= s.dailyLimit) break;
        const [hour, minute] = time.split(":").map(Number);
        const slot = date.set({ hour, minute, second: 0, millisecond: 0 });
        if (slot <= now) continue;
        const exists = await this.db.publishJob.count({
          where: { scheduledAt: slot.toJSDate(), state: { not: "CANCELED" } },
        });
        if (exists) continue;
        const a = await this.db.article.findFirst({
          where: { status: "APPROVED" },
          orderBy: { approvedAt: "asc" },
        });
        if (!a) return;
        try {
          await this.schedule(a.id, slot.toISO()!);
          count++;
        } catch {
          await this.db.auditLog.create({
            data: {
              action: "AUTO_SCHEDULE_BLOCKED",
              entityId: a.id,
              message:
                "Approved candidate failed fresh validation; no publication forced.",
            },
          });
          return;
        }
      }
    }
  }
  async process(id: string) {
    // A transaction-held advisory lock serializes workers. Article/attempt records use
    // separate committed transactions so a process crash cannot erase remote-call intent.
    return this.db.$transaction(
      async (lock) => {
        await lock.$executeRaw`SELECT pg_advisory_xact_lock(8172142)`;
        return this.executeLocked(id);
      },
      { timeout: 120000, maxWait: 120000 },
    );
  }
  private async executeLocked(id: string) {
    const j = await this.db.publishJob.findUnique({
      where: { id },
      include: { article: true },
    });
    if (
      !j ||
      ["SUCCEEDED", "MOCK_SUCCEEDED", "CANCELED", "FAILED"].includes(j.state)
    )
      return;
    const a = await this.articles.get(j.articleId);
    if (a.status === "PUBLISHED") {
      await this.db.publishJob.update({
        where: { id },
        data: { state: "SUCCEEDED", finishedAt: new Date() },
      });
      return;
    }
    if (!["SCHEDULED", "PUBLISHING"].includes(a.status) || !a.approvedAt)
      throw new UnrecoverableError("Article is not approved and scheduled.");
    const s = await this.db.automationSettings.findUniqueOrThrow({
      where: { id: "owner" },
    });
    if (s.paused || s.emergencyStop)
      throw new DeferredPublication(
        "Automation paused or emergency stop enabled.",
      );
    if (j.mode !== env.bloggerMode)
      throw new UnrecoverableError(
        "Publishing mode changed; cancel and reschedule.",
      );
    if (j.scheduledAt > new Date())
      throw new Error("Scheduled time has not arrived.");
    const start = DateTime.now().setZone(s.timezone).startOf("day").toJSDate();
    const published = await this.db.publishJob.count({
      where: {
        state: j.mode === "mock" ? "MOCK_SUCCEEDED" : "SUCCEEDED",
        finishedAt: { gte: start },
      },
    });
    if (published >= s.dailyLimit)
      throw new DeferredPublication("Daily publication limit reached.");
    const report = await this.articles.quality(a.id);
    if (!report.passed)
      throw new UnrecoverableError(
        "Fresh quality validation failed. Review the quality report.",
      );
    await this.db.$transaction([
      this.db.publishJob.update({
        where: { id },
        data: {
          state: "RUNNING",
          attempts: { increment: 1 },
          startedAt: new Date(),
          error: null,
        },
      }),
      this.db.article.update({
        where: { id: a.id },
        data: { status: "PUBLISHING" },
      }),
      ...(a.status === "SCHEDULED"
        ? [
            this.db.articleEvent.create({
              data: {
                articleId: a.id,
                from: "SCHEDULED",
                to: "PUBLISHING",
                reason: "Worker claimed approved, validated article.",
              },
            }),
          ]
        : []),
    ]);
    if (j.mode === "mock") {
      await this.db.$transaction([
        this.db.publishJob.update({
          where: { id },
          data: { state: "MOCK_SUCCEEDED", finishedAt: new Date() },
        }),
        this.db.article.update({
          where: { id: a.id },
          data: { status: "APPROVED", scheduledAt: null },
        }),
        this.db.articleEvent.create({
          data: {
            articleId: a.id,
            from: "PUBLISHING",
            to: "APPROVED",
            reason:
              "Mock run completed; no real publication. Article returned to approved backlog.",
          },
        }),
        this.db.auditLog.create({
          data: {
            action: "MOCK_PUBLICATION",
            entityId: a.id,
            message:
              "Mock succeeded. No external post, traffic or revenue was created.",
          },
        }),
      ]);
      return;
    }
    const i = await this.db.integration.findUnique({
      where: { provider: "google" },
    });
    if (
      !i?.blogId ||
      !i.firstLiveTestAuthorizedAt ||
      (!i.liveTestSucceededAt && !j.liveTest)
    )
      throw new UnrecoverableError("First live-test authorization missing.");
    if (
      j.blogId !== i.blogId ||
      (a.remoteBlogId && a.remoteBlogId !== i.blogId)
    )
      throw new UnrecoverableError(
        "The selected blog changed after this job was scheduled. Cancel and review the destination.",
      );
    let postId = a.remotePostId;
    const figures = a.media
      .map(
        ({ media: m }) =>
          `<figure><img src="${escapeHtml(m.url)}" alt="${escapeHtml(m.alt)}" loading="lazy" /><figcaption>${m.profileUrl ? `<a href="${escapeHtml(m.profileUrl)}">${escapeHtml(m.creator)}</a> · ` : ""}${escapeHtml(m.attribution)} — <a href="${escapeHtml(m.sourceUrl)}">Source</a> · <a href="${escapeHtml(m.licenseUrl)}">${escapeHtml(m.license)}</a></figcaption></figure>`,
      )
      .join("");
    const content = safeHtml(
      `${a.html}${figures}${a.aiAssisted && a.disclosure ? "<p><em>Prepared with AI assistance and reviewed by the editor.</em></p>" : ""}`,
    );
    if (!postId) {
      if (a.draftAttemptedAt)
        throw new UnrecoverableError(
          "A previous Blogger draft insertion has an uncertain outcome. Reconcile the remote draft before retrying.",
        );
      await this.assertAutomationActive();
      await this.db.article.update({
        where: { id: a.id },
        data: { draftAttemptedAt: new Date(), remoteBlogId: i.blogId },
      });
      postId = await this.blogger.createDraft(
        i.blogId,
        a.title,
        content,
        a.labels,
      );
      await this.db.article.update({
        where: { id: a.id },
        data: { remotePostId: postId },
      });
    }
    let remote = await this.blogger.getPost(i.blogId, postId);
    if (!["DRAFT", "LIVE"].includes(remote.status))
      throw new UnrecoverableError(
        "Blogger returned an unexpected or unavailable post status. Inspect the remote post before retrying.",
      );
    if (remote.status !== "LIVE") {
      await this.assertAutomationActive();
      await this.blogger.updateDraft(
        i.blogId,
        postId,
        a.title,
        content,
        a.labels,
      );
      await this.assertAutomationActive();
      remote = await this.blogger.publish(i.blogId, postId);
    }
    await this.db.$transaction([
      this.db.article.update({
        where: { id: a.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedUrl: remote.url,
          scheduledAt: null,
        },
      }),
      this.db.publishJob.update({
        where: { id },
        data: { state: "SUCCEEDED", finishedAt: new Date(), error: null },
      }),
      this.db.articleEvent.create({
        data: {
          articleId: a.id,
          from: "PUBLISHING",
          to: "PUBLISHED",
          reason: "Blogger confirmed live publication.",
        },
      }),
      this.db.integration.update({
        where: { provider: "google" },
        data: { liveTestSucceededAt: i.liveTestSucceededAt || new Date() },
      }),
      this.db.auditLog.create({
        data: { action: "PUBLISHED", entityId: a.id, message: remote.url },
      }),
    ]);
  }
  async recordFailure(id: string, error: Error, permanent: boolean) {
    return this.db.$transaction(async (tx) => {
      const j = await tx.publishJob.findUnique({ where: { id } });
      if (!j) return;
      if (["SUCCEEDED", "MOCK_SUCCEEDED", "CANCELED"].includes(j.state)) return;
      await tx.publishJob.update({
        where: { id },
        data: {
          error: error.message.slice(0, 1000),
          ...(permanent ? { state: "FAILED", finishedAt: new Date() } : {}),
        },
      });
      if (permanent) {
        const article = await tx.article.findUniqueOrThrow({
          where: { id: j.articleId },
        });
        await tx.article.updateMany({
          where: {
            id: j.articleId,
            status: { in: ["SCHEDULED", "PUBLISHING"] },
          },
          data: { status: "FAILED" },
        });
        if (["SCHEDULED", "PUBLISHING"].includes(article.status))
          await tx.articleEvent.create({
            data: {
              articleId: article.id,
              from: article.status,
              to: "FAILED",
              reason: error.message.slice(0, 1000),
            },
          });
        await tx.auditLog.create({
          data: {
            action: "PUBLICATION_FAILED",
            entityId: j.articleId,
            message: error.message.slice(0, 1000),
          },
        });
      }
    });
  }
  private async assertAutomationActive() {
    const s = await this.db.automationSettings.findUniqueOrThrow({
      where: { id: "owner" },
    });
    if (s.paused || s.emergencyStop)
      throw new DeferredPublication(
        "Publication deferred by owner automation controls.",
      );
  }
  async retry(id: string) {
    const j = await this.db.publishJob.findUniqueOrThrow({ where: { id } });
    if (j.state !== "FAILED")
      throw new BadRequestException(
        "Only permanently failed jobs can be retried.",
      );
    const a = await this.articles.get(j.articleId);
    if (a.draftAttemptedAt && !a.remotePostId)
      throw new BadRequestException(
        "Reconcile the uncertain remote draft first.",
      );
    await this.articles.transition(
      a.id,
      "APPROVED",
      "Owner requested retry after reviewing failure.",
    );
    return this.schedule(a.id, new Date().toISOString(), j.liveTest);
  }
  async reconcileRemote(id: string, postId: string, confirmation: string) {
    if (confirmation !== "LINK EXISTING BLOGGER POST")
      throw new BadRequestException(
        "Confirm LINK EXISTING BLOGGER POST after checking the remote draft.",
      );
    return this.db.$transaction(
      async (lock) => {
        await lock.$executeRaw`SELECT pg_advisory_xact_lock(8172142)`;
        const a = await this.articles.get(id);
        if (a.status !== "FAILED" || !a.draftAttemptedAt)
          throw new BadRequestException(
            "Only a failed article with a recorded draft attempt can be reconciled.",
          );
        const i = await this.db.integration.findUnique({
          where: { provider: "google" },
        });
        if (!i?.blogId || !a.remoteBlogId || a.remoteBlogId !== i.blogId)
          throw new BadRequestException(
            "Reconnect the exact blog used by the original draft attempt.",
          );
        await this.blogger.getPost(i.blogId, postId);
        await this.db.article.update({
          where: { id },
          data: { remotePostId: postId },
        });
        await this.db.auditLog.create({
          data: {
            action: "REMOTE_DRAFT_RECONCILED",
            entityId: id,
            message: `Owner linked verified remote post ${postId}; retry will reuse it.`,
          },
        });
        return { ok: true };
      },
      { timeout: 60000 },
    );
  }
}
