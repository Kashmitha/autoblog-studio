import "reflect-metadata";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { PrismaService } from "../src/infrastructure/prisma.service";
import { hashPassword } from "../src/domain/security";

let app: INestApplication,
  db: PrismaService,
  agent: ReturnType<typeof request.agent>,
  csrf: string;
const csv =
  "Date,Impressions,Clicks,CTR,CPM,Revenue\r\n2026/11/09,4,0,0%,$0.003,$0\r\n2026/11/06,8,1,12.5%,$0.002,$0";
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/autoblog_test")
    throw new Error("Ad reports require isolated test database");
  app = await createApp();
  await app.init();
  db = app.get(PrismaService);
  await db.user.upsert({
    where: { email: "ad-reports@localhost" },
    create: {
      email: "ad-reports@localhost",
      passwordHash: hashPassword("ad-report-test-password"),
    },
    update: {},
  });
  agent = request.agent(app.getHttpServer());
  const login = await agent
    .post("/api/auth/login")
    .set("Origin", "http://localhost:3100")
    .send({
      email: "ad-reports@localhost",
      password: "ad-report-test-password",
    })
    .expect(201);
  csrf = login.body.csrfToken;
});
beforeEach(async () => {
  await db.adReport.deleteMany();
});
afterAll(async () => {
  await db.adReport.deleteMany();
  await db.user.deleteMany({ where: { email: "ad-reports@localhost" } });
  await app.close();
});
function save(text = csv, scope = "All Domains") {
  return agent
    .post("/api/finance/ad-reports")
    .set("Origin", "http://localhost:3100")
    .set("X-CSRF-Token", csrf)
    .field("filename", "stats.csv")
    .field("scopeLabel", scope)
    .field("timezoneLabel", "GMT+00:00")
    .attach("file", Buffer.from(text), "stats.csv");
}

test("history and detail require owner session; saves require origin and CSRF", async () => {
  await request(app.getHttpServer()).get("/api/finance/ad-reports").expect(401);
  await request(app.getHttpServer())
    .get("/api/finance/ad-reports/unknown")
    .expect(401);
  await agent
    .post("/api/finance/ad-reports")
    .set("Origin", "http://localhost:3100")
    .expect(403);
  await agent
    .post("/api/finance/ad-reports")
    .set("Origin", "https://other.invalid")
    .set("X-CSRF-Token", csrf)
    .expect(403);
});

test("persisted report survives reload with source labels and no ledger or traffic changes", async () => {
  const before = [
    await db.financeEntry.count(),
    await db.trafficMetric.count(),
    await db.publishJob.count(),
  ];
  const saved = await save().expect(201);
  expect(saved.body.report).toMatchObject({
    impressions: 12,
    clicks: 1,
    revenue: 0,
  });
  expect(saved.body).not.toHaveProperty("csv");
  const list = await agent.get("/api/finance/ad-reports").expect(200);
  expect(list.headers["cache-control"]).toBe("no-store");
  expect(list.body).toHaveLength(1);
  expect(list.body[0]).not.toHaveProperty("report");
  const detail = await agent
    .get("/api/finance/ad-reports/" + saved.body.id)
    .expect(200);
  expect(detail.headers["cache-control"]).toBe("no-store");
  expect(detail.body).toMatchObject({
    filename: "stats.csv",
    scopeLabel: "All Domains",
    timezoneLabel: "GMT+00:00",
    report: saved.body.report,
  });
  expect([
    await db.financeEntry.count(),
    await db.trafficMetric.count(),
    await db.publishJob.count(),
  ]).toEqual(before);
  await agent.get("/api/finance/ad-reports/missing").expect(404);
});

test("concurrent identical saves and reordered daily rows deduplicate", async () => {
  const results = await Promise.all([save(), save(), save()]);
  for (const result of results) expect(result.status).toBe(201);
  expect(new Set(results.map((result) => result.body.id)).size).toBe(1);
  const lines = csv.split("\r\n");
  await save([lines[0], lines[2], lines[1]].join("\n")).expect(201);
  expect(await db.adReport.count()).toBe(1);
});

test("revised and differently scoped overlapping snapshots stay separate", async () => {
  await save().expect(201);
  await save(csv.replace(",4,0,", ",5,0,")).expect(201);
  await save(csv, "Selected blog").expect(201);
  expect(await db.adReport.count()).toBe(3);
});

test("invalid data, unknown fields, missing files and oversize uploads write nothing", async () => {
  await save(csv + "\r\n2026/11/09,4,0,0%,$0,$0").expect(400);
  await save("x".repeat(1_000_001)).expect(413);
  await agent
    .post("/api/finance/ad-reports")
    .set("Origin", "http://localhost:3100")
    .set("X-CSRF-Token", csrf)
    .send({ filename: "stats.csv", scopeLabel: "", timezoneLabel: "" })
    .expect(400);
  await agent
    .post("/api/finance/ad-reports")
    .set("Origin", "http://localhost:3100")
    .set("X-CSRF-Token", csrf)
    .send({
      filename: "stats.csv",
      scopeLabel: "",
      timezoneLabel: "",
      unexpected: true,
    })
    .expect(400);
  expect(await db.adReport.count()).toBe(0);
});
