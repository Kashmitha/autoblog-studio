import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../infrastructure/prisma.service";
import { GoogleService } from "../infrastructure/blogger.service";
import { PublishingService } from "../application/publishing.service";
import { MetricsService } from "../application/metrics.service";
import { AiService } from "../application/ai.service";
import { MediaService } from "../application/media.service";
import { SessionGuard, AuthRequest } from "./auth";
import {
  AnalyticsSyncDto,
  BlogDto,
  ConfirmDto,
  CsvDto,
  FinanceDto,
  GenerateDto,
  MediaDto,
  ScheduleDto,
  SettingsDto,
  SitemapDto,
  TrafficDto,
  ReconcileDto,
  ReminderDto,
} from "./dtos";
import { publicGet } from "../infrastructure/public-http";
import { ReportingService } from "../application/reporting.service";
import { TrafficSyncService } from "../application/traffic-sync.service";
import { SearchConsoleService } from "../application/search-console.service";
import { env } from "../config";
@Controller()
@UseGuards(SessionGuard)
export class StudioController {
  constructor(
    private readonly db: PrismaService,
    private readonly publisher: PublishingService,
    private readonly metrics: MetricsService,
    private readonly google: GoogleService,
    private readonly ai: AiService,
    private readonly media: MediaService,
    private readonly reporting: ReportingService,
    private readonly search: SearchConsoleService,
    private readonly trafficSync: TrafficSyncService,
  ) {}
  @Get("dashboard") dashboard(@Query("month") month?: string) {
    return this.metrics.overview(month);
  }
  @Get("settings") settings() {
    return this.db.automationSettings.findUniqueOrThrow({
      where: { id: "owner" },
    });
  }
  @Patch("settings") async saveSettings(@Body() d: SettingsDto) {
    if (d.times.length > d.dailyLimit)
      throw new BadRequestException(
        "Publishing times cannot exceed the daily limit.",
      );
    return this.db.$transaction(async (tx) => {
      const s = await tx.automationSettings.update({
        where: { id: "owner" },
        data: d,
      });
      await tx.auditLog.create({
        data: {
          action: "AUTOMATION_SETTINGS",
          message: d.emergencyStop
            ? "Emergency stop enabled."
            : d.paused
              ? "Automation paused."
              : "Automation resumed.",
        },
      });
      return s;
    });
  }
  @Post("articles/:id/schedule") schedule(
    @Param("id") id: string,
    @Body() d: ScheduleDto,
  ) {
    return this.publisher.schedule(id, d.at, !!d.liveTest);
  }
  @Post("articles/:id/unschedule") unschedule(@Param("id") id: string) {
    return this.publisher.cancel(id);
  }
  @Get("jobs") async jobs() {
    return {
      jobs: await this.db.publishJob.findMany({
        include: { article: { select: { title: true, status: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      counts: await this.publisher.queue.getJobCounts(
        "waiting",
        "active",
        "delayed",
        "failed",
        "completed",
      ),
      workers: await this.db.workerHeartbeat.findMany(),
    };
  }
  @Post("articles/:id/reconcile") reconcile(
    @Param("id") id: string,
    @Body() d: ReconcileDto,
  ) {
    return this.publisher.reconcileRemote(id, d.postId, d.confirmation);
  }
  @Post("articles/:id/reminder") reminder(
    @Param("id") id: string,
    @Body() d: ReminderDto,
  ) {
    return this.db.article.update({
      where: { id },
      data: { updateReminderAt: new Date(d.at) },
    });
  }
  @Get("reminders") reminders() {
    return this.db.article.findMany({
      where: { updateReminderAt: { lte: new Date() } },
      select: {
        id: true,
        title: true,
        publishedUrl: true,
        updateReminderAt: true,
      },
    });
  }
  @Post("jobs/:id/retry") retry(@Param("id") id: string) {
    return this.publisher.retry(id);
  }
  @Get("logs") logs() {
    return this.db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  @Get("media") listMedia() {
    return this.db.mediaAsset.findMany({ orderBy: { createdAt: "desc" } });
  }
  @Get("media/search") searchMedia(
    @Query("q") q: string,
    @Query("provider") provider: string,
  ) {
    return this.media.search(q, provider);
  }
  @Post("media") addMedia(@Body() d: MediaDto) {
    return this.media.add(d);
  }
  @Post("ai/generate") generate(@Body() d: GenerateDto) {
    return this.ai.generate(d);
  }
  @Post("finance") finance(@Body() d: FinanceDto) {
    return this.metrics.finance(d);
  }
  @Post("finance/import") importFinance(@Body() d: CsvDto) {
    return this.metrics.importCsv(d.csv, "finance");
  }
  @Post("traffic") traffic(@Body() d: TrafficDto) {
    return this.metrics.traffic(d);
  }
  @Post("traffic/import") importTraffic(@Body() d: CsvDto) {
    return this.metrics.importCsv(d.csv, "traffic");
  }
  @Post("seo/sitemap") async sitemap(@Body() d: SitemapDto) {
    const r = await publicGet(d.url);
    const valid =
      r.status === 200 && /<(urlset|sitemapindex)[\s>]/i.test(r.body);
    await this.db.automationSettings.update({
      where: { id: "owner" },
      data: {
        sitemapUrl: d.url,
        sitemapCheckedAt: new Date(),
        sitemapValid: valid,
      },
    });
    return {
      valid,
      status: r.status,
      url: r.url,
      note: "Valid XML structure does not confirm Google indexing. Submit manually in Search Console.",
    };
  }
  @Get("integrations") async integrations() {
    const [search, permissions] = await Promise.all([
      this.search.configuration(),
      this.google.reportingPermissions(),
    ]);
    const google = await this.db.integration.findUnique({
      where: { provider: "google" },
      select: {
        accountLabel: true,
        blogId: true,
        blogUrl: true,
        firstLiveTestAuthorizedAt: true,
        liveTestSucceededAt: true,
        updatedAt: true,
      },
    });
    return {
      google,
      bloggerMode: env.bloggerMode,
      aiEnabled:
        process.env.AI_ENABLED === "true" &&
        process.env.AI_BILLING_AUTHORIZED === "true",
      aiConfigured: !!process.env.AI_API_KEY,
      aiModel: process.env.AI_MODEL,
      aiMonthlyLimit: Number(process.env.AI_MONTHLY_LIMIT_USD || 3),
      googleConfigured:
        !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
      unsplashConfigured: !!process.env.UNSPLASH_ACCESS_KEY,
      adsterraConfigured: !!process.env.ADSTERRA_API_KEY,
      searchConsoleConfigured: search.configured,
      searchConsoleSiteUrl: search.siteUrl,
      searchConsoleReadAccess: permissions.searchConsole,
      analyticsReadAccess: permissions.analytics,
      analyticsConfigured: !!process.env.GA_PROPERTY_ID,
    };
  }
  @Get("integrations/google/connect") connect(
    @Req() req: AuthRequest,
    @Query("analytics") analytics?: string,
    @Query("searchConsole") searchConsole?: string,
  ) {
    return this.google.connect(
      req.session!.id,
      analytics === "true",
      searchConsole === "true",
    );
  }
  @Get("integrations/google/callback") async callback(
    @Req() req: AuthRequest,
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") error: string,
    @Res() res: Response,
  ) {
    if (error) return res.redirect(env.frontend + "/connections?oauth=denied");
    if (!code || !state)
      throw new BadRequestException("Missing OAuth authorization parameters.");
    await this.google.callback(code, state, req.session!.id);
    return res.redirect(env.frontend + "/connections?oauth=connected");
  }
  @Get("integrations/google/blogs") blogs() {
    return this.google.blogs();
  }
  @Post("integrations/google/blog") select(@Body() d: BlogDto) {
    return this.google.select(d.blogId);
  }
  @Get("integrations/google/test") async test() {
    const blogs = await this.google.blogs();
    return { ok: true, ownedBlogs: blogs.length };
  }
  @Get("integrations/google/posts") posts() {
    return this.google.posts();
  }
  @Post("integrations/google/disconnect") disconnect() {
    return this.google.disconnect();
  }
  @Post("integrations/blogger/authorize-first-test") async authorize(
    @Body() d: ConfirmDto,
  ) {
    if (d.confirmation !== "AUTHORIZE FIRST LIVE BLOGGER TEST")
      throw new BadRequestException("Type the exact authorization phrase.");
    const i = await this.db.integration.findUnique({
      where: { provider: "google" },
    });
    if (!i?.blogId)
      throw new BadRequestException("Select the actual test blog first.");
    await this.db.integration.update({
      where: { provider: "google" },
      data: { firstLiveTestAuthorizedAt: new Date() },
    });
    await this.db.auditLog.create({
      data: {
        action: "FIRST_LIVE_TEST_AUTHORIZED",
        message: `Owner explicitly authorized first live test on blog ${i.blogId}.`,
      },
    });
    return { ok: true };
  }
  @Post("integrations/search-console/sync") searchConsole(
    @Body() d: AnalyticsSyncDto,
  ) {
    return this.trafficSync.sync(false, d);
  }
  @Post("integrations/analytics/sync") analytics(@Body() d: AnalyticsSyncDto) {
    return this.reporting.analytics(d.start, d.end);
  }
}
