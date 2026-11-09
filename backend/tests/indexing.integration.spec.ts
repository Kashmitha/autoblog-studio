import "reflect-metadata";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { PrismaService } from "../src/infrastructure/prisma.service";
import { GoogleService } from "../src/infrastructure/blogger.service";
import { SearchConsoleAdapter } from "../src/infrastructure/search-console.adapter";
import { hashPassword } from "../src/domain/security";
let app: INestApplication,
  db: PrismaService,
  agent: ReturnType<typeof request.agent>,
  csrf: string,
  id: string,
  adapter: SearchConsoleAdapter;
const origin = "http://localhost:3100",
  site = "https://fixture.example/",
  url = site + "published-post";
const previousProperty = process.env.SEARCH_CONSOLE_SITE_URL;
const redirect = () => ({
  inspectionResultLink:
    "https://search.google.com/search-console/inspect?fixture=true",
  indexStatusResult: {
    verdict: "FAIL",
    coverageState: "Redirect error",
    pageFetchState: "REDIRECT_ERROR",
    robotsTxtState: "ALLOWED",
    lastCrawlTime: "2026-11-04T15:49:13Z",
    crawledAs: "MOBILE",
  },
});
const indexed = () => ({
  indexStatusResult: {
    verdict: "PASS",
    coverageState: "Submitted and indexed",
    pageFetchState: "SUCCESSFUL",
    indexingState: "INDEXING_ALLOWED",
    lastCrawlTime: "2026-11-05T10:00:00Z",
    googleCanonical: url,
    userCanonical: url,
  },
});
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/autoblog_test")
    throw new Error(
      "Indexing tests require the isolated autoblog_test database.",
    );
  delete process.env.SEARCH_CONSOLE_SITE_URL;
  app = await createApp();
  await app.init();
  db = app.get(PrismaService);
  adapter = app.get(SearchConsoleAdapter);
  const email = "indexing-fixture@localhost";
  await db.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: hashPassword("isolated-indexing-password-123"),
    },
    update: { passwordHash: hashPassword("isolated-indexing-password-123") },
  });
  agent = request.agent(app.getHttpServer());
  const login = await agent
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email, password: "isolated-indexing-password-123" })
    .expect(201);
  csrf = login.body.csrfToken;
});
beforeEach(async () => {
  jest.restoreAllMocks();
  await db.publishJob.deleteMany();
  await db.article.deleteMany();
  await db.reportingSettings.deleteMany();
  await db.reportingSettings.create({
    data: {
      id: "owner",
      searchConsoleSiteUrl: site,
      propertyVerifiedAt: new Date(),
    },
  });
  await db.integration.upsert({
    where: { provider: "google" },
    create: {
      provider: "google",
      encryptedTokens: "not used by fake adapters",
      blogId: "fixture-blog",
    },
    update: { blogId: "fixture-blog" },
  });
  await db.automationSettings.upsert({
    where: { id: "owner" },
    create: { id: "owner", paused: true },
    update: { paused: true },
  });
  const article = await db.article.create({
    data: {
      title: "Published URL inspection integration fixture",
      slug: "indexing-fixture",
      html: "<p>Unchanged approved content</p>",
      status: "PUBLISHED",
      publishedUrl: url,
      publishedAt: new Date(),
      approvedAt: new Date(),
    },
  });
  id = article.id;
  jest
    .spyOn(app.get(GoogleService), "reportingPermissions")
    .mockResolvedValue({ searchConsole: true, analytics: false });
  jest
    .spyOn(adapter, "properties")
    .mockResolvedValue([{ siteUrl: site, permissionLevel: "siteOwner" }]);
  jest.spyOn(adapter, "inspect").mockResolvedValue(redirect());
});
afterAll(async () => {
  jest.restoreAllMocks();
  if (previousProperty === undefined)
    delete process.env.SEARCH_CONSOLE_SITE_URL;
  else process.env.SEARCH_CONSOLE_SITE_URL = previousProperty;
  await app?.close();
});
const post = (path: string, body: object = {}) =>
  agent
    .post("/api" + path)
    .set("Origin", origin)
    .set("X-CSRF-Token", csrf)
    .send(body);
const inspect = () => post("/seo/articles/" + id + "/inspect");
const age = () =>
  db.indexInspection.updateMany({
    where: { articleId: id },
    data: { checkedAt: new Date(Date.now() - 6 * 60000) },
  });

test("inspection history and refresh endpoints require the owner session and CSRF", async () => {
  await request(app.getHttpServer()).get("/api/seo/indexing").expect(401);
  await agent
    .post("/api/seo/articles/" + id + "/inspect")
    .set("Origin", origin)
    .send({})
    .expect(403);
  expect(adapter.inspect).not.toHaveBeenCalled();
});
test("scheduled posts with a future public URL are not inspected or classified as indexed", async () => {
  await db.article.update({
    where: { id },
    data: { status: "SCHEDULED", scheduledAt: new Date(Date.now() + 86400000) },
  });
  const report = await agent
    .get("/api/seo/articles/" + id + "/indexing")
    .expect(200);
  expect(report.body).toMatchObject({
    publishingStatus: "SCHEDULED",
    eligible: false,
    canInspect: false,
    latest: null,
  });
  await inspect().expect(400);
  expect(adapter.inspect).not.toHaveBeenCalled();
  expect((await db.article.findUniqueOrThrow({ where: { id } })).status).toBe(
    "SCHEDULED",
  );
});
test("missing property, missing read access and URLs outside the property fail before a Google call", async () => {
  await db.reportingSettings.deleteMany();
  await inspect().expect(400);
  await db.reportingSettings.create({
    data: { id: "owner", searchConsoleSiteUrl: site },
  });
  jest
    .spyOn(app.get(GoogleService), "reportingPermissions")
    .mockResolvedValue({ searchConsole: false, analytics: false });
  await inspect().expect(400);
  await agent.get("/api/seo/search-console/properties").expect(400);
  jest
    .spyOn(app.get(GoogleService), "reportingPermissions")
    .mockResolvedValue({ searchConsole: true, analytics: false });
  await db.article.update({
    where: { id },
    data: { publishedUrl: "https://fixture.example.evil.test/post" },
  });
  await inspect().expect(400);
  expect(adapter.inspect).not.toHaveBeenCalled();
  expect(await db.indexInspection.count()).toBe(0);
});
test("property selection only accepts verified accessible properties and does not reset Blogger or automation", async () => {
  jest.spyOn(adapter, "properties").mockResolvedValue([
    { siteUrl: site, permissionLevel: "siteOwner" },
    {
      siteUrl: "https://unverified.example/",
      permissionLevel: "siteUnverifiedUser",
    },
    { siteUrl: "javascript:alert(1)", permissionLevel: "siteOwner" },
  ]);
  expect(
    (await agent.get("/api/seo/search-console/properties").expect(200)).body,
  ).toEqual([{ siteUrl: site, permissionLevel: "siteOwner" }]);
  await post("/seo/search-console/property", {
    siteUrl: "https://unverified.example/",
  }).expect(400);
  const before = await db.integration.findUnique({
    where: { provider: "google" },
  });
  await post("/seo/search-console/property", { siteUrl: site }).expect(201);
  expect(
    await db.integration.findUnique({ where: { provider: "google" } }),
  ).toEqual(before);
  expect(
    (await db.automationSettings.findUniqueOrThrow({ where: { id: "owner" } }))
      .paused,
  ).toBe(true);
});
test("stores Google's redirect reason and crawl time separately from the check time without changing the article", async () => {
  const before = await db.article.findUniqueOrThrow({ where: { id } });
  const r = await inspect().expect(201);
  expect(r.body.latest).toMatchObject({
    state: "NOT_INDEXED",
    verdict: "FAIL",
    coverageState: "Redirect error",
    pageFetchState: "REDIRECT_ERROR",
    lastCrawlTime: "2026-11-04T15:49:13.000Z",
  });
  expect(r.body.latest.checkedAt).not.toBe(r.body.latest.lastCrawlTime);
  expect(adapter.inspect).toHaveBeenCalledWith(url, site);
  expect(await db.article.findUniqueOrThrow({ where: { id } })).toEqual(before);
  expect(await db.publishJob.count()).toBe(0);
});
test("concurrent and repeated refreshes reuse one recent result instead of consuming extra Google checks", async () => {
  const replies = await Promise.all([
    inspect().expect(201),
    inspect().expect(201),
    inspect().expect(201),
  ]);
  expect(adapter.inspect).toHaveBeenCalledTimes(1);
  expect(await db.indexInspection.count()).toBe(1);
  expect(replies.filter((r) => r.body.cached === true)).toHaveLength(2);
});
test("a later indexed result retains the earlier redirect failure in history", async () => {
  await inspect().expect(201);
  await age();
  jest.spyOn(adapter, "inspect").mockResolvedValue(indexed());
  const r = await inspect().expect(201);
  expect(r.body.latest.state).toBe("INDEXED");
  expect(r.body.history).toHaveLength(2);
  expect(r.body.history[1].coverageState).toBe("Redirect error");
  expect(r.body.latest.googleCanonical).toBe(url);
});
test("successful fetch and indexing permission alone do not assert indexing", async () => {
  jest.spyOn(adapter, "inspect").mockResolvedValue({
    indexStatusResult: {
      pageFetchState: "SUCCESSFUL",
      indexingState: "INDEXING_ALLOWED",
    },
  });
  const r = await inspect().expect(201);
  expect(r.body.latest.state).toBe("UNKNOWN");
  expect(r.body.latest.lastCrawlTime).toBeNull();
});
test("quota failures preserve the prior result, record a separate failed check and hide provider secrets", async () => {
  jest.spyOn(adapter, "inspect").mockResolvedValue(indexed());
  await inspect().expect(201);
  await age();
  jest.spyOn(adapter, "inspect").mockRejectedValue({
    response: { status: 429 },
    message: "SECRET_PROVIDER_PAYLOAD",
  });
  const r = await inspect().expect(201);
  expect(r.body.latest.state).toBe("INDEXED");
  expect(r.body.lastAttempt).toMatchObject({
    state: "ERROR",
    errorCode: "QUOTA",
  });
  expect(JSON.stringify(r.body)).not.toContain("SECRET_PROVIDER_PAYLOAD");
  await inspect().expect(201);
  expect(adapter.inspect).toHaveBeenCalledTimes(2);
});
test("the last successful result remains available after more errors than the displayed history limit", async () => {
  jest.spyOn(adapter, "inspect").mockResolvedValue(indexed());
  await inspect().expect(201);
  await age();
  await db.indexInspection.createMany({
    data: Array.from({ length: 31 }, (_, n) => ({
      articleId: id,
      siteUrl: site,
      inspectionUrl: url,
      state: "ERROR",
      errorCode: "GOOGLE_UNAVAILABLE",
      checkedAt: new Date(Date.now() - 31000 + n * 1000),
    })),
  });
  const r = await agent
    .get("/api/seo/articles/" + id + "/indexing")
    .expect(200);
  expect(r.body.history).toHaveLength(30);
  expect(r.body.latest.state).toBe("INDEXED");
  expect(r.body.lastAttempt.state).toBe("ERROR");
  const overview = await agent.get("/api/seo/indexing").expect(200);
  expect(overview.body.articles[0].latest.state).toBe("INDEXED");
});
test("a different property or published URL never inherits an older indexing verdict", async () => {
  await inspect().expect(201);
  await db.article.update({
    where: { id },
    data: { publishedUrl: site + "different-post" },
  });
  expect(
    (await agent.get("/api/seo/articles/" + id + "/indexing")).body.latest,
  ).toBeNull();
  await db.article.update({ where: { id }, data: { publishedUrl: url } });
  await db.reportingSettings.update({
    where: { id: "owner" },
    data: { searchConsoleSiteUrl: "sc-domain:fixture.example" },
  });
  expect(
    (await agent.get("/api/seo/articles/" + id + "/indexing")).body.latest,
  ).toBeNull();
});
test("a provider failure with no prior result remains unavailable rather than not indexed", async () => {
  jest
    .spyOn(adapter, "inspect")
    .mockRejectedValue({ response: { status: 503 } });
  const r = await inspect().expect(201);
  expect(r.body.latest).toBeNull();
  expect(r.body.lastAttempt.state).toBe("ERROR");
  expect(r.body.lastAttempt.errorCode).toBe("GOOGLE_UNAVAILABLE");
});
test("the local daily check cap prevents further network calls", async () => {
  await db.indexInspection.createMany({
    data: Array.from({ length: 100 }, (_, n) => ({
      articleId: id,
      siteUrl: site,
      inspectionUrl: site + "quota-fixture-" + n,
      state: "ERROR",
    })),
  });
  await inspect().expect(400);
  expect(adapter.inspect).not.toHaveBeenCalled();
});
test("missing inspection payloads do not replace a prior known result", async () => {
  jest.spyOn(adapter, "inspect").mockResolvedValue(indexed());
  await inspect().expect(201);
  await age();
  jest.spyOn(adapter, "inspect").mockResolvedValue({});
  const r = await inspect().expect(201);
  expect(r.body.latest.state).toBe("INDEXED");
  expect(r.body.lastAttempt.state).toBe("ERROR");
});

const refreshDue = () => post("/seo/indexing/refresh-due");
test("daily refresh requires session, origin and CSRF", async () => {
  await request(app.getHttpServer())
    .post("/api/seo/indexing/refresh-due")
    .set("Origin", origin)
    .send({})
    .expect(401);
  await agent
    .post("/api/seo/indexing/refresh-due")
    .set("Origin", origin)
    .send({})
    .expect(403);
  await agent
    .post("/api/seo/indexing/refresh-due")
    .set("Origin", "https://untrusted.example")
    .set("X-CSRF-Token", csrf)
    .send({})
    .expect(403);
  expect(adapter.inspect).not.toHaveBeenCalled();
});
test("daily checks coalesce across concurrent tabs, reuse recent manual results and preserve publication data", async () => {
  const before = await db.article.findUniqueOrThrow({ where: { id } });
  const replies = await Promise.all([
    refreshDue().expect(201),
    refreshDue().expect(201),
  ]);
  expect(adapter.inspect).toHaveBeenCalledTimes(1);
  expect(
    replies.flatMap((r) => r.body.results).filter((r) => r.checked),
  ).toHaveLength(1);
  await age();
  await refreshDue().expect(201);
  expect(adapter.inspect).toHaveBeenCalledTimes(1);
  await db.indexInspection.updateMany({
    data: { checkedAt: new Date(Date.now() - 86400001) },
  });
  const refreshed = await refreshDue().expect(201);
  expect(refreshed.body.results[0].checked).toBe(true);
  expect(adapter.inspect).toHaveBeenCalledTimes(2);
  const report = await agent.get("/api/seo/articles/" + id + "/indexing");
  expect(report.body.followUp.sameCrawl).toBe(true);
  expect(new Date(report.body.nextAutomaticCheckAt).getTime()).toBe(
    new Date(report.body.lastAttempt.checkedAt).getTime() + 86400000,
  );
  expect(await db.article.findUniqueOrThrow({ where: { id } })).toEqual(before);
  expect(await db.publishJob.count()).toBe(0);
  expect(
    (await db.automationSettings.findUniqueOrThrow({ where: { id: "owner" } }))
      .paused,
  ).toBe(true);
});
test("daily checks skip scheduled, outside-property and unconfigured posts", async () => {
  await db.article.update({ where: { id }, data: { status: "SCHEDULED" } });
  expect((await refreshDue()).body.results).toHaveLength(0);
  await db.article.update({
    where: { id },
    data: { status: "PUBLISHED", publishedUrl: "https://other.example/post" },
  });
  expect((await refreshDue()).body.results).toHaveLength(0);
  await db.article.update({ where: { id }, data: { publishedUrl: url } });
  await db.reportingSettings.deleteMany();
  expect((await refreshDue()).body.results).toHaveLength(0);
  expect(adapter.inspect).not.toHaveBeenCalled();
});
test("daily checks bound each batch and process older due reports before newer ones", async () => {
  const extra = await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      db.article.create({
        data: {
          title: "Due fixture " + i,
          slug: "due-fixture-" + i,
          status: "PUBLISHED",
          publishedUrl: site + "due-" + i,
        },
      }),
    ),
  );
  await db.indexInspection.create({
    data: {
      articleId: id,
      siteUrl: site,
      inspectionUrl: url,
      state: "NOT_INDEXED",
      checkedAt: new Date(Date.now() - 2 * 86400000),
    },
  });
  const first = await refreshDue().expect(201);
  expect(first.body.results).toHaveLength(3);
  expect(first.body.remaining).toBe(2);
  expect(adapter.inspect).toHaveBeenCalledTimes(3);
  expect(adapter.inspect).not.toHaveBeenCalledWith(url, site);
  await refreshDue().expect(201);
  expect(adapter.inspect).toHaveBeenCalledTimes(5);
  expect(
    await db.indexInspection.count({
      where: { articleId: { in: extra.map((a) => a.id) } },
    }),
  ).toBe(4);
});
test("daily failures retain the confirmed verdict, stop the batch and back off for an hour", async () => {
  jest.spyOn(adapter, "inspect").mockResolvedValue(indexed());
  await inspect().expect(201);
  await db.indexInspection.updateMany({
    data: { checkedAt: new Date(Date.now() - 2 * 86400000) },
  });
  jest
    .spyOn(adapter, "inspect")
    .mockRejectedValue({ response: { status: 429 }, message: "SECRET" });
  const failed = await refreshDue().expect(201);
  expect(failed.body.results[0].error).toContain("quota");
  expect(JSON.stringify(failed.body)).not.toContain("SECRET");
  await age();
  await refreshDue().expect(201);
  expect(adapter.inspect).toHaveBeenCalledTimes(2);
  const report = await agent.get("/api/seo/articles/" + id + "/indexing");
  expect(report.body.latest.state).toBe("INDEXED");
  expect(report.body.lastAttempt.state).toBe("ERROR");
});
