import "reflect-metadata";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { Worker } from "bullmq";
import { createApp } from "../src/bootstrap";
import { PrismaService } from "../src/infrastructure/prisma.service";
import { hashPassword } from "../src/domain/security";
import {
  PublishingService,
  redisConnection,
  DeferredPublication,
} from "../src/application/publishing.service";
import { LiveBloggerAdapter } from "../src/infrastructure/blogger.service";
import { env } from "../src/config";
import { AiService } from "../src/application/ai.service";
import { ArticlesService } from "../src/application/articles.service";
import { AiProvider } from "../src/infrastructure/ai.provider";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
let app: INestApplication,
  db: PrismaService,
  publisher: PublishingService,
  agent: ReturnType<typeof request.agent>,
  csrf = "",
  articleId = "";
const origin = "http://localhost:3100";
const source = "https://docs.docker.com/build/cache/";
const html =
  "<h2>Explain the observed behavior</h2><p>" +
  Array.from({ length: 240 }, (_, i) => `verification${i}`).join(" ") +
  ` <a href="${source}">Docker cache documentation</a></p>`;
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes("/autoblog_test"))
    throw new Error("Tests require isolated autoblog_test database.");
  app = await createApp();
  await app.init();
  db = app.get(PrismaService);
  publisher = app.get(PublishingService);
  await publisher.queue.obliterate({ force: true });
  await db.$executeRawUnsafe(
    'TRUNCATE "User", "Article", "MediaAsset", "Integration", "AutomationSettings", "FinanceEntry", "TrafficMetric", "AiUsage", "AuditLog", "WorkerHeartbeat" CASCADE',
  );
  await db.user.create({
    data: {
      email: "test@example.com",
      passwordHash: hashPassword("integration-test-password-123"),
    },
  });
  await db.automationSettings.create({ data: { id: "owner", paused: true } });
  agent = request.agent(app.getHttpServer());
});
afterAll(async () => {
  await publisher?.queue.obliterate({ force: true });
  await app?.close();
});
const mutate = (method: "post" | "patch", path: string, body: object) =>
  agent[method]("/api" + path)
    .set("Origin", origin)
    .set("X-CSRF-Token", csrf)
    .send(body);
test("unauthenticated article API is protected", async () => {
  await request(app.getHttpServer()).get("/api/articles").expect(401);
});
test("owner login creates HTTP-only session and CSRF token", async () => {
  const r = await agent
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({
      email: "test@example.com",
      password: "integration-test-password-123",
    })
    .expect(201);
  csrf = r.body.csrfToken;
  expect(r.headers["set-cookie"][0]).toContain("HttpOnly");
  expect(csrf.length).toBe(64);
});
test("rejects cross-origin and missing-CSRF mutations", async () => {
  await agent
    .post("/api/articles")
    .set("Origin", "https://evil.example")
    .send({ title: "Rejected test", niche: "Docker" })
    .expect(403);
  await agent
    .post("/api/articles")
    .set("Origin", origin)
    .send({ title: "Rejected test", niche: "Docker" })
    .expect(403);
});
test("rejects invalid DTOs and unknown fields", async () => {
  await mutate("post", "/articles", {
    title: "x",
    niche: "Docker",
    status: "APPROVED",
  }).expect(400);
});
test("creates a persistent draft and blocks premature approval", async () => {
  const r = await mutate("post", "/articles", {
    title: "Docker cache integration tutorial",
    niche: "Docker",
    html: "<p>Incomplete</p>",
  }).expect(201);
  articleId = r.body.id;
  await mutate("post", `/articles/${articleId}/transition`, {
    status: "APPROVED",
    reason: "I tried to skip review.",
  }).expect(400);
  expect(
    (await db.article.findUniqueOrThrow({ where: { id: articleId } })).status,
  ).toBe("NEEDS_REVIEW");
});
test("editor saves with version checking and sanitizes HTML", async () => {
  await mutate("patch", `/articles/${articleId}`, {
    title: "Docker cache integration tutorial",
    niche: "Docker",
    html: html + "<script>malicious()</script>",
    excerpt: "Sourced local integration test fixture; never live content.",
    version: 1,
  }).expect(200);
  const a = await db.article.findUniqueOrThrow({ where: { id: articleId } });
  expect(a.html).not.toContain("script");
  await mutate("patch", `/articles/${articleId}`, {
    title: a.title,
    niche: "Docker",
    version: 1,
  }).expect(409);
});
test("stores source evidence and requires successful link verification", async () => {
  await mutate("post", `/articles/${articleId}/sources`, {
    title: "Docker cache",
    url: source,
    note: "Reviewed cache invalidation rules against current primary documentation.",
  }).expect(201);
  const report = await mutate(
    "post",
    `/articles/${articleId}/quality`,
    {},
  ).expect(201);
  expect(report.body.passed).toBe(false);
  await db.source.updateMany({
    where: { articleId },
    data: { checkedAt: new Date(), httpStatus: 200 },
  });
});
test("approves only a valid version and schedules durably", async () => {
  await mutate("post", `/articles/${articleId}/transition`, {
    status: "APPROVED",
    reason:
      "Fixture editorial review confirms primary citations and structure.",
  }).expect(201);
  const result = await mutate("post", `/articles/${articleId}/schedule`, {
    at: new Date(Date.now() + 2000).toISOString(),
  }).expect(201);
  expect(result.body.state).toBe("PENDING");
  expect(await publisher.queue.getJob(result.body.id)).toBeTruthy();
  await mutate("patch", `/articles/${articleId}`, {
    title: "Trying to edit scheduled content",
    niche: "Docker",
    version: 3,
  }).expect(409);
});
test("pause defers rather than consumes permanent retry budget", async () => {
  const job = await db.publishJob.findFirstOrThrow({ where: { articleId } });
  await expect(publisher.process(job.id)).rejects.toBeInstanceOf(
    DeferredPublication,
  );
  expect(
    (await db.publishJob.findUniqueOrThrow({ where: { id: job.id } })).state,
  ).toBe("PENDING");
});
test("real Redis worker executes mock job and duplicate retries do nothing", async () => {
  await db.automationSettings.update({
    where: { id: "owner" },
    data: { paused: false, times: [] },
  });
  const job = await db.publishJob.findFirstOrThrow({ where: { articleId } });
  await db.publishJob.update({
    where: { id: job.id },
    data: { scheduledAt: new Date(Date.now() - 1000) },
  });
  const worker = new Worker(
    "autoblog-publish-test",
    (j) => publisher.process(j.data.id),
    { connection: redisConnection() },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Worker timed out")), 15000);
      worker.on("completed", () => {
        clearTimeout(t);
        resolve();
      });
      worker.on("failed", (_j, e) => {
        clearTimeout(t);
        reject(e);
      });
    });
    expect(
      (await db.publishJob.findUniqueOrThrow({ where: { id: job.id } })).state,
    ).toBe("MOCK_SUCCEEDED");
    expect(
      (await db.article.findUniqueOrThrow({ where: { id: articleId } })).status,
    ).toBe("APPROVED");
    await publisher.process(job.id);
    expect(
      (await db.publishJob.findUniqueOrThrow({ where: { id: job.id } }))
        .attempts,
    ).toBe(1);
    expect(await db.article.count({ where: { status: "PUBLISHED" } })).toBe(0);
  } finally {
    await worker.close();
  }
});
test("reconciles missing Redis jobs from PostgreSQL", async () => {
  const at = new Date(Date.now() + 86400000);
  const scheduled = await publisher.schedule(articleId, at.toISOString());
  await (await publisher.queue.getJob(scheduled.id))!.remove();
  await publisher.reconcile();
  expect(await publisher.queue.getJob(scheduled.id)).toBeTruthy();
  await publisher.cancel(articleId);
});
test("edits invalidate approval", async () => {
  const current = await db.article.findUniqueOrThrow({
    where: { id: articleId },
  });
  await mutate("patch", `/articles/${articleId}`, {
    title: current.title,
    niche: "Docker",
    html: current.html,
    excerpt: current.excerpt,
    version: current.version,
  }).expect(200);
  const saved = await db.article.findUniqueOrThrow({
    where: { id: articleId },
  });
  expect(saved.status).toBe("NEEDS_REVIEW");
  expect(saved.approvedAt).toBeNull();
});
test("CSV finance imports are idempotent and estimates excluded from profit", async () => {
  const month = new Date().toISOString().slice(0, 7),
    date = month + "-01";
  const csv = `date,kind,category,amount,reference,source,note\n${date},ACTUAL_REVENUE,Adsterra,12,test-revenue,Fixture verified,isolated test\n${date},ESTIMATED_REVENUE,Adsterra,100,test-estimate,Fixture estimate,isolated test\n${date},EXPENSE,Hosting,2,test-expense,Fixture invoice,isolated test`;
  await mutate("post", "/finance/import", { csv }).expect(201);
  const repeat = await mutate("post", "/finance/import", { csv }).expect(201);
  expect(repeat.body.skipped).toBe(3);
  const d = await agent.get("/api/dashboard?month=" + month).expect(200);
  expect(d.body.finance.netProfit).toBe(10);
  expect(d.body.finance.estimatedRevenue).toBe(100);
});
test("traffic upserts without duplication and absent values remain unavailable", async () => {
  const date = new Date().toISOString().slice(0, 10);
  const data = {
    date,
    url: "https://example.com/tutorial",
    pageviews: 100,
    source: "Fixture CSV",
  };
  await mutate("post", "/traffic", data).expect(201);
  await mutate("post", "/traffic", { ...data, pageviews: 120 }).expect(201);
  expect(await db.trafficMetric.count()).toBe(1);
  expect((await db.trafficMetric.findFirstOrThrow()).impressions).toBeNull();
});
test("API never returns credentials and AI stays disabled", async () => {
  const i = await agent.get("/api/integrations").expect(200);
  expect(i.body.aiEnabled).toBe(false);
  expect(JSON.stringify(i.body)).not.toContain("encryptedTokens");
  await mutate("post", "/ai/generate", {
    task: "topics",
    niche: "Docker",
  }).expect(400);
});
test("live publish retry reuses stored remote ID and confirms LIVE without another insert", async () => {
  const copy = await db.article.findUniqueOrThrow({ where: { id: articleId } });
  const live = await db.article.create({
    data: {
      title: "PostgreSQL publication recovery fixture",
      slug: "recovery-fixture",
      niche: "PostgreSQL",
      html: html.replaceAll("verification", "recovery"),
      excerpt: "Recovery test",
      status: "SCHEDULED",
      approvedAt: new Date(),
      remotePostId: "known-remote-post",
      draftAttemptedAt: new Date(),
    },
  });
  await db.source.create({
    data: {
      articleId: live.id,
      url: source,
      title: "Source",
      note: "Fixture primary source reviewed.",
      checkedAt: new Date(),
      httpStatus: 200,
    },
  });
  const j = await db.publishJob.create({
    data: {
      articleId: live.id,
      key: "recovery-test",
      blogId: "123",
      mode: "live",
      liveTest: true,
      scheduledAt: new Date(Date.now() - 1000),
    },
  });
  await db.integration.create({
    data: {
      provider: "google",
      encryptedTokens: "unused fixture token",
      blogId: "123",
      firstLiveTestAuthorizedAt: new Date(),
    },
  });
  const adapter = app.get(LiveBloggerAdapter);
  const get = jest.spyOn(adapter, "getPost").mockResolvedValue({
      id: "known-remote-post",
      url: "https://example.com/recovered",
      status: "LIVE",
    }),
    insert = jest.spyOn(adapter, "createDraft"),
    publish = jest.spyOn(adapter, "publish");
  const original = env.bloggerMode;
  env.bloggerMode = "live";
  try {
    await publisher.process(j.id);
    await publisher.process(j.id);
    expect(insert).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledTimes(1);
    expect(
      (await db.article.findUniqueOrThrow({ where: { id: live.id } })).status,
    ).toBe("PUBLISHED");
  } finally {
    env.bloggerMode = original;
    jest.restoreAllMocks();
  }
});

test("original PNG upload is private, tracked and blocked from public approval until hosted", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=",
    "base64",
  );
  const upload = await agent
    .post("/api/media/upload")
    .set("Origin", origin)
    .set("X-CSRF-Token", csrf)
    .field("title", "Isolated test screenshot")
    .field("alt", "A one pixel fixture for upload verification")
    .field("creator", "Isolated Test Fixture")
    .field("attribution", "Isolated test fixture; not for real publication")
    .field("rightsConfirmed", "true")
    .attach("file", png, "fixture.png")
    .expect(201);
  const asset = upload.body;
  try {
    expect(asset.provider).toBe("ORIGINAL");
    expect(asset.url).toMatch(/^\/api\/media\/files\//);
    await agent
      .get(asset.url)
      .expect("Content-Type", /image\/png/)
      .expect(200);
    await mutate("post", `/articles/${articleId}/media`, {
      mediaId: asset.id,
    }).expect(201);
    const report = await mutate(
      "post",
      `/articles/${articleId}/quality`,
      {},
    ).expect(201);
    expect(
      report.body.issues.some(
        (i: { code: string }) => i.code === "IMAGE_DELIVERY",
      ),
    ).toBe(true);
    await mutate("patch", `/media/${asset.id}/public-url`, {
      url: "https://example.com/original.png",
    }).expect(200);
    await agent
      .delete(`/api/articles/${articleId}/media/${asset.id}`)
      .set("Origin", origin)
      .set("X-CSRF-Token", csrf)
      .expect(200);
  } finally {
    await db.mediaAsset.delete({ where: { id: asset.id } });
    await unlink(
      resolve(__dirname, "../../uploads", asset.metadata.storageKey),
    ).catch(() => {});
  }
});
test("rejects SVG masquerading as an uploaded photo", async () => {
  await agent
    .post("/api/media/upload")
    .set("Origin", origin)
    .set("X-CSRF-Token", csrf)
    .field("title", "Unsafe fixture")
    .field("alt", "Invalid image upload fixture")
    .field("creator", "Test Fixture")
    .field("attribution", "Isolated test")
    .field("rightsConfirmed", "true")
    .attach("file", Buffer.from('<svg onload="alert(1)"></svg>'), "fake.png")
    .expect(400);
});
test("failure records retain reasons and can be retried only through fresh approval", async () => {
  await mutate("post", `/articles/${articleId}/transition`, {
    status: "APPROVED",
    reason: "Review after isolated upload test.",
  }).expect(201);
  const job = await publisher.schedule(articleId, new Date().toISOString());
  await publisher.recordFailure(
    job.id,
    new Error("Isolated transient failure"),
    false,
  );
  expect(
    (await db.publishJob.findUniqueOrThrow({ where: { id: job.id } })).error,
  ).toContain("transient");
  await publisher.recordFailure(
    job.id,
    new Error("Isolated permanent failure"),
    true,
  );
  expect(
    (await db.article.findUniqueOrThrow({ where: { id: articleId } })).status,
  ).toBe("FAILED");
  const retry = await publisher.retry(job.id);
  expect(retry.id).not.toBe(job.id);
  expect(retry.state).toBe("PENDING");
  await publisher.cancel(articleId);
});
async function withFakeAi(
  run: (service: AiService, generate: jest.Mock) => Promise<void>,
) {
  const keys = [
    "AI_ENABLED",
    "AI_BILLING_AUTHORIZED",
    "AI_API_KEY",
    "AI_INPUT_USD_PER_MILLION",
    "AI_OUTPUT_USD_PER_MILLION",
    "AI_MONTHLY_LIMIT_USD",
    "AI_DAILY_GENERATION_LIMIT",
    "AI_MAX_OUTPUT_TOKENS",
  ] as const;
  const old = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    AI_ENABLED: "true",
    AI_BILLING_AUTHORIZED: "true",
    AI_API_KEY: "isolated-test-never-sent",
    AI_INPUT_USD_PER_MILLION: "1",
    AI_OUTPUT_USD_PER_MILLION: "2",
    AI_MONTHLY_LIMIT_USD: "1",
    AI_DAILY_GENERATION_LIMIT: "10",
    AI_MAX_OUTPUT_TOKENS: "1000",
  });
  await db.aiUsage.deleteMany();
  const generate = jest
    .fn()
    .mockResolvedValue({
      data: {
        topics: [
          {
            title: "A specific isolated topic proposal",
            intent: "Test a budget reservation",
          },
        ],
      },
      inputTokens: 100,
      outputTokens: 10,
    });
  const service = new AiService(db, app.get(ArticlesService), {
    generate,
  } as AiProvider);
  try {
    await run(service, generate);
  } finally {
    for (const key of keys) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
    await db.aiUsage.deleteMany();
  }
}
test("AI cost reservations record real provider usage from a fake adapter without a paid call", async () => {
  await withFakeAi(async (service, generate) => {
    const result = await service.generate({ task: "topics", niche: "Docker" });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.costUsd).toBeCloseTo(0.00012);
    expect((await db.aiUsage.findFirstOrThrow()).state).toBe("COMPLETED");
  });
});
test("AI spending ceiling rejects before making a provider request", async () => {
  await withFakeAi(async (service, generate) => {
    process.env.AI_MONTHLY_LIMIT_USD = ".000001";
    await expect(
      service.generate({ task: "topics", niche: "Docker" }),
    ).rejects.toThrow("spending limit");
    expect(generate).not.toHaveBeenCalled();
  });
});
test("concurrent generations respect the database-serialized daily limit", async () => {
  await withFakeAi(async (service, generate) => {
    process.env.AI_DAILY_GENERATION_LIMIT = "1";
    const result = await Promise.allSettled([
      service.generate({ task: "topics", niche: "Docker" }),
      service.generate({ task: "topics", niche: "Docker" }),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
test("uncertain AI outcomes retain the conservative reservation", async () => {
  await withFakeAi(async (service, generate) => {
    generate.mockRejectedValue(new Error("Isolated network timeout"));
    await expect(
      service.generate({ task: "topics", niche: "Docker" }),
    ).rejects.toThrow("timeout");
    const usage = await db.aiUsage.findFirstOrThrow();
    expect(usage.state).toBe("UNKNOWN");
    expect(Number(usage.costUsd)).toBeCloseTo(Number(usage.reservedUsd), 6);
  });
});
