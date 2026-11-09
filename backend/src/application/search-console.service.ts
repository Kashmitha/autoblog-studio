import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Article, IndexInspection, Prisma } from "@prisma/client";
import { PrismaService } from "../infrastructure/prisma.service";
import { GoogleService } from "../infrastructure/blogger.service";
import { SearchConsoleAdapter } from "../infrastructure/search-console.adapter";
import {
  indexVerdict,
  inspectionError,
  safeInspectionLink,
  urlInProperty,
  validSearchProperty,
  automaticInspectionInterval,
  inspectionDue,
  indexingFollowUp,
} from "../domain/indexing";

const text = (value: string | null | undefined, max = 2000) =>
  typeof value === "string" ? value.slice(0, max) : null;
const strings = (values?: string[] | null) =>
  (values || [])
    .slice(0, 30)
    .filter((v) => typeof v === "string")
    .map((v) => v.slice(0, 2048));
@Injectable()
export class SearchConsoleService {
  constructor(
    private readonly db: PrismaService,
    private readonly google: GoogleService,
    private readonly adapter: SearchConsoleAdapter,
  ) {}
  async property() {
    const settings = await this.db.reportingSettings.findUnique({
      where: { id: "owner" },
    });
    return (
      settings?.searchConsoleSiteUrl ||
      process.env.SEARCH_CONSOLE_SITE_URL?.trim() ||
      null
    );
  }
  async configuration() {
    const [siteUrl, permissions, connection] = await Promise.all([
      this.property(),
      this.google.reportingPermissions(),
      this.db.integration.findUnique({
        where: { provider: "google" },
        select: { provider: true },
      }),
    ]);
    return {
      siteUrl,
      configured: !!siteUrl && validSearchProperty(siteUrl),
      readAccess: permissions.searchConsole,
      googleConnected: !!connection,
      googleConfigured:
        !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  async properties() {
    if (!(await this.google.reportingPermissions()).searchConsole)
      throw new BadRequestException(
        "Connect Search Console read access first using the same Google account as Blogger.",
      );
    try {
      const rows = await this.adapter.properties();
      return rows
        .filter(
          (p) =>
            p.siteUrl &&
            validSearchProperty(p.siteUrl) &&
            ["siteOwner", "siteFullUser", "siteRestrictedUser"].includes(
              p.permissionLevel || "",
            ),
        )
        .map((p) => ({
          siteUrl: p.siteUrl!,
          permissionLevel: p.permissionLevel!,
        }));
    } catch (error) {
      throw new BadRequestException(inspectionError(error).errorMessage);
    }
  }
  async saveProperty(siteUrl: string) {
    if (!validSearchProperty(siteUrl))
      throw new BadRequestException(
        "Select a verified HTTPS URL-prefix or domain property.",
      );
    const properties = await this.properties();
    if (!properties.some((p) => p.siteUrl === siteUrl))
      throw new BadRequestException(
        "Choose a verified property available to the connected Google account.",
      );
    await this.db.reportingSettings.upsert({
      where: { id: "owner" },
      create: {
        id: "owner",
        searchConsoleSiteUrl: siteUrl,
        propertyVerifiedAt: new Date(),
      },
      update: { searchConsoleSiteUrl: siteUrl, propertyVerifiedAt: new Date() },
    });
    return this.configuration();
  }
  private view(
    a: Pick<Article, "id" | "title" | "status" | "publishedUrl">,
    configuration: Awaited<ReturnType<SearchConsoleService["configuration"]>>,
    inspections: IndexInspection[],
    confirmed?: IndexInspection | null,
  ) {
    const history = inspections.filter(
      (i) =>
        i.inspectionUrl === a.publishedUrl &&
        i.siteUrl === configuration.siteUrl,
    );
    const eligible = a.status === "PUBLISHED" && !!a.publishedUrl;
    const blockedReason = !eligible
      ? "Indexing can be checked after Blogger confirms this article is published."
      : !configuration.configured
        ? "Select your verified Search Console property in Blog connections."
        : !configuration.readAccess
          ? "Connect Search Console read access in Blog connections."
          : !urlInProperty(a.publishedUrl!, configuration.siteUrl!)
            ? "This article URL is outside the selected Search Console property."
            : null;
    const latest =
      confirmed || history.find((i) => i.state !== "ERROR") || null;
    const lastAttempt = history[0] || null;
    const previous = history.find(
      (i) => i.state !== "ERROR" && i.id !== latest?.id,
    );
    return {
      articleId: a.id,
      title: a.title,
      publishingStatus: a.status,
      url: a.publishedUrl,
      eligible,
      canInspect: !blockedReason,
      blockedReason,
      latest,
      lastAttempt,
      followUp: indexingFollowUp(eligible, blockedReason, latest, previous),
      nextAutomaticCheckAt:
        !blockedReason && lastAttempt
          ? new Date(
              lastAttempt.checkedAt.getTime() +
                automaticInspectionInterval(lastAttempt.state),
            )
          : null,
      history,
      configuration,
    };
  }
  async report(id: string) {
    const configuration = await this.configuration();
    const a = await this.db.article.findUnique({
      where: { id },
      include: {
        inspections: {
          where: { siteUrl: configuration.siteUrl || "" },
          orderBy: [{ checkedAt: "desc" }, { id: "desc" }],
          take: 30,
        },
      },
    });
    if (!a) throw new NotFoundException("Article not found.");
    const confirmed = await this.db.indexInspection.findFirst({
      where: {
        articleId: id,
        siteUrl: configuration.siteUrl || "",
        inspectionUrl: a.publishedUrl || "",
        state: { not: "ERROR" },
      },
      orderBy: [{ checkedAt: "desc" }, { id: "desc" }],
    });
    return this.view(a, configuration, a.inspections, confirmed);
  }
  async overview() {
    const configuration = await this.configuration();
    const articles = await this.db.article.findMany({
      where: { status: { in: ["PUBLISHED", "SCHEDULED"] } },
      select: {
        id: true,
        title: true,
        status: true,
        publishedUrl: true,
        inspections: {
          where: { siteUrl: configuration.siteUrl || "" },
          orderBy: [{ checkedAt: "desc" }, { id: "desc" }],
          take: 30,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    const confirmed = await this.db.indexInspection.findMany({
      where: {
        articleId: { in: articles.map((a) => a.id) },
        siteUrl: configuration.siteUrl || "",
        state: { not: "ERROR" },
      },
      distinct: ["articleId", "inspectionUrl"],
      orderBy: [{ checkedAt: "desc" }, { id: "desc" }],
    });
    return {
      configuration,
      articles: articles.map((a) =>
        this.view(
          a,
          configuration,
          a.inspections,
          confirmed.find(
            (i) => i.articleId === a.id && i.inspectionUrl === a.publishedUrl,
          ),
        ),
      ),
      note: "Google's stored index report, not a live URL test. Refreshing does not request indexing.",
    };
  }
  async refreshDue() {
    const overview = await this.overview();
    const due = overview.articles
      .filter((a) => a.canInspect && inspectionDue(a.lastAttempt))
      .sort(
        (a, b) =>
          (a.lastAttempt?.checkedAt.getTime() || 0) -
          (b.lastAttempt?.checkedAt.getTime() || 0),
      );
    const results: { articleId: string; checked: boolean; error?: string }[] =
      [];
    // Three bounded sequential reads fit inside the frontend request timeout.
    // Recheck cadence under the inspection lock to coalesce tabs and sessions.
    for (const article of due.slice(0, 3)) {
      try {
        const result = await this.inspect(article.articleId, true);
        results.push({
          articleId: article.articleId,
          checked: !result.cached,
          ...(result.lastAttempt?.state === "ERROR"
            ? {
                error:
                  result.lastAttempt.errorMessage ||
                  "Google could not return a report.",
              }
            : {}),
        });
        if (
          [
            "AUTH_REQUIRED",
            "API_DISABLED",
            "ACCESS_DENIED",
            "QUOTA",
            "GOOGLE_UNAVAILABLE",
          ].includes(result.lastAttempt?.errorCode || "")
        )
          break;
      } catch {
        results.push({
          articleId: article.articleId,
          checked: false,
          error:
            "The daily check could not complete. Saved results are retained; try a manual refresh for details.",
        });
        break;
      }
    }
    return {
      checkedAt: new Date(),
      results,
      remaining: Math.max(0, due.length - results.length),
    };
  }
  async inspect(id: string, automatic = false) {
    const configuration = await this.configuration();
    const cached = await this.db.$transaction(
      async (tx) => {
        // Serialize quota decisions and coalesce concurrent refreshes. This lock
        // is independent of publication locks and never contacts Blogger writes.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(8172201)`;
        const a = await tx.article.findUnique({ where: { id } });
        if (!a) throw new NotFoundException("Article not found.");
        const readiness = this.view(a, configuration, []);
        if (readiness.blockedReason)
          throw new BadRequestException(readiness.blockedReason);
        const siteUrl = configuration.siteUrl!,
          inspectionUrl = a.publishedUrl!;
        const latest = await tx.indexInspection.findFirst({
          where: { articleId: id, siteUrl, inspectionUrl },
          orderBy: [{ checkedAt: "desc" }, { id: "desc" }],
        });
        if (automatic && !inspectionDue(latest)) return true;
        if (
          latest &&
          Date.now() - latest.checkedAt.getTime() <
            (latest.state === "ERROR" ? 60000 : 300000)
        )
          return true;
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        if (
          (await tx.indexInspection.count({
            where: { siteUrl, checkedAt: { gte: start } },
          })) >= 100
        )
          throw new BadRequestException(
            "Studio's daily inspection check limit has been reached. Try again tomorrow.",
          );
        let data: Prisma.IndexInspectionUncheckedCreateInput;
        try {
          const response = await this.adapter.inspect(inspectionUrl, siteUrl);
          if (!response?.indexStatusResult)
            throw new Error("Missing index inspection result");
          const s = response.indexStatusResult;
          const date = s.lastCrawlTime ? new Date(s.lastCrawlTime) : null;
          data = {
            articleId: id,
            siteUrl,
            inspectionUrl,
            state: indexVerdict(s.verdict),
            verdict: text(s.verdict),
            coverageState: text(s.coverageState),
            robotsTxtState: text(s.robotsTxtState),
            indexingState: text(s.indexingState),
            pageFetchState: text(s.pageFetchState),
            lastCrawlTime:
              date && Number.isFinite(date.getTime()) ? date : null,
            crawledAs: text(s.crawledAs),
            googleCanonical: text(s.googleCanonical, 2048),
            userCanonical: text(s.userCanonical, 2048),
            sitemaps: strings(s.sitemap),
            referringUrls: strings(s.referringUrls),
            inspectionResultLink: safeInspectionLink(
              response.inspectionResultLink,
            ),
          };
        } catch (error) {
          data = {
            articleId: id,
            siteUrl,
            inspectionUrl,
            state: "ERROR",
            ...inspectionError(error),
          };
        }
        const current = await tx.article.findUniqueOrThrow({ where: { id } });
        if (
          current.status !== "PUBLISHED" ||
          current.publishedUrl !== inspectionUrl
        )
          throw new ConflictException(
            "The article's publishing state changed. Refresh before inspecting again.",
          );
        await tx.indexInspection.create({ data });
        return false;
      },
      { timeout: 60000, maxWait: 60000 },
    );
    return { ...(await this.report(id)), cached };
  }
}
