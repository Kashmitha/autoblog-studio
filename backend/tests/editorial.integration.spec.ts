import "reflect-metadata";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { PrismaService } from "../src/infrastructure/prisma.service";
import { EditorialService } from "../src/application/editorial.service";
import { AiService } from "../src/application/ai.service";
import { ArticlesService } from "../src/application/articles.service";
import { MediaService } from "../src/application/media.service";
import { CloudPublishingService } from "../src/application/cloud-publishing.service";
import { hashPassword } from "../src/domain/security";
import {
  EDITORIAL_ENABLE,
  EDITORIAL_PUBLISH,
  PHOTO_CONFIRMATION,
} from "../src/domain/editorial";

let app: INestApplication,
  db: PrismaService,
  service: EditorialService,
  agent: ReturnType<typeof request.agent>,
  csrf: string;
let generated = 0,
  uncertain = false,
  cloudFails = false;
const envNames = [
  "AI_ENABLED",
  "AI_BILLING_AUTHORIZED",
  "AI_API_KEY",
  "AI_INPUT_USD_PER_MILLION",
  "AI_OUTPUT_USD_PER_MILLION",
  "AI_MONTHLY_LIMIT_USD",
  "AI_DAILY_GENERATION_LIMIT",
  "BLOGGER_MODE",
];
const previousEnv = Object.fromEntries(
  envNames.map((name) => [name, process.env[name]]),
);
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/autoblog_test")
    throw new Error("Editorial tests require an isolated database");
  app = await createApp();
  await app.init();
  db = app.get(PrismaService);
  service = app.get(EditorialService);
  await db.user.upsert({
    where: { email: "editorial@localhost" },
    create: {
      email: "editorial@localhost",
      passwordHash: hashPassword("editorial-test-password"),
    },
    update: {},
  });
  agent = request.agent(app.getHttpServer());
  const login = await agent
    .post("/api/auth/login")
    .set("Origin", "http://localhost:3100")
    .send({ email: "editorial@localhost", password: "editorial-test-password" })
    .expect(201);
  csrf = login.body.csrfToken;
});
async function cleanup() {
  await db.editorialRun.deleteMany();
  await db.editorialSettings.deleteMany();
  await db.publishJob.deleteMany();
  await db.article.deleteMany();
  await db.mediaAsset.deleteMany();
}
beforeEach(async () => {
  jest.restoreAllMocks();
  await cleanup();
  generated = 0;
  uncertain = false;
  cloudFails = false;
  Object.assign(process.env, {
    AI_ENABLED: "true",
    AI_BILLING_AUTHORIZED: "true",
    AI_API_KEY: "fixture-key-not-real",
    AI_INPUT_USD_PER_MILLION: "1",
    AI_OUTPUT_USD_PER_MILLION: "1",
    AI_MONTHLY_LIMIT_USD: "3",
    AI_DAILY_GENERATION_LIMIT: "2",
    BLOGGER_MODE: "live",
  });
  await db.automationSettings.upsert({
    where: { id: "owner" },
    create: { id: "owner", paused: false, dailyLimit: 2 },
    update: { paused: false, emergencyStop: false, dailyLimit: 2, times: [] },
  });
  await db.integration.upsert({
    where: { provider: "google" },
    create: {
      provider: "google",
      encryptedTokens: "fixture-never-decrypted",
      blogId: "123",
      blogUrl: "https://example.blogspot.com/",
      firstLiveTestAuthorizedAt: new Date(),
      liveTestSucceededAt: new Date(),
    },
    update: {
      blogId: "123",
      firstLiveTestAuthorizedAt: new Date(),
      liveTestSucceededAt: new Date(),
    },
  });
  await db.workerHeartbeat.upsert({
    where: { id: "editorial-fixture" },
    create: { id: "editorial-fixture", lastSeen: new Date() },
    update: { lastSeen: new Date() },
  });
  for (let index = 0; index < 2; index++)
    await db.article.create({
      data: {
        title: index
          ? "Track an older configuration revision"
          : "Inspect recent snapshot file changes",
        slug: "editorial-test-" + index,
        niche: "Git",
        intent: "Explain a source-backed Git inspection task",
        sources: {
          create: ["git-log", "git-show"].map((name) => ({
            url: "https://git-scm.com/docs/" + name,
            title: name,
            note: "Isolated test reference scope",
          })),
        },
      },
    });
  jest
    .spyOn(global, "fetch")
    .mockRejectedValue(
      new Error("Unexpected external request in isolated editorial test"),
    );
  jest.spyOn(app.get(MediaService), "search").mockResolvedValue([]);
  jest
    .spyOn(app.get(ArticlesService), "verifySources")
    .mockImplementation(async (id) => {
      await db.source.updateMany({
        where: { articleId: id },
        data: { checkedAt: new Date(), httpStatus: 200 },
      });
      await db.article.update({
        where: { id },
        data: { version: { increment: 1 }, status: "NEEDS_REVIEW" },
      });
      return app.get(ArticlesService).quality(id);
    });
  jest
    .spyOn(app.get(AiService), "generate")
    .mockImplementation(async (dto, expectedVersion) => {
      const article = await db.article.findUniqueOrThrow({
        where: { id: dto.articleId },
      });
      expect(article.version).toBe(expectedVersion);
      const index = generated++;
      const title = index
        ? "Read a configuration revision without replacing local files"
        : "Find the files touched by a single commit";
      const references = await db.source.findMany({
        where: { articleId: article.id },
      });
      const html = `<h2>Isolated test example</h2><p>${Array.from({ length: 500 }, (_, i) => (index ? "demo" : "unit") + i).join(" ")}</p><p>${references.map((source, index) => `<a href="${source.url}">Reference ${index}</a>`).join(" ")}</p>`;
      const data = {
        title,
        html,
        excerpt: "Source-backed isolated fixture",
        labels: ["Git"],
        uncertainties: uncertain ? ["Example needs owner verification"] : [],
        imageSearchTerms: ["laptop"],
      };
      await db.article.update({
        where: { id: article.id },
        data: {
          html,
          excerpt: data.excerpt,
          labels: data.labels,
          aiAssisted: true,
          status: "NEEDS_REVIEW",
          version: { increment: 1 },
          generation: data,
        },
      });
      return { articleId: article.id, data, costUsd: 0 };
    });
  jest
    .spyOn(app.get(CloudPublishingService), "schedule")
    .mockImplementation(async (id, at, policy) => {
      expect(policy?.expectedBlogId).toBe("123");
      expect(policy?.automatic).toBe(true);
      expect(policy?.expectedPhotoId).toBeTruthy();
      if (cloudFails) throw new Error("Simulated uncertain remote result");
      await db.article.update({
        where: { id },
        data: {
          status: "SCHEDULED",
          publishingTarget: "blogger",
          remoteStatus: "SCHEDULED",
          scheduledAt: new Date(at),
        },
      });
      return app.get(ArticlesService).get(id);
    });
});
afterAll(async () => {
  jest.restoreAllMocks();
  await cleanup();
  await db.workerHeartbeat.deleteMany({ where: { id: "editorial-fixture" } });
  await db.user.deleteMany({ where: { email: "editorial@localhost" } });
  for (const name of envNames) {
    const value = previousEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  await app.close();
});
async function pool(index = 0) {
  const photo = await db.mediaAsset.create({
    data: {
      title: "Real laptop photo " + index,
      url: `https://upload.wikimedia.org/wikipedia/commons/test/real-${index}.jpg`,
      alt: "A laptop on a wooden desk",
      creator: "Fixture photographer",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Real.jpg",
      provider: "WIKIMEDIA",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      attribution: "Fixture photographer CC BY 4.0",
      rightsConfirmed: true,
    },
  });
  await service.photo(photo.id, true, ["laptop"], PHOTO_CONFIRMATION);
  return photo;
}
async function enable(autoPublish = false) {
  await service.save({
    enabled: true,
    autoPublish,
    times: ["09:00", "17:00"],
    revision: 0,
    confirmation: autoPublish ? EDITORIAL_PUBLISH : EDITORIAL_ENABLE,
  });
}

test("settings are disabled by default, require owner/CSRF and do not reveal credentials", async () => {
  await request(app.getHttpServer()).get("/api/editorial").expect(401);
  const status = await agent.get("/api/editorial").expect(200);
  expect(status.body.settings.enabled).toBe(false);
  expect(JSON.stringify(status.body)).not.toMatch(
    /fixture-key-not-real|encryptedTokens/,
  );
  await agent
    .post("/api/editorial/queue")
    .set("Origin", "http://localhost:3100")
    .expect(403);
  await expect(service.queue()).rejects.toThrow("Enable");
  await expect(
    service.save({
      enabled: true,
      autoPublish: false,
      times: ["09:00", "17:00"],
      revision: 0,
      confirmation: "",
    }),
  ).rejects.toThrow("authorization");
  process.env.AI_BILLING_AUTHORIZED = "false";
  await expect(enable()).rejects.toThrow("billing");
  expect(generated).toBe(0);
});
test("review-only run prepares a draft and licensed image without approving or contacting Blogger", async () => {
  await pool();
  await enable();
  await service.queue();
  await service.tick();
  const run = await db.editorialRun.findFirstOrThrow({
    include: { article: true },
  });
  expect(run.state).toBe("NEEDS_REVIEW");
  expect(run.stage).toBe("READY");
  expect(run.article?.approvedAt).toBeNull();
  expect(generated).toBe(1);
  expect(
    await db.articleMedia.count({ where: { articleId: run.articleId! } }),
  ).toBe(1);
  expect(app.get(CloudPublishingService).schedule).not.toHaveBeenCalled();
});

test("optional topic refill creates a source-backed new problem without a separate model call", async () => {
  await db.article.deleteMany();
  await pool();
  await service.save({
    enabled: true,
    autoPublish: false,
    autoPlan: true,
    times: ["09:00", "17:00"],
    revision: 0,
    confirmation: EDITORIAL_ENABLE,
  });
  await service.queue();
  await service.tick();
  const run = await db.editorialRun.findFirstOrThrow({
    include: { article: { include: { sources: true } } },
  });
  expect(run.state).toBe("NEEDS_REVIEW");
  expect(run.stage).toBe("READY");
  expect(generated).toBe(1);
  expect(run.article?.title).toBe("Find the files touched by a single commit");
  expect(run.article?.sources).toHaveLength(2);
  expect(run.article?.planningNotes).toContain("Automatically planned");
});
test("missing real-photo match blocks; owner can resume the saved photo stage without regenerating", async () => {
  await enable();
  await service.queue();
  await service.tick();
  const blocked = await db.editorialRun.findFirstOrThrow();
  expect(blocked.state).toBe("BLOCKED_MEDIA");
  expect(generated).toBe(1);
  await pool();
  await service.resume(blocked.id);
  await service.tick();
  expect(
    (await db.editorialRun.findUniqueOrThrow({ where: { id: blocked.id } }))
      .stage,
  ).toBe("READY");
  expect(generated).toBe(1);
});
test("standing auto policy schedules at most two slots and records automated rather than human approval", async () => {
  await db.article.updateMany({
    data: { createdAt: new Date(Date.now() - 30 * 86400000) },
  });
  await pool(0);
  await pool(1);
  await enable(true);
  await service.queue();
  await service.tick();
  await service.queue();
  await service.tick();
  await db.article.create({
    data: {
      title: "A third source-backed fixture brief",
      slug: "third-fixture",
      niche: "Git",
      sources: {
        create: ["git-log", "git-show"].map((name) => ({
          url: "https://git-scm.com/docs/" + name,
          title: name,
          note: "Fixture scope",
        })),
      },
    },
  });
  expect((await service.queue()).queued).toBe(false);
  expect(generated).toBe(2);
  const runs = await db.editorialRun.findMany({ include: { article: true } });
  expect(runs).toHaveLength(2);
  expect(runs.every((run) => run.state === "SCHEDULED")).toBe(true);
  const attached = await db.articleMedia.findMany({
    where: { articleId: { in: runs.map((run) => run.articleId!) } },
  });
  expect(new Set(attached.map((row) => row.mediaId)).size).toBe(2);
  for (const run of runs)
    expect(run.article?.generation).toMatchObject({
      editorialApproval: {
        kind: "AUTOMATIC_POLICY",
        version: run.article?.version,
      },
    });
  expect(
    await db.auditLog.count({
      where: {
        action: "ARTICLE_AUTOMATIC_POLICY_APPROVED",
        entityId: { in: runs.map((run) => run.articleId!) },
      },
    }),
  ).toBe(2);
});
test("uncertainty and uncertain Blogger results never auto-regenerate or replay", async () => {
  await pool();
  await enable(true);
  uncertain = true;
  await service.queue();
  await service.tick();
  expect((await db.editorialRun.findFirstOrThrow()).state).toBe("NEEDS_REVIEW");
  expect(app.get(CloudPublishingService).schedule).not.toHaveBeenCalled();
  uncertain = false;
  cloudFails = true;
  await service.queue();
  await service.tick();
  const remote = await db.editorialRun.findFirstOrThrow({
    where: { state: "REMOTE_ATTENTION" },
  });
  await service.tick();
  expect(generated).toBe(2);
  expect(app.get(CloudPublishingService).schedule).toHaveBeenCalledTimes(1);
  await expect(service.resume(remote.id)).rejects.toThrow(
    "Only a photo-blocked",
  );
});
test("pause, changed destination and expired policy prevent generation; starter briefs deduplicate", async () => {
  await enable();
  await service.queue();
  await db.automationSettings.update({
    where: { id: "owner" },
    data: { paused: true },
  });
  await service.tick();
  expect(generated).toBe(0);
  await db.automationSettings.update({
    where: { id: "owner" },
    data: { paused: false },
  });
  await db.integration.update({
    where: { provider: "google" },
    data: { blogId: "other" },
  });
  await service.tick();
  expect(generated).toBe(0);
  expect((await service.starters()).created).toBe(8);
  expect((await service.starters()).created).toBe(0);
});
