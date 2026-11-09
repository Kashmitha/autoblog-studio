import "reflect-metadata";
import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { PrismaService } from "../src/infrastructure/prisma.service";
import { SearchConsoleService } from "../src/application/search-console.service";
import { ReportingService } from "../src/application/reporting.service";
import { MetricsService } from "../src/application/metrics.service";
import { ReportReadError } from "../src/domain/reporting";
import { hashPassword } from "../src/domain/security";
let app: INestApplication,
  db: PrismaService,
  agent: ReturnType<typeof request.agent>,
  csrf: string,
  reporting: ReportingService,
  metrics: MetricsService;
const origin = "http://localhost:3100",
  site = "https://sync-fixture.example/";
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/autoblog_test")
    throw new Error("Sync tests require isolated autoblog_test database");
  app = await createApp();
  await app.init();
  db = app.get(PrismaService);
  reporting = app.get(ReportingService);
  metrics = app.get(MetricsService);
  await db.user.upsert({
    where: { email: "sync-fixture@localhost" },
    create: {
      email: "sync-fixture@localhost",
      passwordHash: hashPassword("isolated-sync-password-123"),
    },
    update: { passwordHash: hashPassword("isolated-sync-password-123") },
  });
  agent = request.agent(app.getHttpServer());
  const login = await agent
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({
      email: "sync-fixture@localhost",
      password: "isolated-sync-password-123",
    })
    .expect(201);
  csrf = login.body.csrfToken;
});
beforeEach(async () => {
  jest.restoreAllMocks();
  await db.trafficSync.deleteMany();
  await db.trafficMetric.deleteMany();
  jest.spyOn(app.get(SearchConsoleService), "configuration").mockResolvedValue({
    siteUrl: site,
    configured: true,
    readAccess: true,
    googleConnected: true,
    googleConfigured: true,
  });
  jest
    .spyOn(reporting, "searchConsole")
    .mockResolvedValue({ imported: 0, note: "No fake Google traffic saved" });
});
afterAll(async () => {
  jest.restoreAllMocks();
  await app?.close();
});
const post = (path: string, body: object = {}) =>
  agent
    .post("/api" + path)
    .set("Origin", origin)
    .set("X-CSRF-Token", csrf)
    .send(body);
const due = () => post("/reports/search-console/refresh-due");
test("sync history and refresh require a session, Origin and CSRF", async () => {
  await request(app.getHttpServer())
    .get("/api/reports/search-console/status")
    .expect(401);
  await request(app.getHttpServer())
    .post("/api/reports/search-console/refresh-due")
    .set("Origin", origin)
    .send({})
    .expect(401);
  await agent
    .post("/api/reports/search-console/refresh-due")
    .set("Origin", origin)
    .send({})
    .expect(403);
  await agent
    .post("/api/reports/search-console/refresh-due")
    .set("Origin", "https://untrusted.example")
    .set("X-CSRF-Token", csrf)
    .send({})
    .expect(403);
  expect(reporting.searchConsole).not.toHaveBeenCalled();
});
test("concurrent tabs share a durable claim and a successful empty result stays empty for 24 hours", async () => {
  const replies = await Promise.all([due(), due(), due()]);
  for (const reply of replies) expect(reply.status).toBe(201);
  expect(reporting.searchConsole).toHaveBeenCalledTimes(1);
  expect(await db.trafficSync.count()).toBe(1);
  expect(replies.filter((r) => !r.body.skipped)).toHaveLength(1);
  const status = await agent
    .get("/api/reports/search-console/status")
    .expect(200);
  expect(status.body.lastSuccess.state).toBe("EMPTY");
  expect(status.body.lastSuccess.imported).toBe(0);
  expect(
    new Date(status.body.lastAttempt.endDate).getTime() -
      new Date(status.body.lastAttempt.startDate).getTime(),
  ).toBe(55 * 86400000);
  await due();
  expect(reporting.searchConsole).toHaveBeenCalledTimes(1);
  expect(await db.trafficMetric.count()).toBe(0);
});
test("a later daily refresh switches from the initial 56-day backfill to 7 days", async () => {
  await due();
  await db.trafficSync.updateMany({
    data: {
      startedAt: new Date(Date.now() - 25 * 3600000),
      finishedAt: new Date(Date.now() - 25 * 3600000),
    },
  });
  const r = await due().expect(201);
  expect(
    new Date(r.body.sync.endDate).getTime() -
      new Date(r.body.sync.startDate).getTime(),
  ).toBe(6 * 86400000);
  expect(reporting.searchConsole).toHaveBeenCalledTimes(2);
});
test("failed imports retain the last success and saved metrics, sanitize errors and back off", async () => {
  await due();
  await db.trafficSync.updateMany({
    data: {
      startedAt: new Date(Date.now() - 25 * 3600000),
      finishedAt: new Date(Date.now() - 25 * 3600000),
    },
  });
  await db.trafficMetric.create({
    data: {
      date: new Date("2026-11-01"),
      url: site + "post",
      source: "SEARCH_CONSOLE",
      clicks: 2,
      impressions: 10,
    },
  });
  jest
    .spyOn(reporting, "searchConsole")
    .mockRejectedValue({ response: { status: 429 }, message: "SECRET_TOKEN" });
  const r = await due().expect(201);
  expect(r.body.sync.state).toBe("FAILED");
  expect(r.body.sync.errorCode).toBe("QUOTA");
  expect(JSON.stringify(r.body)).not.toContain("SECRET");
  await due();
  expect(reporting.searchConsole).toHaveBeenCalledTimes(2);
  const status = await agent.get("/api/reports/search-console/status");
  expect(status.body.lastSuccess.state).toBe("EMPTY");
  expect(status.body.lastAttempt.state).toBe("FAILED");
  expect((await db.trafficMetric.findFirstOrThrow()).clicks).toBe(2);
});
test("manual imports record their dates and reuse a recent identical import", async () => {
  const dates = { start: "2026-11-01", end: "2026-11-02" };
  await post("/integrations/search-console/sync", dates).expect(201);
  const repeat = await post("/integrations/search-console/sync", dates).expect(
    201,
  );
  expect(repeat.body.skipped).toBe(true);
  expect(await db.trafficSync.count()).toBe(1);
  expect(reporting.searchConsole).toHaveBeenCalledWith(
    dates.start,
    dates.end,
    site,
  );
  await post("/integrations/search-console/sync", {
    start: "2026-02-30",
    end: "2026-03-01",
  }).expect(400);
  expect(reporting.searchConsole).toHaveBeenCalledTimes(1);
});
test("missing setup and another property never inherit sync history or trigger unauthorized reads", async () => {
  await due();
  jest.spyOn(app.get(SearchConsoleService), "configuration").mockResolvedValue({
    siteUrl: "https://other.example/",
    configured: true,
    readAccess: false,
    googleConnected: true,
    googleConfigured: true,
  });
  const status = await agent.get("/api/reports/search-console/status");
  expect(status.body.history).toHaveLength(0);
  expect(status.body.lastSuccess).toBeNull();
  const r = await due().expect(201);
  expect(r.body.skipped).toBe(true);
  expect(reporting.searchConsole).toHaveBeenCalledTimes(1);
});
test("a stale unfinished import is marked interrupted and can be retried without blind duplicate creation", async () => {
  const stale = await db.trafficSync.create({
    data: {
      siteUrl: site,
      trigger: "automatic",
      state: "RUNNING",
      startDate: new Date("2026-11-01"),
      endDate: new Date("2026-11-02"),
      startedAt: new Date(Date.now() - 2 * 3600000),
    },
  });
  await due().expect(201);
  expect(
    (await db.trafficSync.findUniqueOrThrow({ where: { id: stale.id } }))
      .errorCode,
  ).toBe("INTERRUPTED");
  expect(reporting.searchConsole).toHaveBeenCalledTimes(1);
  expect(await db.trafficSync.count()).toBe(2);
});
test("bulk report imports are atomic, idempotent, preserve true zeros and retain known missing-field values", async () => {
  const rows = [
    { date: "2026-11-01", url: site + "post", clicks: 0, impressions: 5 },
    { date: "2026-11-02", url: site + "post", impressions: 10 },
  ];
  expect(await metrics.searchTraffic(rows)).toBe(2);
  expect(await metrics.searchTraffic(rows)).toBe(2);
  expect(await db.trafficMetric.count()).toBe(2);
  await metrics.searchTraffic([
    { date: "2026-11-01", url: site + "post", impressions: 8 },
  ]);
  const previous = await db.trafficMetric.findMany({
    orderBy: { date: "asc" },
  });
  expect(previous[0].clicks).toBe(0);
  expect(previous[1].clicks).toBeNull();
  await expect(
    metrics.searchTraffic([
      { date: "2026-11-01", url: site + "post", clicks: 1, impressions: 8 },
      { date: "2026-02-30", url: site + "bad", clicks: 2 },
    ]),
  ).rejects.toThrow("invalid search metrics");
  expect(await db.trafficMetric.findMany({ orderBy: { date: "asc" } })).toEqual(
    previous,
  );
});
test("a changed-property read failure is recorded without replacing successful history", async () => {
  jest
    .spyOn(reporting, "searchConsole")
    .mockRejectedValue(
      new ReportReadError(
        "PROPERTY_CHANGED",
        "The selected property changed. Reload before importing.",
      ),
    );
  const r = await due().expect(201);
  expect(r.body.sync.errorCode).toBe("PROPERTY_CHANGED");
  expect(r.body.sync.state).toBe("FAILED");
  expect(await db.trafficMetric.count()).toBe(0);
});
