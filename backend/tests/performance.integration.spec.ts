import "reflect-metadata";
import request from "supertest";
import { DateTime } from "luxon";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { PrismaService } from "../src/infrastructure/prisma.service";
import { hashPassword } from "../src/domain/security";
import { parse } from "csv-parse/sync";
let app: INestApplication,
  db: PrismaService,
  agent: ReturnType<typeof request.agent>,
  articleId: string;
const end = DateTime.now()
  .setZone("America/Los_Angeles")
  .startOf("day")
  .minus({ days: 1 });
const day = (offset: number) =>
  new Date(end.minus({ days: offset }).toISODate()! + "T00:00:00Z");
const url = "https://fixture.blogspot.com/post.html";
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/autoblog_test")
    throw new Error(
      "Performance tests require isolated autoblog_test database",
    );
  app = await createApp();
  await app.init();
  db = app.get(PrismaService);
  await db.user.upsert({
    where: { email: "performance@localhost" },
    create: {
      email: "performance@localhost",
      passwordHash: hashPassword("isolated-performance-password-123"),
    },
    update: { passwordHash: hashPassword("isolated-performance-password-123") },
  });
  agent = request.agent(app.getHttpServer());
  await agent
    .post("/api/auth/login")
    .set("Origin", "http://localhost:3100")
    .send({
      email: "performance@localhost",
      password: "isolated-performance-password-123",
    })
    .expect(201);
});
beforeEach(async () => {
  await db.publishJob.deleteMany();
  await db.article.deleteMany();
  await db.trafficMetric.deleteMany();
  const article = await db.article.create({
    data: {
      title: "=Spreadsheet formula fixture",
      slug: "performance-fixture",
      status: "PUBLISHED",
      publishedUrl: url,
      publishedAt: day(1),
      html: "<p>Unchanged</p>",
      approvedAt: day(2),
    },
  });
  articleId = article.id;
});
afterAll(async () => {
  await app?.close();
});
test("performance and CSV endpoints require a signed-in owner and reject unsupported periods", async () => {
  await request(app.getHttpServer()).get("/api/traffic/articles").expect(401);
  await request(app.getHttpServer())
    .get("/api/traffic/articles/export")
    .expect(401);
  await agent.get("/api/traffic/articles?days=999").expect(400);
  await agent.get("/api/traffic/articles/export?days=2").expect(400);
});
test("a published article without recorded traffic is listed with nulls, and scheduled posts stay excluded", async () => {
  await db.article.create({
    data: {
      title: "Future fixture",
      slug: "future-performance",
      status: "SCHEDULED",
      publishedUrl: "https://fixture.blogspot.com/future.html",
    },
  });
  const r = await agent.get("/api/traffic/articles?days=7").expect(200);
  expect(r.body.articles).toHaveLength(1);
  expect(r.body.articles[0].current).toMatchObject({
    clicks: null,
    impressions: null,
    pageviews: null,
    daysReported: 0,
  });
  expect(r.body.current.end).toBe(end.toISODate());
  expect(r.body.previous.end).toBe(end.minus({ days: 7 }).toISODate());
});
test("URL variants match the right article, source totals do not double count, and date boundaries are inclusive", async () => {
  await db.trafficMetric.createMany({
    data: [
      {
        date: day(0),
        url,
        source: "SEARCH_CONSOLE",
        clicks: 3,
        impressions: 10,
      },
      {
        date: day(6),
        url: url + "?m=1",
        source: "SEARCH_CONSOLE",
        clicks: 1,
        impressions: 10,
      },
      {
        date: day(7),
        url,
        source: "SEARCH_CONSOLE",
        clicks: 2,
        impressions: 20,
      },
      {
        date: day(13),
        url,
        source: "SEARCH_CONSOLE",
        clicks: 0,
        impressions: 0,
      },
      {
        date: day(14),
        url,
        source: "SEARCH_CONSOLE",
        clicks: 999,
        impressions: 9999,
      },
      {
        date: day(-1),
        url,
        source: "SEARCH_CONSOLE",
        clicks: 999,
        impressions: 9999,
      },
      {
        date: day(0),
        url,
        source: "MANUAL",
        clicks: 300,
        impressions: 1000,
        pageviews: 500,
      },
      { date: day(0), url, source: "GOOGLE_ANALYTICS", pageviews: 8 },
      {
        date: day(0),
        url: "",
        source: "SEARCH_CONSOLE",
        clicks: 500,
        impressions: 5000,
      },
      {
        date: day(0),
        url: "https://other.blogspot.com/post.html",
        source: "SEARCH_CONSOLE",
        clicks: 500,
        impressions: 5000,
      },
    ],
  });
  const before = await db.article.findUniqueOrThrow({
    where: { id: articleId },
  });
  const r = await agent.get("/api/traffic/articles?days=7").expect(200);
  expect(r.body.articles[0]).toMatchObject({
    current: {
      clicks: 4,
      impressions: 20,
      pageviews: 8,
      ctr: 20,
      daysReported: 2,
    },
    previous: { clicks: 2, impressions: 20 },
    changes: { clicks: { absolute: 2, percent: 100 } },
    viewSource: "GOOGLE_ANALYTICS",
    searchSource: "SEARCH_CONSOLE",
  });
  expect(
    await db.article.findUniqueOrThrow({ where: { id: articleId } }),
  ).toEqual(before);
  expect(await db.publishJob.count()).toBe(0);
});
test("CSV safely exports text, blank unknown metrics and genuine zero values", async () => {
  await db.trafficMetric.create({
    data: {
      date: day(0),
      url,
      source: "SEARCH_CONSOLE",
      clicks: 0,
      impressions: 0,
    },
  });
  const csv = await agent
    .get("/api/traffic/articles/export?days=28")
    .expect(200);
  expect(csv.headers["content-type"]).toContain("text/csv");
  expect(csv.headers["content-disposition"]).toContain(
    "article-performance-28-days.csv",
  );
  const rows = parse(csv.text, { columns: true, bom: true }) as Record<
    string,
    string
  >[];
  expect(rows[0].article_title).toBe("'=Spreadsheet formula fixture");
  expect(rows[0].clicks).toBe("0");
  expect(rows[0].pageviews).toBe("");
  expect(rows[0].ctr_percent).toBe("");
});
