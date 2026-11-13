import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { PrismaService } from "../infrastructure/prisma.service";
import { validSearchProperty } from "../domain/indexing";

export function weeklyReviewWindow(now: Date) {
  const end = DateTime.fromJSDate(now, { zone: "Asia/Colombo" }).startOf("day");
  const start = end.minus({ days: 7 });
  return {
    startDate: start.toISODate()!,
    endDate: end.minus({ days: 1 }).toISODate()!,
    start: start.toJSDate(),
    end: end.toJSDate(),
    timezone: "Asia/Colombo",
  };
}

@Injectable()
export class WeeklyReviewService {
  constructor(private readonly db: PrismaService) {}

  async summary(now = new Date()) {
    const window = weeklyReviewWindow(now);
    return this.db.$transaction(
      async (tx) => {
        const reporting = await tx.reportingSettings.findUnique({
          where: { id: "owner" },
          select: { searchConsoleSiteUrl: true },
        });
        const property =
          reporting?.searchConsoleSiteUrl ||
          process.env.SEARCH_CONSOLE_SITE_URL?.trim() ||
          null;
        const siteUrl =
          property && validSearchProperty(property) ? property : null;
        const attemptSelect = {
          state: true,
          startDate: true,
          endDate: true,
          imported: true,
          startedAt: true,
          finishedAt: true,
          errorCode: true,
        } as const;
        const [
          published,
          needsReview,
          approved,
          scheduled,
          pastSchedules,
          settings,
          lastAttempt,
          lastSuccess,
          ad,
        ] = await Promise.all([
          tx.article.count({
            where: {
              status: "PUBLISHED",
              publishedAt: { gte: window.start, lt: window.end },
            },
          }),
          tx.article.count({ where: { status: "NEEDS_REVIEW" } }),
          tx.article.count({ where: { status: "APPROVED" } }),
          tx.article.findMany({
            where: { status: "SCHEDULED", scheduledAt: { gte: now } },
            orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
            take: 3,
            select: {
              id: true,
              title: true,
              scheduledAt: true,
              publishingTarget: true,
              remoteStatus: true,
            },
          }),
          tx.article.count({
            where: { status: "SCHEDULED", scheduledAt: { lt: now } },
          }),
          tx.automationSettings.findUnique({
            where: { id: "owner" },
            select: { paused: true, emergencyStop: true },
          }),
          siteUrl
            ? tx.trafficSync.findFirst({
                where: { siteUrl },
                orderBy: [{ startedAt: "desc" }, { id: "desc" }],
                select: attemptSelect,
              })
            : null,
          siteUrl
            ? tx.trafficSync.findFirst({
                where: { siteUrl, state: { in: ["SUCCEEDED", "EMPTY"] } },
                orderBy: [{ startedAt: "desc" }, { id: "desc" }],
                select: attemptSelect,
              })
            : null,
          tx.adReport.findFirst({
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              filename: true,
              scopeLabel: true,
              timezoneLabel: true,
              createdAt: true,
              report: true,
            },
          }),
        ]);
        const attempt = (value: typeof lastAttempt) =>
          value
            ? {
                ...value,
                startDate: value.startDate.toISOString().slice(0, 10),
                endDate: value.endDate.toISOString().slice(0, 10),
              }
            : null;
        const payload = ad?.report as
          | {
              rows?: { date?: string }[];
              impressions?: unknown;
              clicks?: unknown;
              revenue?: unknown;
            }
          | undefined;
        const rows = Array.isArray(payload?.rows) ? payload.rows : [];
        const valid =
          rows.length > 0 &&
          rows.every(
            (row) =>
              typeof row?.date === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(row.date),
          ) &&
          [payload?.impressions, payload?.clicks, payload?.revenue].every(
            (value) =>
              typeof value === "number" && Number.isFinite(value) && value >= 0,
          );
        const adReport = ad
          ? {
              id: ad.id,
              filename: ad.filename,
              scopeLabel: ad.scopeLabel,
              timezoneLabel: ad.timezoneLabel,
              savedAt: ad.createdAt,
              summary: valid
                ? {
                    startDate: rows[0].date!,
                    endDate: rows.at(-1)!.date!,
                    reportedDates: rows.length,
                    impressions: payload!.impressions as number,
                    clicks: payload!.clicks as number,
                    revenue: payload!.revenue as number,
                  }
                : null,
            }
          : null;
        const actions: { label: string; href: string }[] = [];
        if (settings?.emergencyStop)
          actions.push({
            label: "Review the emergency stop",
            href: "/automation",
          });
        if (pastSchedules)
          actions.push({
            label: `Check ${pastSchedules} past schedules awaiting status confirmation`,
            href: "/calendar",
          });
        if (needsReview)
          actions.push({
            label: `Review ${needsReview} draft${needsReview === 1 ? "" : "s"}`,
            href: "/articles",
          });
        if (approved)
          actions.push({
            label: `Choose a publication time for ${approved} approved article${approved === 1 ? "" : "s"}`,
            href: "/articles",
          });
        if (!needsReview && !approved && !scheduled.length && !pastSchedules)
          actions.push({
            label: "Plan the next useful tutorial",
            href: "/planner",
          });
        if (!siteUrl)
          actions.push({
            label: "Choose a Search Console property",
            href: "/connections",
          });
        else
          actions.push({
            label:
              lastAttempt?.state === "FAILED"
                ? "Review the latest search import failure"
                : "Review saved search reporting",
            href: "/analytics",
          });
        actions.push({
          label: adReport
            ? "Review saved ad report results"
            : "Save an official ad report",
          href: "/monetization",
        });
        return {
          generatedAt: now.toISOString(),
          window: {
            startDate: window.startDate,
            endDate: window.endDate,
            timezone: window.timezone,
          },
          publishing: {
            published,
            needsReview,
            approved,
            scheduled,
            pastSchedules,
            paused: settings?.paused ?? null,
            emergencyStop: settings?.emergencyStop ?? null,
          },
          search: {
            siteUrl,
            lastAttempt: attempt(lastAttempt),
            lastSuccess: attempt(lastSuccess),
          },
          adReport,
          actions,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
