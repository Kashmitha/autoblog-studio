import "reflect-metadata";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { PrismaService } from "../src/infrastructure/prisma.service";
import { WeeklyReviewService } from "../src/application/weekly-review.service";
import { hashPassword } from "../src/domain/security";
import { parseAdsterraReport } from "../src/domain/adsterra-report";

let app: INestApplication,
  db: PrismaService,
  service: WeeklyReviewService,
  agent: ReturnType<typeof request.agent>;
const now = new Date("2026-11-12T20:00:00Z"); // 13 November in Sri Lanka.
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/autoblog_test")
    throw new Error("Weekly review requires isolated test database");
  app = await createApp();
  await app.init();
  db = app.get(PrismaService);
  service = app.get(WeeklyReviewService);
  await db.user.upsert({
    where: { email: "weekly@localhost" },
    create: {
      email: "weekly@localhost",
      passwordHash: hashPassword("weekly-test-password"),
    },
    update: {},
  });
  agent = request.agent(app.getHttpServer());
  await agent
    .post("/api/auth/login")
    .set("Origin", "http://localhost:3100")
    .send({ email: "weekly@localhost", password: "weekly-test-password" })
    .expect(201);
});
beforeEach(async () => {
  await db.publishJob.deleteMany();
  await db.article.deleteMany();
  await db.trafficSync.deleteMany();
  await db.adReport.deleteMany();
  await db.reportingSettings.upsert({
    where: { id: "owner" },
    create: { id: "owner", searchConsoleSiteUrl: "https://review.example/" },
    update: { searchConsoleSiteUrl: "https://review.example/" },
  });
  await db.automationSettings.upsert({
    where: { id: "owner" },
    create: { id: "owner", paused: true },
    update: { paused: true, emergencyStop: false },
  });
});
afterAll(async () => {
  await db.publishJob.deleteMany();
  await db.article.deleteMany();
  await db.trafficSync.deleteMany();
  await db.adReport.deleteMany();
  await db.user.deleteMany({ where: { email: "weekly@localhost" } });
  await app.close();
});

test("weekly review is session protected and non-cacheable", async () => {
  await request(app.getHttpServer())
    .get("/api/dashboard/weekly-review")
    .expect(401);
  const response = await agent.get("/api/dashboard/weekly-review").expect(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.body.adReport).toBeNull();
  expect(response.body.search.lastAttempt).toBeNull();
  expect(JSON.stringify(response.body)).not.toMatch(
    /encryptedTokens|passwordHash|csrfToken/,
  );
});

test("publishing window includes its start and excludes today while queues and schedules remain separate", async () => {
  for (const [slug, date] of [
    ["inside", "2026-11-05T18:30:00Z"],
    ["before", "2026-11-05T18:29:59Z"],
    ["today", "2026-11-12T18:30:00Z"],
  ])
    await db.article.create({
      data: {
        slug,
        title: slug,
        status: "PUBLISHED",
        publishedAt: new Date(date),
      },
    });
  await db.article.create({
    data: {
      slug: "needs-review",
      title: "Review this draft",
      status: "NEEDS_REVIEW",
    },
  });
  await db.article.create({
    data: { slug: "approved", title: "Approved draft", status: "APPROVED" },
  });
  await db.article.create({
    data: {
      slug: "past",
      title: "Past unconfirmed schedule",
      status: "SCHEDULED",
      scheduledAt: new Date("2026-11-12T10:00:00Z"),
      publishingTarget: "blogger",
    },
  });
  for (let i = 0; i < 4; i++)
    await db.article.create({
      data: {
        slug: "future-" + i,
        title: "Scheduled " + i,
        status: "SCHEDULED",
        scheduledAt: new Date(now.getTime() + (i + 1) * 3600000),
        publishingTarget: i ? "local" : "blogger",
      },
    });
  const summary = await service.summary(now);
  expect(summary.publishing).toMatchObject({
    published: 1,
    needsReview: 1,
    approved: 1,
    pastSchedules: 1,
    paused: true,
  });
  expect(summary.publishing.scheduled.map((row) => row.title)).toEqual([
    "Scheduled 0",
    "Scheduled 1",
    "Scheduled 2",
  ]);
  expect(summary.actions.some((action) => action.href === "/calendar")).toBe(
    true,
  );
});

test("latest failed import preserves prior empty successful read and excludes other properties", async () => {
  const range = {
    startDate: new Date("2026-10-15"),
    endDate: new Date("2026-11-12"),
    trigger: "manual",
  };
  await db.trafficSync.create({
    data: {
      ...range,
      siteUrl: "https://review.example/",
      state: "EMPTY",
      startedAt: new Date("2026-11-11T00:00Z"),
      finishedAt: new Date("2026-11-11T00:01Z"),
    },
  });
  await db.trafficSync.create({
    data: {
      ...range,
      siteUrl: "https://review.example/",
      state: "FAILED",
      errorCode: "QUOTA",
      startedAt: new Date("2026-11-12T00:00Z"),
    },
  });
  await db.trafficSync.create({
    data: {
      ...range,
      siteUrl: "https://other.example/",
      state: "SUCCEEDED",
      imported: 90,
      startedAt: now,
    },
  });
  const summary = await service.summary(now);
  expect(summary.search.lastAttempt).toMatchObject({
    state: "FAILED",
    errorCode: "QUOTA",
    startDate: "2026-10-15",
    endDate: "2026-11-12",
  });
  expect(summary.search.lastSuccess).toMatchObject({
    state: "EMPTY",
    imported: 0,
  });
  expect(
    summary.actions.some(
      (action) => action.label === "Review the latest search import failure",
    ),
  ).toBe(true);
});

test("latest snapshot is shown once in its own date range and malformed summaries stay unavailable", async () => {
  const report = parseAdsterraReport(
    "Date,Impressions,Clicks,CTR,CPM,Revenue\n2026/11/12,20,0,0%,$0,$0",
  );
  await db.adReport.create({
    data: {
      fingerprint: "older",
      filename: "older.csv",
      report,
      createdAt: new Date("2026-11-01"),
    },
  });
  await db.adReport.create({
    data: {
      fingerprint: "latest",
      filename: "latest.csv",
      report,
      createdAt: now,
    },
  });
  const summary = await service.summary(now);
  expect(summary.adReport).toMatchObject({
    filename: "latest.csv",
    scopeLabel: "",
    timezoneLabel: "",
    summary: {
      startDate: "2026-11-12",
      endDate: "2026-11-12",
      reportedDates: 1,
      impressions: 20,
      clicks: 0,
      revenue: 0,
    },
  });
  await db.adReport.update({
    where: { fingerprint: "latest" },
    data: { report: {} },
  });
  expect((await service.summary(now)).adReport?.summary).toBeNull();
});

test("refresh writes no records and does not change automation", async () => {
  const before = await Promise.all([
    db.article.count(),
    db.publishJob.count(),
    db.trafficSync.count(),
    db.adReport.count(),
    db.auditLog.count(),
    db.financeEntry.count(),
    db.trafficMetric.count(),
    db.automationSettings.findUnique({ where: { id: "owner" } }),
  ]);
  await agent.get("/api/dashboard/weekly-review").expect(200);
  await agent.get("/api/dashboard/weekly-review").expect(200);
  const after = await Promise.all([
    db.article.count(),
    db.publishJob.count(),
    db.trafficSync.count(),
    db.adReport.count(),
    db.auditLog.count(),
    db.financeEntry.count(),
    db.trafficMetric.count(),
    db.automationSettings.findUnique({ where: { id: "owner" } }),
  ]);
  expect(after).toEqual(before);
});
