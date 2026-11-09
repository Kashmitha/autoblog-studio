import { BadRequestException, Injectable } from "@nestjs/common";
import { DateTime } from "luxon";
import { PrismaService } from "../infrastructure/prisma.service";
import {
  articlePerformance,
  csvCell,
  performanceUrl,
} from "../domain/performance";

@Injectable()
export class PerformanceService {
  constructor(private readonly db: PrismaService) {}
  async report(input?: string) {
    if (input !== undefined && !["7", "28", "90"].includes(input))
      throw new BadRequestException("Choose 7, 28 or 90 days.");
    const days = Number(input || 28);
    // Calendar arithmetic handles Pacific daylight-saving boundaries. Stored
    // traffic rows are date labels, not timestamps to shift into Colombo time.
    const end = DateTime.now()
      .setZone("America/Los_Angeles")
      .startOf("day")
      .minus({ days: 1 });
    const start = end.minus({ days: days - 1 });
    const previousEnd = start.minus({ days: 1 });
    const previousStart = start.minus({ days });
    const [articles, totalPublished, metrics] = await Promise.all([
      this.db.article.findMany({
        where: { status: "PUBLISHED", publishedUrl: { not: null } },
        select: {
          id: true,
          title: true,
          publishedUrl: true,
          publishedAt: true,
        },
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
        take: 500,
      }),
      this.db.article.count({
        where: { status: "PUBLISHED", publishedUrl: { not: null } },
      }),
      this.db.trafficMetric.findMany({
        where: {
          date: {
            gte: new Date(previousStart.toISODate()! + "T00:00:00Z"),
            lte: new Date(end.toISODate()! + "T00:00:00Z"),
          },
          url: { not: "" },
        },
        select: {
          date: true,
          url: true,
          source: true,
          pageviews: true,
          impressions: true,
          clicks: true,
        },
        take: 100001,
      }),
    ]);
    if (metrics.length > 100000)
      throw new BadRequestException(
        "Too many traffic rows for this comparison. Choose a shorter period.",
      );
    const byUrl = new Map<string, typeof metrics>();
    for (const metric of metrics) {
      const key = performanceUrl(metric.url);
      if (key) {
        const group = byUrl.get(key) || [];
        group.push(metric);
        byUrl.set(key, group);
      }
    }
    const rows = articles
      .map((article) => ({
        articleId: article.id,
        title: article.title,
        url: article.publishedUrl!,
        publishedAt: article.publishedAt,
        ...articlePerformance(
          byUrl.get(performanceUrl(article.publishedUrl!) || "") || [],
          start.toISODate()!,
        ),
      }))
      .sort(
        (a, b) =>
          (b.current.clicks ?? -1) - (a.current.clicks ?? -1) ||
          (b.current.impressions ?? -1) - (a.current.impressions ?? -1) ||
          a.title.localeCompare(b.title),
      );
    return {
      generatedAt: new Date(),
      days,
      current: { start: start.toISODate()!, end: end.toISODate()! },
      previous: {
        start: previousStart.toISODate()!,
        end: previousEnd.toISODate()!,
      },
      dateConvention:
        "Comparison dates end yesterday in Google Pacific Time. Search Console uses Pacific dates; Analytics and CSV rows retain their source date labels.",
      note: "Totals include recorded URL-level rows only. Missing days and metrics remain unknown; no data does not mean zero traffic. Sources are never added together. These results do not confirm current indexing or attribute site-wide ad revenue to an article.",
      totalPublished,
      truncated: totalPublished > rows.length,
      articles: rows,
    };
  }
  async csv(days?: string) {
    const report = await this.report(days);
    const columns = [
      "article_title",
      "public_url",
      "published_at",
      "current_start",
      "current_end",
      "previous_start",
      "previous_end",
      "pageviews",
      "previous_pageviews",
      "impressions",
      "previous_impressions",
      "clicks",
      "previous_clicks",
      "ctr_percent",
      "click_change",
      "click_change_percent",
      "pageview_source",
      "search_source",
      "current_days_reported",
      "previous_days_reported",
      "latest_reported_date",
    ];
    const rows = report.articles.map((a) => [
      a.title,
      a.url,
      a.publishedAt?.toISOString(),
      report.current.start,
      report.current.end,
      report.previous.start,
      report.previous.end,
      a.current.pageviews,
      a.previous.pageviews,
      a.current.impressions,
      a.previous.impressions,
      a.current.clicks,
      a.previous.clicks,
      a.current.ctr,
      a.changes.clicks?.absolute,
      a.changes.clicks?.percent,
      a.viewSource,
      a.searchSource,
      a.current.daysReported,
      a.previous.daysReported,
      a.current.latestReportedDate,
    ]);
    return {
      days: report.days,
      csv:
        "\uFEFF" +
        [columns, ...rows]
          .map((row) => row.map(csvCell).join(","))
          .join("\r\n") +
        "\r\n",
    };
  }
}
