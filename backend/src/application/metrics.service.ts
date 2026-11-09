import { BadRequestException, Injectable } from "@nestjs/common";
import { DateTime } from "luxon";
import { parse } from "csv-parse/sync";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { PrismaService } from "../infrastructure/prisma.service";
import { FinanceDto, TrafficDto } from "../api/dtos";
import { summarizeFinance } from "../domain/finance";
import { randomUUID } from "node:crypto";
import { reportingRange } from "../domain/reporting";
@Injectable()
export class MetricsService {
  constructor(private readonly db: PrismaService) {}
  async searchTraffic(
    rows: {
      date: string;
      url: string;
      impressions?: number;
      clicks?: number;
    }[],
  ) {
    if (rows.length > 100000)
      throw new BadRequestException(
        "Narrow the report date range to import fewer than 100,000 rows.",
      );
    const unique = new Map<
      string,
      {
        id: string;
        date: string;
        url: string;
        impressions: number | null;
        clicks: number | null;
      }
    >();
    for (const row of rows) {
      if (
        !reportingRange(row.date, row.date) ||
        !/^https?:\/\//.test(row.url) ||
        row.url.length > 2048 ||
        [row.impressions, row.clicks].some(
          (v) =>
            v !== undefined &&
            (!Number.isSafeInteger(v) || v < 0 || v > 2147483647),
        ) ||
        (row.clicks !== undefined &&
          row.impressions !== undefined &&
          row.clicks > row.impressions)
      )
        throw new BadRequestException(
          "Google returned invalid search metrics. Existing traffic records are retained.",
        );
      if (row.clicks === undefined && row.impressions === undefined) continue;
      unique.set(row.date + "\n" + row.url, {
        id: randomUUID(),
        date: row.date,
        url: row.url,
        clicks: row.clicks ?? null,
        impressions: row.impressions ?? null,
      });
    }
    if (!unique.size) return 0;
    // One parameterized statement commits the whole validated report atomically.
    // Missing fields never overwrite known values, and repeated imports upsert.
    await this.db.$executeRaw`
      INSERT INTO "TrafficMetric" ("id", "date", "url", "source", "impressions", "clicks")
      SELECT r.id, r.date::date, r.url, 'SEARCH_CONSOLE', r.impressions, r.clicks
      FROM jsonb_to_recordset(${JSON.stringify([...unique.values()])}::jsonb)
        AS r(id text, date text, url text, impressions integer, clicks integer)
      ON CONFLICT ("date", "url", "source") DO UPDATE SET
        "impressions" = COALESCE(EXCLUDED."impressions", "TrafficMetric"."impressions"),
        "clicks" = COALESCE(EXCLUDED."clicks", "TrafficMetric"."clicks")
    `;
    return unique.size;
  }
  async finance(dto: FinanceDto) {
    if (dto.source.toLowerCase().includes("sample"))
      throw new BadRequestException(
        "Sample earnings must not be entered as actual financial records.",
      );
    return this.db.$transaction(async (tx) => {
      const entry = await tx.financeEntry.create({
        data: { ...dto, date: new Date(dto.date.slice(0, 10) + "T00:00:00Z") },
      });
      await tx.auditLog.create({
        data: {
          action: "FINANCE_ENTRY",
          entityId: entry.id,
          message: `${dto.kind}: ${dto.reference} (${dto.source})`,
        },
      });
      return entry;
    });
  }
  async traffic(dto: TrafficDto) {
    if (
      dto.clicks !== undefined &&
      dto.impressions !== undefined &&
      dto.clicks > dto.impressions
    )
      throw new BadRequestException(
        "Clicks cannot exceed impressions for the same record.",
      );
    const date = new Date(dto.date.slice(0, 10) + "T00:00:00Z");
    const data = { ...dto, date, url: dto.url || "" };
    return this.db.trafficMetric.upsert({
      where: { date_url_source: { date, url: data.url, source: dto.source } },
      create: data,
      update: data,
    });
  }
  async importCsv(csv: string, type: "finance" | "traffic") {
    let rows: Record<string, string>[];
    try {
      rows = parse(csv, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        max_record_size: 10000,
      });
    } catch {
      throw new BadRequestException(
        "Invalid CSV. Use the documented column headers.",
      );
    }
    if (rows.length > 1000)
      throw new BadRequestException("Import at most 1,000 rows.");
    const dtos = rows.map((row, i) => {
      const allowed =
        type === "finance"
          ? [
              "date",
              "kind",
              "category",
              "amount",
              "reference",
              "source",
              "note",
            ]
          : ["date", "url", "pageviews", "impressions", "clicks", "source"];
      if (Object.keys(row).some((k) => !allowed.includes(k)))
        throw new BadRequestException(`Row ${i + 2}: unexpected column.`);
      const obj: Record<string, unknown> = { ...row };
      for (const key of ["amount", "pageviews", "impressions", "clicks"])
        if (key in obj) {
          if (obj[key] === "") delete obj[key];
          else obj[key] = Number(obj[key]);
        }
      const dto =
        type === "finance"
          ? plainToInstance(FinanceDto, obj)
          : plainToInstance(TrafficDto, obj);
      if (
        validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })
          .length
      )
        throw new BadRequestException(`Row ${i + 2}: invalid values.`);
      return dto;
    });
    // Validate the complete file before mutations; references/upsert keys make repeat imports idempotent.
    let imported = 0,
      skipped = 0;
    for (const dto of dtos) {
      if (type === "finance") {
        const d = dto as FinanceDto;
        if (
          await this.db.financeEntry.findUnique({
            where: { reference: d.reference },
          })
        ) {
          skipped++;
          continue;
        }
        await this.finance(d);
      } else await this.traffic(dto as TrafficDto);
      imported++;
    }
    return { imported, skipped };
  }
  async overview(month?: string) {
    const m =
      month && /^\d{4}-\d{2}$/.test(month)
        ? DateTime.fromFormat(month, "yyyy-MM", { zone: "Asia/Colombo" })
        : DateTime.now().setZone("Asia/Colombo");
    if (!m.isValid) throw new BadRequestException("Invalid month.");
    const start = new Date(m.toFormat("yyyy-MM") + "-01T00:00:00Z");
    const end = new Date(
      m.plus({ months: 1 }).toFormat("yyyy-MM") + "-01T00:00:00Z",
    );
    const prevStart = new Date(
      m.minus({ months: 1 }).toFormat("yyyy-MM") + "-01T00:00:00Z",
    );
    const [groups, entries, traffic, ai, jobs, articles, previousEntries] =
      await Promise.all([
        this.db.article.groupBy({ by: ["status"], _count: true }),
        this.db.financeEntry.findMany({
          where: { date: { gte: start, lt: end } },
          orderBy: { date: "asc" },
        }),
        this.db.trafficMetric.findMany({
          where: { date: { gte: start, lt: end } },
          orderBy: { date: "asc" },
        }),
        this.db.aiUsage.findMany({
          where: {
            createdAt: {
              gte: m.startOf("month").toJSDate(),
              lt: m.plus({ months: 1 }).startOf("month").toJSDate(),
            },
          },
        }),
        this.db.publishJob.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        this.db.article.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
        this.db.financeEntry.findMany({
          where: { date: { gte: prevStart, lt: start } },
        }),
      ]);
    // Metric sources are intentionally not silently combined: choose GA over manual for pageviews,
    // Search Console over manual for search metrics, avoiding imported/API double counting.
    const viewSource = traffic.some((t) => t.source === "GOOGLE_ANALYTICS")
      ? "GOOGLE_ANALYTICS"
      : traffic.find((t) => t.pageviews !== null)?.source;
    const searchSource = traffic.some((t) => t.source === "SEARCH_CONSOLE")
      ? "SEARCH_CONSOLE"
      : traffic.find((t) => t.impressions !== null || t.clicks !== null)
          ?.source;
    const views = traffic.filter((t) => t.source === viewSource),
      search = traffic.filter((t) => t.source === searchSource);
    const pageviews = views.length
        ? views.reduce((n, t) => n + (t.pageviews || 0), 0)
        : null,
      impressions = search.some((t) => t.impressions !== null)
        ? search.reduce((n, t) => n + (t.impressions || 0), 0)
        : null,
      clicks = search.some((t) => t.clicks !== null)
        ? search.reduce((n, t) => n + (t.clicks || 0), 0)
        : null;
    const finance = summarizeFinance(
      entries,
      pageviews,
      ai.reduce((n, u) => n + Number(u.costUsd || 0), 0),
    );
    const previousRevenue = summarizeFinance(
      previousEntries,
      null,
    ).actualRevenue;
    const daily: Record<
      string,
      {
        date: string;
        revenue: number;
        expense: number;
        pageviews: number | null;
      }
    > = {};
    for (
      let d = m.startOf("month");
      d < m.plus({ months: 1 }).startOf("month");
      d = d.plus({ days: 1 })
    ) {
      const key = d.toISODate()!;
      daily[key] = { date: key, revenue: 0, expense: 0, pageviews: null };
    }
    for (const e of entries) {
      const key = e.date.toISOString().slice(0, 10);
      if (daily[key]) {
        if (e.kind === "ACTUAL_REVENUE") daily[key].revenue += Number(e.amount);
        if (e.kind === "EXPENSE") daily[key].expense += Number(e.amount);
      }
    }
    for (const t of views) {
      if (t.pageviews === null) continue;
      const key = t.date.toISOString().slice(0, 10);
      if (daily[key])
        daily[key].pageviews = (daily[key].pageviews || 0) + (t.pageviews || 0);
    }
    const byUrl = new Map<
      string,
      {
        url: string;
        pageviews: number | null;
        clicks: number | null;
        impressions: number | null;
      }
    >();
    for (const t of traffic) {
      if (!t.url) continue;
      const r = byUrl.get(t.url) || {
        url: t.url,
        pageviews: null,
        clicks: null,
        impressions: null,
      };
      if (t.source === viewSource && t.pageviews !== null)
        r.pageviews = (r.pageviews || 0) + t.pageviews;
      if (t.source === searchSource) {
        if (t.clicks !== null) r.clicks = (r.clicks || 0) + t.clicks;
        if (t.impressions !== null)
          r.impressions = (r.impressions || 0) + t.impressions;
      }
      byUrl.set(t.url, r);
    }
    const finished = jobs.filter(
      (j) => j.mode === "live" && ["SUCCEEDED", "FAILED"].includes(j.state),
    );
    return {
      month: m.toFormat("yyyy-MM"),
      counts: Object.fromEntries(groups.map((g) => [g.status, g._count])),
      totalArticles: groups.reduce((n, g) => n + g._count, 0),
      finance,
      traffic: {
        pageviews,
        impressions,
        clicks,
        ctr:
          impressions && clicks !== null ? (clicks / impressions) * 100 : null,
        viewSource: viewSource || null,
        searchSource: searchSource || null,
      },
      daily: Object.values(daily),
      topArticles: [...byUrl.values()]
        .sort((a, b) => (b.pageviews || 0) - (a.pageviews || 0))
        .slice(0, 10),
      recentArticles: articles,
      entries,
      jobs,
      aiUsage: ai,
      publishingSuccessRate: finished.length
        ? (finished.filter((j) => j.state === "SUCCEEDED").length /
            finished.length) *
          100
        : null,
      goals: {
        initial: 10,
        stretch: 30,
        longTerm: 100,
        progress: Math.min(100, (finance.actualRevenue / 10) * 100),
      },
      monthOverMonth:
        previousRevenue > 0
          ? ((finance.actualRevenue - previousRevenue) / previousRevenue) * 100
          : null,
      hasFinancialRecords:
        entries.length > 0 || ai.some((u) => u.costUsd !== null),
      sources: [
        "Owner manual / CSV records",
        "Recorded AI usage",
        "Authorized Google reporting when connected",
      ],
      timezone: "Asia/Colombo",
    };
  }
}
