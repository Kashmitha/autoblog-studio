import { BadRequestException, Injectable } from "@nestjs/common";
import { webmasters } from "googleapis/build/src/apis/webmasters";
import { analyticsdata } from "googleapis/build/src/apis/analyticsdata";
import { GoogleService } from "../infrastructure/blogger.service";
import { MetricsService } from "./metrics.service";
import { SearchConsoleService } from "./search-console.service";
import { inspectionError, urlInProperty } from "../domain/indexing";
import { ReportReadError, reportingRange } from "../domain/reporting";
@Injectable()
export class ReportingService {
  constructor(
    private readonly google: GoogleService,
    private readonly metrics: MetricsService,
    private readonly search: SearchConsoleService,
  ) {}
  private dates(start: string, end: string) {
    if (!reportingRange(start, end))
      throw new BadRequestException("Choose a date range of up to 93 days.");
    return { start: start.slice(0, 10), end: end.slice(0, 10) };
  }
  async searchConsole(start: string, end: string, expectedProperty?: string) {
    const d = this.dates(start, end),
      siteUrl = await this.search.property();
    if (!siteUrl)
      throw new BadRequestException(
        "Select your verified Search Console property in Blog connections, enable its API and connect read access.",
      );
    if (expectedProperty && siteUrl !== expectedProperty)
      throw new ReportReadError(
        "PROPERTY_CHANGED",
        "The selected property changed. Reload before importing traffic.",
      );
    if (!(await this.google.reportingPermissions()).searchConsole)
      throw new BadRequestException(
        "Connect Search Console read access in Blog connections before importing traffic.",
      );
    const api = webmasters({ version: "v3", auth: await this.google.client() });
    const rows: {
      date: string;
      url: string;
      clicks?: number;
      impressions?: number;
    }[] = [];
    let completed = false;
    let received = 0;
    for (let offset = 0; offset < 100000; offset += 25000) {
      const r = await api.searchanalytics
        .query(
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
          { timeout: 20000, retry: false },
        )
        .catch((error) => {
          const safe = inspectionError(error);
          throw new ReportReadError(safe.errorCode, safe.errorMessage);
        });
      received += r.data.rows?.length || 0;
      for (const row of r.data.rows || []) {
        const [date, url] = row.keys || [];
        if (!date || !url) continue;
        if (date < d.start || date > d.end || !urlInProperty(url, siteUrl))
          throw new ReportReadError(
            "INVALID_REPORT",
            "Google returned rows outside the requested report. Existing traffic records are retained.",
          );
        const impressions =
          Number.isSafeInteger(row.impressions) && row.impressions! >= 0
            ? row.impressions!
            : undefined;
        const clicks =
          Number.isSafeInteger(row.clicks) && row.clicks! >= 0
            ? row.clicks!
            : undefined;
        if (
          (row.clicks != null && clicks === undefined) ||
          (row.impressions != null && impressions === undefined)
        )
          throw new ReportReadError(
            "INVALID_REPORT",
            "Google returned invalid search counts. Existing traffic records are retained.",
          );
        if (impressions === undefined && clicks === undefined) continue;
        rows.push({
          date,
          url,
          impressions,
          clicks,
        });
      }
      if ((r.data.rows?.length || 0) < 25000) {
        completed = true;
        break;
      }
    }
    if (!completed)
      throw new ReportReadError(
        "REPORT_TOO_LARGE",
        "The report reached the 100,000-row limit. Choose a narrower date range; existing traffic records are retained.",
      );
    if (received && !rows.length)
      throw new ReportReadError(
        "INVALID_REPORT",
        "Google returned no usable metrics in its report rows. Existing traffic records are retained.",
      );
    if ((await this.search.property()) !== siteUrl)
      throw new ReportReadError(
        "PROPERTY_CHANGED",
        "The selected property changed during the import. Existing traffic records are retained.",
      );
    const imported = await this.metrics.searchTraffic(rows);
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
    if (!(await this.google.reportingPermissions()).analytics)
      throw new BadRequestException(
        "Connect Google Analytics read access before importing pageviews.",
      );
    const api = analyticsdata({
      version: "v1beta",
      auth: await this.google.client(),
    });
    let imported = 0;
    for (let offset = 0; offset < 100000; offset += 10000) {
      const r = await api.properties
        .runReport(
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
          { timeout: 30000, retry: false },
        )
        .catch((error) => {
          throw new BadRequestException(inspectionError(error).errorMessage);
        });
      for (const row of r.data.rows || []) {
        const compact = row.dimensionValues?.[0]?.value,
          url = row.dimensionValues?.[1]?.value;
        if (!compact || !url || !url.startsWith("https://")) continue;
        const value = row.metricValues?.[0]?.value;
        if (
          typeof value !== "string" ||
          !/^\d+$/.test(value) ||
          !Number.isSafeInteger(Number(value))
        )
          continue;
        const date = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
        await this.metrics.traffic({
          date,
          url,
          pageviews: Number(value),
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
