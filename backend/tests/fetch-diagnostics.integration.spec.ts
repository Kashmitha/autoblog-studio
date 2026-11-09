import "reflect-metadata";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { PrismaService } from "../src/infrastructure/prisma.service";
import { DiagnosticFetcher } from "../src/infrastructure/diagnostic-fetcher";
import { SearchConsoleService } from "../src/application/search-console.service";
import { hashPassword } from "../src/domain/security";
let app: INestApplication,
  db: PrismaService,
  agent: ReturnType<typeof request.agent>,
  csrf: string,
  id: string,
  fetcher: DiagnosticFetcher;
const origin = "http://localhost:3100",
  url = "https://fixture.blogspot.com/post.html";
const clean = () => ({
  outcome: "NO_ISSUE_REPRODUCED",
  profiles: [],
  scriptsExecuted: false,
  limitation: "Not a Google test",
});
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/autoblog_test")
    throw new Error("Diagnostics require isolated autoblog_test database");
  app = await createApp();
  await app.init();
  db = app.get(PrismaService);
  fetcher = app.get(DiagnosticFetcher);
  await db.user.upsert({
    where: { email: "diagnostic@localhost" },
    create: {
      email: "diagnostic@localhost",
      passwordHash: hashPassword("isolated-diagnostic-password-123"),
    },
    update: { passwordHash: hashPassword("isolated-diagnostic-password-123") },
  });
  agent = request.agent(app.getHttpServer());
  const login = await agent
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({
      email: "diagnostic@localhost",
      password: "isolated-diagnostic-password-123",
    })
    .expect(201);
  csrf = login.body.csrfToken;
});
beforeEach(async () => {
  jest.restoreAllMocks();
  await db.publishJob.deleteMany();
  await db.article.deleteMany();
  await db.integration.upsert({
    where: { provider: "google" },
    create: {
      provider: "google",
      blogUrl: "https://fixture.blogspot.com/",
      encryptedTokens: "not used",
    },
    update: { blogUrl: "https://fixture.blogspot.com/" },
  });
  const a = await db.article.create({
    data: {
      title: "Diagnostic fixture",
      slug: "diagnostic-fixture",
      status: "PUBLISHED",
      publishedUrl: url,
      approvedAt: new Date(),
      html: "<p>Unchanged approved body</p>",
    },
  });
  id = a.id;
  jest.spyOn(fetcher, "check").mockResolvedValue(clean() as never);
  jest.spyOn(app.get(SearchConsoleService), "report").mockResolvedValue({
    latest: {
      state: "NOT_INDEXED",
      coverageState: "Redirect error",
      lastCrawlTime: new Date("2026-11-06T12:07:27Z"),
      checkedAt: new Date("2026-11-06T12:50:53Z"),
      inspectionResultLink: null,
    },
  } as never);
});
afterAll(async () => {
  jest.restoreAllMocks();
  await app?.close();
});
const run = () =>
  agent
    .post("/api/seo/articles/" + id + "/fetch-diagnostics/run")
    .set("Origin", origin)
    .set("X-CSRF-Token", csrf)
    .send({});
test("diagnostics and exports require owner authentication; running also requires Origin and CSRF", async () => {
  await request(app.getHttpServer())
    .get("/api/seo/articles/" + id + "/fetch-diagnostics")
    .expect(401);
  await request(app.getHttpServer())
    .get("/api/seo/articles/" + id + "/fetch-diagnostics/export")
    .expect(401);
  await agent
    .post("/api/seo/articles/" + id + "/fetch-diagnostics/run")
    .set("Origin", origin)
    .send({})
    .expect(403);
  expect(fetcher.check).not.toHaveBeenCalled();
});
test("reading a saved report does not fetch pages; concurrent runs share one check without changing publishing or Google records", async () => {
  const before = await db.article.findUniqueOrThrow({ where: { id } });
  await agent.get("/api/seo/articles/" + id + "/fetch-diagnostics").expect(200);
  expect(fetcher.check).not.toHaveBeenCalled();
  const replies = await Promise.all([run(), run(), run()]);
  for (const reply of replies) expect(reply.status).toBe(201);
  expect(fetcher.check).toHaveBeenCalledTimes(1);
  expect(await db.fetchDiagnostic.count()).toBe(1);
  expect(replies.filter((r) => !r.body.cached)).toHaveLength(1);
  const r = await run().expect(201);
  expect(r.body.latest.result.outcome).toBe("NO_ISSUE_REPRODUCED");
  expect(r.body.google.coverageState).toBe("Redirect error");
  expect(r.body.latest.result.googleAtCheck.lastCrawlTime).toBe(
    "2026-11-06T12:07:27.000Z",
  );
  expect(await db.article.findUniqueOrThrow({ where: { id } })).toEqual(before);
  expect(await db.publishJob.count()).toBe(0);
  expect(await db.indexInspection.count()).toBe(0);
});
test("scheduled and outside-blog URLs cannot trigger diagnostic fetches or supply arbitrary targets", async () => {
  await db.article.update({ where: { id }, data: { status: "SCHEDULED" } });
  await run().expect(400);
  await db.article.update({
    where: { id },
    data: { status: "PUBLISHED", publishedUrl: "https://other.example/post" },
  });
  await run().expect(400);
  await db.article.update({
    where: { id },
    data: { publishedUrl: "http://fixture.blogspot.com/post" },
  });
  await run().expect(400);
  expect(fetcher.check).not.toHaveBeenCalled();
});
test("failed diagnostics are sanitized and do not assert that the redirect issue was resolved", async () => {
  jest
    .spyOn(fetcher, "check")
    .mockRejectedValue(new Error("SECRET_PRIVATE_TOKEN"));
  const r = await run().expect(201);
  expect(r.body.latest.state).toBe("FAILED");
  expect(r.body.latest.result).toBeNull();
  expect(JSON.stringify(r.body)).not.toContain("SECRET");
  expect(r.body.google.coverageState).toBe("Redirect error");
  await run().expect(201);
  expect(fetcher.check).toHaveBeenCalledTimes(1);
});
test("a fresh check after the cooldown retains history, and a changed public URL never reuses an older trace", async () => {
  await run();
  await db.fetchDiagnostic.updateMany({
    data: { finishedAt: new Date(Date.now() - 16 * 60000) },
  });
  await run();
  expect(fetcher.check).toHaveBeenCalledTimes(2);
  expect(await db.fetchDiagnostic.count()).toBe(2);
  await db.article.update({
    where: { id },
    data: { publishedUrl: "https://fixture.blogspot.com/changed.html" },
  });
  const r = await agent.get("/api/seo/articles/" + id + "/fetch-diagnostics");
  expect(r.body.latest).toBeNull();
});
test("the protected JSON export is an evidence snapshot and does not start a new request", async () => {
  await run();
  const exported = await agent
    .get("/api/seo/articles/" + id + "/fetch-diagnostics/export")
    .expect(200);
  expect(exported.headers["content-disposition"]).toContain(
    "article-fetch-diagnostics.json",
  );
  expect(exported.body.latest.result.scriptsExecuted).toBe(false);
  expect(fetcher.check).toHaveBeenCalledTimes(1);
});
test("the daily diagnostic budget blocks new network checks while saved evidence stays readable", async () => {
  await db.fetchDiagnostic.createMany({
    data: Array.from({ length: 20 }, () => ({
      articleId: id,
      url,
      state: "COMPLETED",
      startedAt: new Date(Date.now() - 16 * 60000),
      finishedAt: new Date(Date.now() - 16 * 60000),
    })),
  });
  await run().expect(400);
  expect(fetcher.check).not.toHaveBeenCalled();
  await agent.get("/api/seo/articles/" + id + "/fetch-diagnostics").expect(200);
});
test("an interrupted diagnostic claim is retained as failed before a fresh claim completes", async () => {
  const stale = await db.fetchDiagnostic.create({
    data: {
      articleId: id,
      url,
      state: "RUNNING",
      startedAt: new Date(Date.now() - 180000),
    },
  });
  await run().expect(201);
  expect(
    (await db.fetchDiagnostic.findUniqueOrThrow({ where: { id: stale.id } }))
      .state,
  ).toBe("FAILED");
  expect(await db.fetchDiagnostic.count()).toBe(2);
  expect(fetcher.check).toHaveBeenCalledTimes(1);
});
