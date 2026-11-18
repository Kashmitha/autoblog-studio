import "reflect-metadata";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { PrismaService } from "../src/infrastructure/prisma.service";
import { GoogleService } from "../src/infrastructure/blogger.service";
import { AnalyticsAdapter } from "../src/infrastructure/analytics.adapter";
import { AnalyticsConnectionService } from "../src/application/analytics-connection.service";
import { ReportingService } from "../src/application/reporting.service";
import { hashPassword } from "../src/domain/security";
let app: INestApplication,
  db: PrismaService,
  ga: AnalyticsConnectionService,
  adapter: AnalyticsAdapter,
  agent: ReturnType<typeof request.agent>,
  csrf: string;
const origin = "http://localhost:3100",
  blog = "https://fixture.example/",
  oldEnv = process.env.GA_PROPERTY_ID;
const row = (value = "4", url = blog + "post", date = "20261115") => ({
  dimensionValues: [{ value: date }, { value: url }],
  metricValues: [{ value }],
});
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/autoblog_test")
    throw Error("Isolated test database required");
  delete process.env.GA_PROPERTY_ID;
  app = await createApp();
  await app.init();
  db = app.get(PrismaService);
  ga = app.get(AnalyticsConnectionService);
  adapter = app.get(AnalyticsAdapter);
  await db.user.upsert({
    where: { email: "analytics-test@localhost" },
    create: {
      email: "analytics-test@localhost",
      passwordHash: hashPassword("analytics-fixture-password"),
    },
    update: {},
  });
  agent = request.agent(app.getHttpServer());
  const login = await agent
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({
      email: "analytics-test@localhost",
      password: "analytics-fixture-password",
    })
    .expect(201);
  csrf = login.body.csrfToken;
});
beforeEach(async () => {
  jest.restoreAllMocks();
  await db.reportingSettings.deleteMany();
  await db.trafficMetric.deleteMany();
  await db.integration.upsert({
    where: { provider: "google" },
    create: {
      provider: "google",
      encryptedTokens: "fixture",
      blogId: "fixture-blog",
      blogUrl: blog,
      firstLiveTestAuthorizedAt: new Date(),
      liveTestSucceededAt: new Date(),
    },
    update: { blogId: "fixture-blog", blogUrl: blog },
  });
  await db.reportingSettings.create({
    data: {
      id: "owner",
      searchConsoleSiteUrl: blog,
      propertyVerifiedAt: new Date(),
    },
  });
  jest
    .spyOn(app.get(GoogleService), "reportingPermissions")
    .mockResolvedValue({ analytics: true, searchConsole: true });
  jest
    .spyOn(adapter, "report")
    .mockResolvedValue({
      rows: [],
      rowCount: 0,
      metadata: { timeZone: "Asia/Colombo" },
    });
});
afterAll(async () => {
  jest.restoreAllMocks();
  await db.reportingSettings.deleteMany();
  await db.trafficMetric.deleteMany();
  await db.integration.deleteMany({ where: { provider: "google" } });
  await db.user.deleteMany({ where: { email: "analytics-test@localhost" } });
  if (oldEnv === undefined) delete process.env.GA_PROPERTY_ID;
  else process.env.GA_PROPERTY_ID = oldEnv;
  await app.close();
});
const save = (
  data = {
    propertyId: "123456789",
    measurementId: "G-ABCDEF1234",
    revision: 0,
  },
) =>
  agent
    .patch("/api/integrations/analytics/configuration")
    .set("Origin", origin)
    .set("X-CSRF-Token", csrf)
    .send(data);
test("configuration is owner-only, CSRF protected and separates the two IDs", async () => {
  await request(app.getHttpServer())
    .get("/api/integrations/analytics/configuration")
    .expect(401);
  await agent
    .patch("/api/integrations/analytics/configuration")
    .set("Origin", origin)
    .send({})
    .expect(403);
  await save({
    propertyId: "G-ABCDEF1234",
    measurementId: "G-ABCDEF1234",
    revision: 0,
  }).expect(400);
  expect(adapter.report).not.toHaveBeenCalled();
});
test("saving configuration preserves Search Console, Blogger checkpoints and automation policy", async () => {
  const connection = await db.integration.findUnique({
      where: { provider: "google" },
    }),
    automation = await db.automationSettings.findUnique({
      where: { id: "owner" },
    }),
    editorial = await db.editorialSettings.findUnique({
      where: { id: "owner" },
    });
  const r = await save().expect(200);
  expect(r.body).toMatchObject({
    configured: true,
    measurementId: "G-ABCDEF1234",
    propertyTimeZone: "Asia/Colombo",
    trackingConfirmed: false,
    test: { readable: true, matchingReportRows: 0 },
  });
  expect(r.body.test.message).toContain("does not prove zero");
  expect(
    await db.integration.findUnique({ where: { provider: "google" } }),
  ).toEqual(connection);
  expect(
    await db.automationSettings.findUnique({ where: { id: "owner" } }),
  ).toEqual(automation);
  expect(
    await db.editorialSettings.findUnique({ where: { id: "owner" } }),
  ).toEqual(editorial);
  expect(
    (await db.reportingSettings.findUniqueOrThrow({ where: { id: "owner" } }))
      .searchConsoleSiteUrl,
  ).toBe(blog);
  expect(await db.trafficMetric.count()).toBe(0);
});
test("read grant and API failures are actionable and do not expose provider secrets", async () => {
  jest
    .spyOn(app.get(GoogleService), "reportingPermissions")
    .mockResolvedValue({ analytics: false, searchConsole: true });
  await save().expect(400);
  jest
    .spyOn(app.get(GoogleService), "reportingPermissions")
    .mockResolvedValue({ analytics: true, searchConsole: true });
  jest
    .spyOn(adapter, "report")
    .mockRejectedValue({
      response: {
        status: 403,
        data: { error: { details: [{ reason: "SERVICE_DISABLED" }] } },
      },
      message: "PRIVATE_PROVIDER_TOKEN",
    });
  const r = await save().expect(400);
  expect(r.body.message).toContain("Google Analytics Data API");
  expect(JSON.stringify(r.body)).not.toContain("PRIVATE_PROVIDER_TOKEN");
  expect(
    (await db.reportingSettings.findUniqueOrThrow({ where: { id: "owner" } }))
      .gaPropertyId,
  ).toBeNull();
});
test("stale settings and blog changes during the access test cannot be saved", async () => {
  await save().expect(200);
  await save().expect(409);
  jest.spyOn(adapter, "report").mockImplementation(async () => {
    await db.integration.update({
      where: { provider: "google" },
      data: { blogUrl: "https://changed.example/" },
    });
    return { rows: [], rowCount: 0 };
  });
  await save({
    propertyId: "999",
    measurementId: "G-NEW12345",
    revision: 1,
  }).expect(409);
  expect(
    (await db.reportingSettings.findUniqueOrThrow({ where: { id: "owner" } }))
      .gaPropertyId,
  ).toBe("123456789");
});
test("changed Blogger destinations block testing and importing the old Analytics selection", async () => {
  await save().expect(200);
  await db.integration.update({
    where: { provider: "google" },
    data: { blogUrl: "https://changed.example/" },
  });
  expect((await ga.configuration()).destinationChanged).toBe(true);
  await expect(ga.test()).rejects.toThrow("changed");
  await expect(ga.sync("2026-11-01", "2026-11-16")).rejects.toThrow(
    "destination changed",
  );
});
test("test connection reads only and empty imports do not fabricate zero traffic", async () => {
  await save().expect(200);
  await agent
    .post("/api/integrations/analytics/test")
    .set("Origin", origin)
    .set("X-CSRF-Token", csrf)
    .expect(201);
  expect(
    await app.get(ReportingService).analytics("2026-11-01", "2026-11-16"),
  ).toMatchObject({ imported: 0, empty: true });
  expect(await db.trafficMetric.count()).toBe(0);
});
test("actual pageviews including explicit zero import idempotently for the selected blog", async () => {
  await save().expect(200);
  jest
    .spyOn(adapter, "report")
    .mockResolvedValue({ rows: [row("0")], rowCount: 1 });
  expect((await ga.sync("2026-11-01", "2026-11-16")).imported).toBe(1);
  await ga.sync("2026-11-01", "2026-11-16");
  expect(await db.trafficMetric.count()).toBe(1);
  expect(await db.trafficMetric.findFirst()).toMatchObject({
    pageviews: 0,
    source: "GOOGLE_ANALYTICS",
    url: blog + "post",
  });
});
test("invalid, foreign-domain and out-of-range report rows cannot partially overwrite traffic", async () => {
  await save().expect(200);
  for (const bad of [
    row("4", "https://foreign.example/post"),
    row("4", blog + "post", "20260230"),
    row("-1"),
  ]) {
    jest
      .spyOn(adapter, "report")
      .mockResolvedValue({
        rows: [row("4", blog + "valid"), bad],
        rowCount: 2,
      });
    await expect(ga.sync("2026-11-01", "2026-11-16")).rejects.toThrow(
      "invalid",
    );
  }
  expect(await db.trafficMetric.count()).toBe(0);
});
test("later-page failures retain old pageviews rather than writing a partial import", async () => {
  await save().expect(200);
  await db.trafficMetric.create({
    data: {
      date: new Date("2026-11-15T00:00:00Z"),
      url: blog + "old",
      source: "GOOGLE_ANALYTICS",
      pageviews: 8,
    },
  });
  jest
    .spyOn(adapter, "report")
    .mockResolvedValueOnce({
      rows: Array.from({ length: 10000 }, (_, i) =>
        row("2", blog + "post/" + i),
      ),
      rowCount: 10001,
    })
    .mockRejectedValueOnce({ response: { status: 503 }, message: "SECRET" });
  await expect(ga.sync("2026-11-01", "2026-11-16")).rejects.toThrow(
    "could not complete",
  );
  expect(await db.trafficMetric.count()).toBe(1);
  expect((await db.trafficMetric.findFirst())?.pageviews).toBe(8);
});
test("a property selection change during import invalidates the full report", async () => {
  await save().expect(200);
  jest.spyOn(adapter, "report").mockImplementation(async () => {
    await db.reportingSettings.update({
      where: { id: "owner" },
      data: { gaRevision: { increment: 1 } },
    });
    return { rows: [row()], rowCount: 1 };
  });
  await expect(ga.sync("2026-11-01", "2026-11-16")).rejects.toThrow(
    "changed during import",
  );
  expect(await db.trafficMetric.count()).toBe(0);
});
