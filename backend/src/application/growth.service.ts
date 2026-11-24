import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DateTime } from "luxon";
import { PrismaService } from "../infrastructure/prisma.service";
import { GoogleService } from "../infrastructure/blogger.service";
import { AnalyticsAdapter } from "../infrastructure/analytics.adapter";
import { SearchConsoleAdapter } from "../infrastructure/search-console.adapter";
import { AnalyticsConnectionService } from "./analytics-connection.service";
import { SearchConsoleService } from "./search-console.service";
import { analyticsHost } from "../domain/analytics";
import { promotionPack, searchOpportunities } from "../domain/growth";
import { suggestInternalLinks } from "../domain/internal-links";
import { linkKey } from "../domain/internal-links";
import { createHash } from "node:crypto";

@Injectable()
export class GrowthService {
  constructor(
    private readonly db: PrismaService,
    private readonly google: GoogleService,
    private readonly ga: AnalyticsConnectionService,
    private readonly analytics: AnalyticsAdapter,
    private readonly search: SearchConsoleService,
    private readonly searchAdapter: SearchConsoleAdapter,
  ) {}
  async articles() {
    return this.db.article.findMany({
      where: { status: "PUBLISHED", publishedUrl: { not: null } },
      select: { id: true, title: true, publishedAt: true },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: 500,
    });
  }
  async plan(query: string, url: string) {
    if (!query.trim()) throw new BadRequestException("Enter a reader query.");
    const integration = await this.db.integration.findUnique({
      where: { provider: "google" },
      select: { blogUrl: true },
    });
    if (!integration?.blogUrl || !linkKey(url, integration.blogUrl))
      throw new BadRequestException("Choose a query for the selected blog.");
    const canonical = linkKey(url, integration.blogUrl)!;
    const slug =
      "search-brief-" +
      createHash("sha256")
        .update(canonical + "\n" + query.trim())
        .digest("hex")
        .slice(0, 24);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172290)`;
      const existing = await tx.article.findUnique({ where: { slug } });
      if (existing) return { id: existing.id, created: false };
      const article = await tx.article.create({
        data: {
          slug,
          title: `Research: ${query.trim()}`.slice(0, 180),
          niche: "Search-led research",
          intent: `Investigate the reader question: ${query.trim()}. First check whether the existing article ${canonical} already answers it.`,
          planningNotes: `Saved from a Search Console query suggestion. Existing page: ${canonical}\nVerify demand and add primary sources before drafting. This is a research brief, not a verified claim or publication approval.`,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "SEARCH_RESEARCH_BRIEF_CREATED",
          entityId: article.id,
          message:
            "Private research brief created; no generation or publication requested.",
        },
      });
      return { id: article.id, created: true };
    });
  }
  async pack(id: string) {
    const [article, integration, candidates] = await Promise.all([
      this.db.article.findUnique({ where: { id } }),
      this.db.integration.findUnique({
        where: { provider: "google" },
        select: { blogUrl: true },
      }),
      this.db.article.findMany({
        where: { status: "PUBLISHED", publishedUrl: { not: null } },
        orderBy: { publishedAt: "desc" },
        take: 500,
      }),
    ]);
    if (!article || article.status !== "PUBLISHED" || !article.publishedUrl)
      throw new NotFoundException("Choose a confirmed published article.");
    if (!integration?.blogUrl)
      throw new BadRequestException(
        "Select your owned blog in Blog connections.",
      );
    try {
      return {
        ...promotionPack(
          { ...article, publishedUrl: article.publishedUrl },
          integration.blogUrl,
        ),
        related: suggestInternalLinks(article, candidates, integration.blogUrl),
        note: "Prepared from saved article text. Review the summary and community rules before sharing. UTM links measure attributed GA4 sessions, not raw link clicks. Related links are suggestions; published posts are unchanged.",
      };
    } catch {
      throw new BadRequestException(
        "The article URL must belong to the selected blog.",
      );
    }
  }
  private cache = new Map<string, { at: number; data: unknown }>();
  private pending = new Map<string, Promise<unknown>>();
  async report(days: number) {
    if (![7, 28, 90].includes(days))
      throw new BadRequestException("Choose 7, 28 or 90 completed days.");
    const [config, permissions, property] = await Promise.all([
      this.ga.configuration(),
      this.google.reportingPermissions(),
      this.search.property(),
    ]);
    const host = analyticsHost(config.blogUrl);
    const key = JSON.stringify([
      days,
      host,
      config.propertyId,
      config.revision,
      permissions,
      property,
    ]);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < 5 * 60000) return cached.data;
    if (this.pending.has(key)) return this.pending.get(key);
    const run = this.read(days, config, permissions, property, host);
    this.pending.set(key, run);
    try {
      const data = await run;
      this.cache.clear();
      this.cache.set(key, { at: Date.now(), data });
      return data;
    } finally {
      this.pending.delete(key);
    }
  }
  private async read(
    days: number,
    config: Awaited<ReturnType<AnalyticsConnectionService["configuration"]>>,
    permissions: { analytics: boolean; searchConsole: boolean },
    property: string | null,
    host: string | null,
  ) {
    const range = (zone: string) => {
      const end = DateTime.now()
        .setZone(zone)
        .startOf("day")
        .minus({ days: 1 });
      return {
        start: end.minus({ days: days - 1 }).toISODate()!,
        end: end.toISODate()!,
      };
    };
    const zone =
      config.propertyTimeZone &&
      DateTime.now().setZone(config.propertyTimeZone).isValid
        ? config.propertyTimeZone
        : "UTC";
    const gaRange = range(zone),
      searchRange = range("America/Los_Angeles");
    const dimensions = [
      "country",
      "sessionSourceMedium",
      "sessionCampaignName",
      "pagePath",
    ] as const;
    const reports = await Promise.all(
      dimensions.map(async (dimension) => {
        if (
          !config.configured ||
          !permissions.analytics ||
          !host ||
          !config.propertyId
        )
          return {
            dimension,
            status: "NOT_CONNECTED",
            rows: [],
            note: "Configure Analytics and grant read access in Blog connections.",
          };
        try {
          const data = await this.analytics.audience(
            config.propertyId,
            host,
            gaRange.start,
            gaRange.end,
            dimension,
          );
          const rows = (data.rows || []).map((row) => {
            const values = row.metricValues?.map((v) => Number(v.value)) || [];
            if (
              values.length !== 4 ||
              values.some((v) => !Number.isFinite(v) || v < 0) ||
              values[2] > 1
            )
              throw new Error("Invalid report");
            return {
              label: row.dimensionValues?.[0]?.value || "(not set)",
              sessions: values[0],
              engagedSessions: values[1],
              engagementRate: values[2],
              pageviews: values[3],
            };
          });
          return {
            dimension,
            status: rows.length ? "OK" : "EMPTY",
            rows,
            thresholded: !!data.metadata?.subjectToThresholding,
            truncated: (data.rowCount || 0) > rows.length,
            note: "Top 20 rows from GA4, filtered to your blog hostname. Breakdown rows are not combined into site totals.",
          };
        } catch {
          return {
            dimension,
            status: "ERROR",
            rows: [],
            note: "Google could not read this breakdown. Check Analytics access, API availability or quota; other reports remain available.",
          };
        }
      }),
    );
    let opportunities: ReturnType<typeof searchOpportunities> = [];
    let searchStatus = "NOT_CONNECTED",
      searchNote =
        "Connect your verified Search Console property and read access.";
    if (permissions.searchConsole && property && host) {
      try {
        const data = await this.searchAdapter.queries(
          property,
          searchRange.start,
          searchRange.end,
        );
        opportunities = searchOpportunities(data.rows || [], config.blogUrl!);
        searchStatus = opportunities.length ? "OK" : "EMPTY";
        searchNote =
          "Suggestions use the top 250 final query/page rows returned by Google. Private queries and other rows may be omitted; these are improvement ideas, not guaranteed demand or rankings.";
      } catch {
        searchStatus = "ERROR";
        searchNote =
          "Google could not read search queries. Check Search Console access, selected property or quota.";
      }
    }
    return {
      generatedAt: new Date().toISOString(),
      days,
      blogUrl: config.blogUrl,
      gaRange,
      gaTimeZone: zone,
      searchRange,
      audience: reports,
      queries: { rows: opportunities, status: searchStatus, note: searchNote },
      note: "Reports can lag and omit data. Empty results do not prove zero traffic. Campaign sessions indicate attributed visits, not link-click counts, ad clicks or earnings. Reads are cached for five minutes.",
    };
  }
}
