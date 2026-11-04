import { BadRequestException, Injectable } from "@nestjs/common";
import { webmasters } from "googleapis/build/src/apis/webmasters";
import { analyticsdata } from "googleapis/build/src/apis/analyticsdata";
import { GoogleService } from "../infrastructure/blogger.service";
import { MetricsService } from "./metrics.service";
@Injectable()
export class ReportingService {
  constructor(
    private readonly google: GoogleService,
    private readonly metrics: MetricsService,
  ) {}
  private dates(start: string, end: string) {
    const s = new Date(start),
      e = new Date(end);
    if (
      !Number.isFinite(s.getTime()) ||
      !Number.isFinite(e.getTime()) ||
      s > e ||
      e.getTime() - s.getTime() > 93 * 86400000
    )
      throw new BadRequestException("Choose a date range of up to 93 days.");
    return { start: start.slice(0, 10), end: end.slice(0, 10) };
  }
  async searchConsole(start: string, end: string) {
    const d = this.dates(start, end),
      siteUrl = process.env.SEARCH_CONSOLE_SITE_URL;
    if (!siteUrl)
      throw new BadRequestException(
        "Configure SEARCH_CONSOLE_SITE_URL locally, enable the API and authorize reporting scopes.",
      );
    const api = webmasters({ version: "v3", auth: await this.google.client() });
    let imported = 0;
    for (let offset = 0; offset < 100000; offset += 25000) {
      const r = await api.searchanalytics.query(
        {
          siteUrl,
          requestBody: {
            startDate: d.start,
            endDate: d.end,
            dimensions: ["date", "page"],
            rowLimit: 25000,
            startRow: offset,
          },
        },
        { timeout: 30000 },
      );
      for (const row of r.data.rows || []) {
        const [date, url] = row.keys || [];
        if (!date || !url) continue;
        await this.metrics.traffic({
          date,
          url,
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          source: "SEARCH_CONSOLE",
        });
        imported++;
      }
      if ((r.data.rows?.length || 0) < 25000) break;
    }
    return {
      imported,
      note: "Search Console reports top rows and may omit low-volume data. Reporting dates use Google Pacific Time.",
    };
  }
  async analytics(start: string, end: string) {
    const d = this.dates(start, end),
      property = process.env.GA_PROPERTY_ID;
    if (!property || !/^\d+$/.test(property))
      throw new BadRequestException(
        "Configure numeric GA_PROPERTY_ID locally, enable the Data API and authorize reporting scopes.",
      );
    const api = analyticsdata({
      version: "v1beta",
      auth: await this.google.client(),
    });
    let imported = 0;
    for (let offset = 0; offset < 100000; offset += 10000) {
      const r = await api.properties.runReport(
        {
          property: `properties/${property}`,
          requestBody: {
            dateRanges: [{ startDate: d.start, endDate: d.end }],
            dimensions: [{ name: "date" }, { name: "pageLocation" }],
            metrics: [{ name: "screenPageViews" }],
            limit: "10000",
            offset: String(offset),
          },
        },
        { timeout: 30000 },
      );
      for (const row of r.data.rows || []) {
        const compact = row.dimensionValues?.[0]?.value,
          url = row.dimensionValues?.[1]?.value;
        if (!compact || !url || !url.startsWith("https://")) continue;
        const date = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
        await this.metrics.traffic({
          date,
          url,
          pageviews: Number(row.metricValues?.[0]?.value || 0),
          source: "GOOGLE_ANALYTICS",
        });
        imported++;
      }
      if ((r.data.rows?.length || 0) < 10000) break;
    }
    return {
      imported,
      note: "Reporting dates use the Google Analytics property timezone.",
    };
  }
}
