import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../infrastructure/prisma.service";
import { GoogleService } from "../infrastructure/blogger.service";
import { AnalyticsAdapter } from "../infrastructure/analytics.adapter";
import {
  analyticsHost,
  analyticsRow,
  validGaProperty,
  validMeasurementId,
} from "../domain/analytics";
import { reportingRange } from "../domain/reporting";

@Injectable()
export class AnalyticsConnectionService {
  constructor(
    private readonly db: PrismaService,
    private readonly google: GoogleService,
    private readonly adapter: AnalyticsAdapter,
  ) {}
  private async current() {
    const [saved, blog] = await Promise.all([
      this.db.reportingSettings.findUnique({ where: { id: "owner" } }),
      this.db.integration.findUnique({
        where: { provider: "google" },
        select: { blogUrl: true, blogId: true },
      }),
    ]);
    const candidate =
      saved?.gaPropertyId || process.env.GA_PROPERTY_ID?.trim() || "";
    return {
      saved,
      blog,
      propertyId: validGaProperty(candidate) ? candidate : null,
      host: analyticsHost(blog?.blogUrl),
      revision: saved?.gaRevision || 0,
    };
  }
  async configuration() {
    const c = await this.current(),
      permissions = await this.google.reportingPermissions();
    const destinationChanged =
      !!c.saved?.gaBlogUrl && analyticsHost(c.saved.gaBlogUrl) !== c.host;
    return {
      propertyId: c.propertyId,
      measurementId: c.saved?.gaMeasurementId || null,
      blogUrl: c.blog?.blogUrl || null,
      configured: !!c.propertyId && !!c.host && !destinationChanged,
      readAccess: permissions.analytics,
      googleConnected: !!c.blog,
      googleConfigured:
        !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
      propertyTimeZone: c.saved?.gaTimeZone || null,
      verifiedAt: c.saved?.gaVerifiedAt || null,
      revision: c.revision,
      source: c.saved?.gaPropertyId ? "STUDIO" : c.propertyId ? "ENV" : null,
      destinationChanged,
      trackingConfirmed: false,
      note: "Read access does not install the Google tag or confirm live tracking. Add the G- Measurement ID in Blogger and check GA4 Realtime.",
    };
  }
  private async requireAccess() {
    if (!(await this.google.reportingPermissions()).analytics)
      throw new BadRequestException(
        "Authorize Google Analytics read access using the same Google account as Blogger.",
      );
  }
  private providerError(error: unknown): never {
    const e = error as {
      code?: number | string;
      response?: {
        status?: number;
        data?: {
          error?: {
            details?: { reason?: string }[];
            errors?: { reason?: string }[];
          };
        };
      };
    };
    const status = e?.response?.status || Number(e?.code);
    const reasons = [
      ...(e?.response?.data?.error?.details || []),
      ...(e?.response?.data?.error?.errors || []),
    ].map((r) => r.reason);
    if (
      reasons.some(
        (r) => r === "SERVICE_DISABLED" || r === "accessNotConfigured",
      )
    )
      throw new BadRequestException(
        "Enable Google Analytics Data API in the existing Google Cloud project used by Studio, then test again.",
      );
    if (status === 401)
      throw new BadRequestException(
        "Google read access expired. Reauthorize Analytics with the same blog-owning account.",
      );
    if (status === 403 || status === 404)
      throw new BadRequestException(
        "Google could not read this GA4 property. Check the numeric Property ID, Analytics Viewer access, and that Google Analytics Data API is enabled.",
      );
    if (status === 429)
      throw new BadRequestException(
        "Google Analytics reporting quota was reached. Wait before retrying; saved pageviews are retained.",
      );
    throw new BadRequestException(
      "Google Analytics could not complete the read. Check connection and API availability; saved settings and pageviews are retained.",
    );
  }
  private async probe(propertyId: string, host: string) {
    let result;
    try {
      result = await this.adapter.report(
        propertyId,
        host,
        "7daysAgo",
        "yesterday",
        0,
        1,
      );
    } catch (e) {
      this.providerError(e);
    }
    const count = result!.rowCount ?? result!.rows?.length ?? 0;
    if (!Number.isSafeInteger(count) || count < 0)
      throw new BadRequestException(
        "Google returned an invalid Analytics report.",
      );
    return {
      readable: true,
      matchingReportRows: count,
      propertyTimeZone: result!.metadata?.timeZone || null,
      message: count
        ? "Read access succeeded and Google returned report rows for this blog. Check Realtime separately to verify current collection."
        : "Read access succeeded. Google returned no rows for this blog in the last seven completed property days; this does not prove zero traffic or working tracking.",
    };
  }
  async save(propertyId: string, measurementId: string, revision: number) {
    if (!validGaProperty(propertyId) || !validMeasurementId(measurementId))
      throw new BadRequestException(
        "Use the numeric GA4 Property ID and the separate G- Measurement ID. They are different identifiers.",
      );
    const c = await this.current();
    if (!c.host || !c.blog?.blogId)
      throw new BadRequestException(
        "Select your owned HTTPS Blogger blog first. Its existing publishing checkpoint is kept.",
      );
    if (revision !== c.revision)
      throw new ConflictException(
        "Analytics settings changed. Refresh before saving.",
      );
    await this.requireAccess();
    const test = await this.probe(propertyId, c.host);
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172270)`;
      const saved = await tx.reportingSettings.findUnique({
          where: { id: "owner" },
        }),
        blog = await tx.integration.findUnique({
          where: { provider: "google" },
          select: { blogId: true, blogUrl: true },
        });
      if (
        (saved?.gaRevision || 0) !== revision ||
        blog?.blogId !== c.blog?.blogId ||
        blog?.blogUrl !== c.blog?.blogUrl
      )
        throw new ConflictException(
          "Analytics settings or selected blog changed during the test. Refresh and try again.",
        );
      const data = {
        gaPropertyId: propertyId,
        gaMeasurementId: measurementId,
        gaBlogUrl: blog!.blogUrl,
        gaTimeZone: test.propertyTimeZone,
        gaVerifiedAt: new Date(),
        gaRevision: revision + 1,
      };
      await tx.reportingSettings.upsert({
        where: { id: "owner" },
        create: { id: "owner", ...data },
        update: data,
      });
      await tx.auditLog.create({
        data: {
          action: "ANALYTICS_CONFIGURATION_SAVED",
          message:
            "Owner selected GA4 report property after a read-only access test. Blogger tracking installation remains a separate owner step.",
        },
      });
    });
    return { ...(await this.configuration()), test };
  }
  async test() {
    const c = await this.current();
    if (!c.propertyId || !c.host)
      throw new BadRequestException(
        "Save your GA4 property and select the Blogger blog first.",
      );
    if (c.saved?.gaBlogUrl && analyticsHost(c.saved.gaBlogUrl) !== c.host)
      throw new ConflictException(
        "The selected Blogger blog changed. Save the matching Analytics configuration first.",
      );
    await this.requireAccess();
    return this.probe(c.propertyId, c.host);
  }
  async sync(start: string, end: string) {
    if (!reportingRange(start, end))
      throw new BadRequestException("Choose a date range of up to 93 days.");
    const c = await this.current();
    if (!c.propertyId || !c.host)
      throw new BadRequestException(
        "Configure Google Analytics in Blog connections before importing pageviews.",
      );
    if (c.saved?.gaBlogUrl && analyticsHost(c.saved.gaBlogUrl) !== c.host)
      throw new ConflictException(
        "The Blogger destination changed. Save the matching Analytics configuration before importing.",
      );
    await this.requireAccess();
    const rows: { id: string; date: string; url: string; pageviews: number }[] =
        [],
      seen = new Set<string>();
    let complete = false;
    for (let offset = 0; offset < 100000; offset += 10000) {
      let report;
      try {
        report = await this.adapter.report(
          c.propertyId,
          c.host,
          start,
          end,
          offset,
        );
      } catch (e) {
        this.providerError(e);
      }
      if ((report!.rowCount || 0) > 100000)
        throw new BadRequestException(
          "Analytics report exceeds 100,000 rows. Choose a narrower range; existing records are retained.",
        );
      for (const raw of report!.rows || []) {
        const row = analyticsRow(raw, c.host, start, end);
        if (!row || seen.has(row.date + "\n" + row.url))
          throw new BadRequestException(
            "Google returned invalid, duplicate or out-of-blog Analytics rows. Existing pageviews are retained.",
          );
        seen.add(row.date + "\n" + row.url);
        rows.push({ id: randomUUID(), ...row });
      }
      if (
        (report!.rows?.length || 0) < 10000 ||
        (report!.rowCount != null &&
          offset + (report!.rows?.length || 0) >= report!.rowCount)
      ) {
        complete = true;
        break;
      }
    }
    if (!complete)
      throw new BadRequestException(
        "Analytics pagination limit reached. Narrow the dates; existing pageviews are retained.",
      );
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172270)`;
      const saved = await tx.reportingSettings.findUnique({
          where: { id: "owner" },
        }),
        blog = await tx.integration.findUnique({
          where: { provider: "google" },
          select: { blogUrl: true },
        });
      const property =
        saved?.gaPropertyId || process.env.GA_PROPERTY_ID?.trim();
      if (
        property !== c.propertyId ||
        (saved?.gaRevision || 0) !== c.revision ||
        blog?.blogUrl !== c.blog?.blogUrl
      )
        throw new ConflictException(
          "Analytics property or Blogger destination changed during import. Existing records are retained.",
        );
      if (rows.length)
        await tx.$executeRaw`
        INSERT INTO "TrafficMetric" ("id","date","url","source","pageviews")
        SELECT r.id,r.date::date,r.url,'GOOGLE_ANALYTICS',r.pageviews
        FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS r(id text,date text,url text,pageviews integer)
        ON CONFLICT ("date","url","source") DO UPDATE SET "pageviews"=EXCLUDED."pageviews"
      `;
    });
    return {
      imported: rows.length,
      empty: !rows.length,
      note: "Dates use the GA4 property's timezone. Empty reports do not establish zero traffic or working tracking.",
    };
  }
}
