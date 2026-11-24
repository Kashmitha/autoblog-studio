import "reflect-metadata";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { PrismaService } from "../src/infrastructure/prisma.service";
import { hashPassword } from "../src/domain/security";
import { GoogleService } from "../src/infrastructure/blogger.service";
import { AnalyticsAdapter } from "../src/infrastructure/analytics.adapter";
import { SearchConsoleAdapter } from "../src/infrastructure/search-console.adapter";
import { AnalyticsConnectionService } from "../src/application/analytics-connection.service";
import { SearchConsoleService } from "../src/application/search-console.service";
let app: INestApplication,
  db: PrismaService,
  agent: ReturnType<typeof request.agent>,
  csrf: string,
  id: string;
const origin = "http://localhost:3100",
  blog = "https://growth-fixture.blogspot.com/";
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/autoblog_test")
    throw Error("Isolated test database required");
  app = await createApp();
  await app.init();
  db = app.get(PrismaService);
  await db.user.upsert({
    where: { email: "growth@localhost" },
    create: {
      email: "growth@localhost",
      passwordHash: hashPassword("growth-password-long-123"),
    },
    update: { passwordHash: hashPassword("growth-password-long-123") },
  });
  agent = request.agent(app.getHttpServer());
  csrf = (
    await agent
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: "growth@localhost", password: "growth-password-long-123" })
      .expect(201)
  ).body.csrfToken;
  await db.integration.upsert({
    where: { provider: "google" },
    create: { provider: "google", encryptedTokens: "unused", blogUrl: blog },
    update: { blogUrl: blog },
  });
  id = (
    await db.article.create({
      data: {
        title: "Docker volume growth fixture",
        slug: "growth-fixture",
        niche: "Docker",
        intent: "Explain persistent Docker volumes",
        labels: ["Docker"],
        html: "<p>Explanation</p>",
        excerpt: "Keep persistent files.",
        status: "PUBLISHED",
        publishedUrl: blog + "docker.html",
        publishedAt: new Date(),
      },
    })
  ).id;
});
beforeEach(() => jest.restoreAllMocks());
afterAll(async () => {
  jest.restoreAllMocks();
  await app?.close();
});
test("growth endpoints require login, mutation CSRF and valid periods; packs don't change published articles", async () => {
  await request(app.getHttpServer()).get("/api/growth/articles").expect(401);
  await agent
    .post("/api/growth/reports")
    .set("Origin", origin)
    .send({ days: 28 })
    .expect(403);
  await agent
    .post("/api/growth/reports")
    .set("Origin", origin)
    .set("X-CSRF-Token", csrf)
    .send({ days: 365 })
    .expect(400);
  const before = await db.article.findUniqueOrThrow({ where: { id } });
  const pack = await agent
    .get(`/api/growth/articles/${id}/promotion`)
    .expect(200);
  expect(pack.body.channels[0].url).toContain("utm_source=linkedin");
  expect(await db.article.findUniqueOrThrow({ where: { id } })).toEqual(before);
  const draft = await db.article.create({
    data: { title: "Unpublished growth fixture", slug: "growth-draft" },
  });
  await agent.get(`/api/growth/articles/${draft.id}/promotion`).expect(404);
});
test("creating the same query research brief twice is idempotent and never approves or queues publication", async () => {
  const send = (url = blog + "docker.html") =>
    agent
      .post("/api/growth/research-briefs")
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .send({ query: "docker volume restore", url });
  const first = await send().expect(201),
    second = await send().expect(201);
  expect(first.body.created).toBe(true);
  expect(second.body).toEqual({ id: first.body.id, created: false });
  const a = await db.article.findUniqueOrThrow({
    where: { id: first.body.id },
  });
  expect(a.status).toBe("PLANNED");
  expect(a.html).toBe("");
  expect(a.approvedAt).toBeNull();
  expect(await db.publishJob.count({ where: { articleId: a.id } })).toBe(0);
  await send("https://elsewhere.example/post").expect(400);
});
test("audience reports separate empty, failure and successful rows, pin the blog host and reuse reads", async () => {
  jest
    .spyOn(app.get(GoogleService), "reportingPermissions")
    .mockResolvedValue({ analytics: true, searchConsole: true });
  jest
    .spyOn(app.get(AnalyticsConnectionService), "configuration")
    .mockResolvedValue({
      propertyId: "12345",
      blogUrl: blog,
      configured: true,
      readAccess: true,
      revision: 1,
      propertyTimeZone: "Asia/Colombo",
    } as never);
  jest.spyOn(app.get(SearchConsoleService), "property").mockResolvedValue(blog);
  const adapter = jest
    .spyOn(app.get(AnalyticsAdapter), "audience")
    .mockImplementation(async (_id, host, _start, _end, dimension) => {
      expect(host).toBe("growth-fixture.blogspot.com");
      if (dimension === "pagePath")
        throw Error("provider private details must not leak");
      return {
        rows:
          dimension === "country"
            ? [
                {
                  dimensionValues: [{ value: "Canada" }],
                  metricValues: [
                    { value: "5" },
                    { value: "3" },
                    { value: "0.6" },
                    { value: "8" },
                  ],
                },
              ]
            : [],
      };
    });
  jest.spyOn(app.get(SearchConsoleAdapter), "queries").mockResolvedValue({
    rows: [
      {
        keys: ["docker volume", blog + "docker.html"],
        clicks: 0,
        impressions: 30,
        ctr: 0,
        position: 10,
      },
    ],
  });
  const read = () =>
    agent
      .post("/api/growth/reports")
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .send({ days: 7 });
  const result = await read().expect(201);
  expect(result.body.audience[0].rows[0]).toMatchObject({
    label: "Canada",
    sessions: 5,
    engagementRate: 0.6,
  });
  expect(result.body.audience[1].status).toBe("EMPTY");
  expect(result.body.audience[3].status).toBe("ERROR");
  expect(JSON.stringify(result.body)).not.toContain("provider private");
  expect(result.body.queries.rows[0].clicks).toBe(0);
  await read().expect(201);
  expect(adapter).toHaveBeenCalledTimes(4);
});

test("audience reports pin the blog host, keep partial failures separate and cache Google reads", async () => {
  jest
    .spyOn(app.get(GoogleService), "reportingPermissions")
    .mockResolvedValue({ analytics: true, searchConsole: true });
  jest
    .spyOn(app.get(AnalyticsConnectionService), "configuration")
    .mockResolvedValue({
      propertyId: "123456",
      configured: true,
      blogUrl: blog,
      revision: 42,
      propertyTimeZone: "Asia/Colombo",
    } as Awaited<ReturnType<AnalyticsConnectionService["configuration"]>>);
  jest.spyOn(app.get(SearchConsoleService), "property").mockResolvedValue(blog);
  const ga = jest
    .spyOn(app.get(AnalyticsAdapter), "audience")
    .mockImplementation(async (_property, _host, _start, _end, dimension) => {
      if (dimension === "sessionSourceMedium")
        throw Error("Private upstream error with credentials");
      return {
        rows:
          dimension === "country"
            ? [
                {
                  dimensionValues: [{ value: "Canada" }],
                  metricValues: [
                    { value: "8" },
                    { value: "4" },
                    { value: "0.5" },
                    { value: "12" },
                  ],
                },
              ]
            : [],
      };
    });
  const queries = jest
    .spyOn(app.get(SearchConsoleAdapter), "queries")
    .mockResolvedValue({
      rows: [
        {
          keys: ["docker storage", blog + "docker.html"],
          clicks: 0,
          impressions: 80,
          ctr: 0,
          position: 10,
        },
      ],
    });
  const read = () =>
    agent
      .post("/api/growth/reports")
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .send({ days: 28 })
      .expect(201);
  const report = (await read()).body;
  expect(
    report.audience.find(
      (r: { dimension: string }) => r.dimension === "country",
    ).rows[0],
  ).toMatchObject({ label: "Canada", sessions: 8, engagementRate: 0.5 });
  expect(
    report.audience.find(
      (r: { dimension: string }) => r.dimension === "sessionSourceMedium",
    ).status,
  ).toBe("ERROR");
  expect(JSON.stringify(report)).not.toContain("credentials");
  expect(report.queries.rows[0]).toMatchObject({
    query: "docker storage",
    clicks: 0,
  });
  expect(
    ga.mock.calls.every(
      (call) =>
        call[0] === "123456" && call[1] === "growth-fixture.blogspot.com",
    ),
  ).toBe(true);
  expect(report.gaTimeZone).toBe("Asia/Colombo");
  await read();
  expect(ga).toHaveBeenCalledTimes(4);
  expect(queries).toHaveBeenCalledTimes(1);
});
