import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { PrismaService } from "../infrastructure/prisma.service";
import {
  GoogleService,
  LiveBloggerAdapter,
} from "../infrastructure/blogger.service";
import { ArticlesService } from "./articles.service";
import { publicationHtml } from "../domain/publication";
import { env } from "../config";

type Remote = Awaited<ReturnType<LiveBloggerAdapter["getPost"]>>;
const uncertainMessage =
  "Blogger may have accepted this request. Sync status or link the existing post before trying anything else; no automatic retry will create another post.";

@Injectable()
export class CloudPublishingService {
  constructor(
    private readonly db: PrismaService,
    private readonly articles: ArticlesService,
    private readonly blogger: LiveBloggerAdapter,
    private readonly google: GoogleService,
  ) {}

  private locked<T>(work: () => Promise<T>) {
    // Share the publication lock with the local worker. Remote intent writes are
    // committed separately, so a crash cannot erase evidence of an attempted write.
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172142)`;
        return work();
      },
      { timeout: 180000, maxWait: 180000 },
    );
  }
  private async integration(requirePublishingCheckpoint = true) {
    if (env.bloggerMode !== "live")
      throw new BadRequestException(
        "Blogger scheduling is available in live mode only.",
      );
    const i = await this.db.integration.findUnique({
      where: { provider: "google" },
    });
    if (!i?.blogId)
      throw new BadRequestException(
        "Select your connected Blogger blog first.",
      );
    if (
      requirePublishingCheckpoint &&
      (!i.firstLiveTestAuthorizedAt || !i.liveTestSucceededAt)
    )
      throw new BadRequestException(
        "Complete the connected blog's first live publishing test before scheduling on Blogger.",
      );
    return { ...i, blogId: i.blogId };
  }
  async schedule(id: string, at: string) {
    const date = new Date(at);
    if (
      !Number.isFinite(date.getTime()) ||
      date.getTime() < Date.now() + 5 * 60000
    )
      throw new BadRequestException(
        "Choose a publication time at least five minutes in the future.",
      );
    return this.locked(async () => {
      const i = await this.integration();
      const a = await this.articles.get(id);
      if (
        a.status !== "APPROVED" ||
        !a.approvedAt ||
        a.publishingTarget === "blogger" ||
        a.remotePostId ||
        a.draftAttemptedAt
      )
        throw new ConflictException(
          "Only an approved article without an existing remote post or uncertain draft attempt can be sent. Link or sync an existing Blogger post instead.",
        );
      const settings = await this.db.automationSettings.findUniqueOrThrow({
        where: { id: "owner" },
      });
      if (settings.emergencyStop)
        throw new ConflictException("Emergency stop is enabled.");
      const day = DateTime.fromJSDate(date).setZone(settings.timezone);
      const count = await this.db.publishJob.count({
        where: {
          scheduledAt: {
            gte: day.startOf("day").toJSDate(),
            lte: day.endOf("day").toJSDate(),
          },
          state: { notIn: ["CANCELED", "FAILED"] },
        },
      });
      if (count >= settings.dailyLimit)
        throw new ConflictException(
          "The publication limit for that day is already reserved.",
        );
      if (!(await this.articles.quality(id)).passed)
        throw new BadRequestException(
          "Resolve the quality checks before scheduling.",
        );
      const existing = await this.google.posts();
      if (existing.some((p) => p.title?.trim() === a.title.trim()))
        throw new ConflictException(
          "A post with this title already exists on Blogger. Link that post instead of creating another.",
        );
      const job = await this.db.$transaction(async (tx) => {
        const changed = await tx.article.updateMany({
          where: {
            id,
            status: "APPROVED",
            version: a.version,
            publishingTarget: "local",
          },
          data: {
            status: "PUBLISHING",
            publishingTarget: "blogger",
            scheduledAt: date,
            remoteBlogId: i.blogId,
            draftAttemptedAt: new Date(),
            remoteSyncError: null,
          },
        });
        if (!changed.count)
          throw new ConflictException(
            "The article changed. Refresh before scheduling.",
          );
        await tx.articleEvent.create({
          data: {
            articleId: id,
            from: "APPROVED",
            to: "PUBLISHING",
            reason:
              "Owner requested Blogger-hosted scheduling; recording upload intent before contacting Google.",
          },
        });
        await tx.auditLog.create({
          data: {
            action: "BLOGGER_SCHEDULE_REQUESTED",
            entityId: id,
            message: `Owner requested future publication at ${date.toISOString()}; no local publishing job will run.`,
          },
        });
        return tx.publishJob.create({
          data: {
            articleId: id,
            key: `cloud-${id}-${randomBytes(8).toString("hex")}`,
            mode: "live",
            target: "blogger",
            blogId: i.blogId,
            state: "CLOUD_PREPARING",
            attempts: 1,
            startedAt: new Date(),
            scheduledAt: date,
          },
        });
      });
      try {
        const postId = await this.blogger.createDraft(
          i.blogId,
          a.title,
          publicationHtml(a),
          a.labels,
        );
        await this.db.article.update({
          where: { id },
          data: { remotePostId: postId },
        });
        // Recheck the emergency stop after upload and immediately before handing
        // the future publication to Google. A paused local worker is independent.
        const latest = await this.db.automationSettings.findUniqueOrThrow({
          where: { id: "owner" },
        });
        if (latest.emergencyStop) throw new Error("Stopped before scheduling");
        const selected = await this.db.integration.findUnique({
          where: { provider: "google" },
        });
        if (selected?.blogId !== i.blogId || !selected.liveTestSucceededAt)
          throw new Error("Selected blog changed during upload");
        if (date.getTime() < Date.now() + 60000)
          throw new Error("Schedule is too close after upload");
        const remote = await this.blogger.schedulePost(
          i.blogId,
          postId,
          date.toISOString(),
        );
        if (
          remote.status !== "SCHEDULED" ||
          !remote.published ||
          Math.abs(new Date(remote.published).getTime() - date.getTime()) > 1000
        )
          throw new Error("Remote schedule was not confirmed");
        await this.applyRemote(id, remote);
        return this.articles.get(id);
      } catch {
        await this.db.$transaction([
          this.db.publishJob.update({
            where: { id: job.id },
            data: { state: "CLOUD_UNCERTAIN", error: uncertainMessage },
          }),
          this.db.article.update({
            where: { id },
            data: { remoteSyncError: uncertainMessage },
          }),
        ]);
        throw new BadRequestException(uncertainMessage);
      }
    });
  }
  async link(id: string, postId: string, confirmation: string) {
    if (confirmation !== "LINK EXISTING BLOGGER POST")
      throw new BadRequestException(
        "Confirm LINK EXISTING BLOGGER POST after checking the title and date.",
      );
    return this.locked(async () => {
      const i = await this.integration();
      const a = await this.articles.get(id);
      if (a.publishingTarget === "blogger" && a.remotePostId === postId) {
        return this.syncOneLocked(id);
      }
      const recovery =
        a.publishingTarget === "blogger" &&
        a.status === "PUBLISHING" &&
        !a.remotePostId &&
        !!a.draftAttemptedAt;
      if (
        (a.status !== "APPROVED" && !recovery) ||
        !a.approvedAt ||
        (a.remotePostId && a.remotePostId !== postId) ||
        (a.remoteBlogId && a.remoteBlogId !== i.blogId)
      )
        throw new ConflictException(
          "This article cannot be linked to that post. Inspect its current publication first.",
        );
      if (
        await this.db.publishJob.count({
          where: {
            articleId: id,
            target: "local",
            state: { in: ["PENDING", "RUNNING"] },
          },
        })
      )
        throw new ConflictException(
          "Cancel the local publication job before linking Blogger.",
        );
      const remote = await this.blogger.getPost(i.blogId, postId);
      if (remote.title?.trim() !== a.title.trim())
        throw new ConflictException(
          "The remote title does not match this article. Review the selected post.",
        );
      if (!["SCHEDULED", "LIVE"].includes(remote.status))
        throw new BadRequestException(
          "Select a scheduled or published Blogger post.",
        );
      if (
        !remote.published ||
        !Number.isFinite(new Date(remote.published).getTime())
      )
        throw new BadRequestException(
          "Blogger did not return a valid publication date.",
        );
      const duplicate = await this.db.article.findUnique({
        where: { remotePostId: postId },
      });
      if (duplicate && duplicate.id !== id)
        throw new ConflictException(
          "That Blogger post is already linked to another article.",
        );
      await this.db.$transaction(async (tx) => {
        const changed = await tx.article.updateMany({
          where: {
            id,
            status: a.status,
            version: a.version,
            publishingTarget: a.publishingTarget,
            remotePostId: a.remotePostId,
          },
          data: {
            publishingTarget: "blogger",
            remoteBlogId: i.blogId,
            remotePostId: postId,
          },
        });
        if (!changed.count)
          throw new ConflictException("Article changed while linking.");
        if (!recovery)
          await tx.publishJob.create({
            data: {
              articleId: id,
              key: `linked-${id}-${randomBytes(8).toString("hex")}`,
              mode: "live",
              target: "blogger",
              blogId: i.blogId,
              state: "REMOTE_SCHEDULED",
              scheduledAt: new Date(remote.published!),
            },
          });
        await tx.auditLog.create({
          data: {
            action: "BLOGGER_POST_LINKED",
            entityId: id,
            message:
              "Owner linked an existing Blogger post; remote content and schedule were not modified.",
          },
        });
      });
      await this.applyRemote(id, remote);
      return this.articles.get(id);
    });
  }
  private async applyRemote(id: string, remote: Remote) {
    const a = await this.articles.get(id);
    if (a.remotePostId !== remote.id || a.publishingTarget !== "blogger")
      throw new ConflictException("Remote post identity changed.");
    const date = remote.published ? new Date(remote.published) : null;
    if (
      !["SCHEDULED", "LIVE", "DRAFT"].includes(remote.status) ||
      (remote.status !== "DRAFT" && (!date || !Number.isFinite(date.getTime())))
    )
      throw new BadRequestException(
        "Blogger returned an unsupported status or date; the previous status is retained.",
      );
    const status =
      remote.status === "LIVE"
        ? "PUBLISHED"
        : remote.status === "SCHEDULED"
          ? "SCHEDULED"
          : "FAILED";
    const error =
      remote.status === "DRAFT"
        ? "This post is a draft on Blogger and has no confirmed publishing schedule. Manage it on Blogger, then sync again."
        : null;
    await this.db.$transaction(async (tx) => {
      await tx.article.update({
        where: { id },
        data: {
          status,
          remoteStatus: remote.status,
          remoteSyncedAt: new Date(),
          remoteSyncError: error,
          scheduledAt: remote.status === "SCHEDULED" ? date : null,
          publishedAt: remote.status === "LIVE" ? date : null,
          publishedUrl: remote.url || null,
        },
      });
      await tx.publishJob.updateMany({
        where: { articleId: id, target: "blogger", state: { not: "CANCELED" } },
        data: {
          state:
            remote.status === "LIVE"
              ? "SUCCEEDED"
              : remote.status === "SCHEDULED"
                ? "REMOTE_SCHEDULED"
                : "CLOUD_UNCERTAIN",
          ...(date ? { scheduledAt: date } : {}),
          finishedAt: remote.status === "LIVE" ? date : null,
          error,
        },
      });
      if (a.status !== status)
        await tx.articleEvent.create({
          data: {
            articleId: id,
            from: a.status,
            to: status,
            reason: `Blogger confirmed ${remote.status}. Google handles any accepted future schedule independently of this computer.`,
          },
        });
    });
  }
  private async syncOneLocked(id: string) {
    // Read existing pinned posts even when new publication is not authorized.
    const i = await this.integration(false);
    const a = await this.articles.get(id);
    if (a.publishingTarget !== "blogger" || !a.remotePostId)
      throw new BadRequestException(
        "Link the remote Blogger post before syncing.",
      );
    if (a.remoteBlogId !== i.blogId)
      throw new ConflictException(
        "Select the exact blog used by this post before syncing.",
      );
    const remote = await this.blogger.getPost(i.blogId, a.remotePostId);
    await this.applyRemote(id, remote);
    return this.articles.get(id);
  }
  async sync(id?: string) {
    const candidates = id
      ? [{ id }]
      : await this.db.article.findMany({
          where: { publishingTarget: "blogger", remotePostId: { not: null } },
          select: { id: true },
          orderBy: { remoteSyncedAt: "asc" },
          take: 200,
        });
    const results: { id: string; status?: string; error?: string }[] = [];
    for (const a of candidates) {
      try {
        const synced = await this.locked(() => this.syncOneLocked(a.id));
        results.push({ id: a.id, status: synced.status });
      } catch {
        const error =
          "Could not confirm Blogger status. Check the connected account and selected blog, then sync again. The last confirmed status is retained.";
        await this.db.article.updateMany({
          where: { id: a.id, publishingTarget: "blogger" },
          data: { remoteSyncError: error },
        });
        results.push({ id: a.id, error });
      }
    }
    return { checkedAt: new Date().toISOString(), results };
  }
}
