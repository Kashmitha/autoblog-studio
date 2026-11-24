import "reflect-metadata";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { PrismaService } from "../src/infrastructure/prisma.service";
import { EditorialService } from "../src/application/editorial.service";
import { AiService } from "../src/application/ai.service";
import { ArticlesService } from "../src/application/articles.service";
import { MediaService } from "../src/application/media.service";
import { CommonsPhotoService } from "../src/application/commons-photo.service";
import { CloudPublishingService } from "../src/application/cloud-publishing.service";
import { hashPassword } from "../src/domain/security";
import {
  EDITORIAL_ENABLE,
  EDITORIAL_PUBLISH,
  PHOTO_CONFIRMATION,
} from "../src/domain/editorial";
import { referenceBriefs } from "../src/domain/reference-briefs";

let app: INestApplication,
  db: PrismaService,
  service: EditorialService,
  agent: ReturnType<typeof request.agent>,
  csrf: string;
let generated = 0,
  uncertain = false,
  cloudFails = false;
const envNames = [
  "COMMONS_AUTO_IMPORT",
  "AI_PROVIDER",
  "GROQ_API_KEY",
  "GROQ_PLAN",
  "GROQ_FREE_TIER_CONFIRMED",
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
    COMMONS_AUTO_IMPORT: "false",
    AI_PROVIDER: "openai",
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
test("Groq Free can prepare under its displayed authorization without enabling paid billing", async () => {
  Object.assign(process.env, {
    AI_PROVIDER: "groq",
    GROQ_API_KEY: "isolated-groq-fixture",
    GROQ_PLAN: "free",
    GROQ_FREE_TIER_CONFIRMED: "true",
    AI_BILLING_AUTHORIZED: "false",
  });
  await pool();
  const status = await service.status();
  expect(status).toMatchObject({
    generationReady: true,
    aiFreePlan: true,
    enablePhrase: "ENABLE EDITORIAL DRAFTS",
  });
  await service.save({
    enabled: true,
    autoPublish: false,
    times: ["09:00", "17:00"],
    revision: 0,
    confirmation: status.enablePhrase,
  });
  await service.queue();
  await service.tick();
  expect((await db.editorialRun.findFirstOrThrow()).state).toBe("NEEDS_REVIEW");
  expect(process.env.AI_BILLING_AUTHORIZED).toBe("false");
});
test("Groq connection test requires owner and CSRF, reads model access and exposes no credential", async () => {
  Object.assign(process.env, {
    AI_PROVIDER: "groq",
    GROQ_API_KEY: "isolated-groq-fixture",
    GROQ_PLAN: "free",
    GROQ_FREE_TIER_CONFIRMED: "true",
    AI_BILLING_AUTHORIZED: "false",
  });
  await request(app.getHttpServer())
    .post("/api/integrations/ai/test")
    .set("Origin", "http://localhost:3100")
    .expect(401);
  await agent
    .post("/api/integrations/ai/test")
    .set("Origin", "http://localhost:3100")
    .expect(403);
  const fetch = jest
    .mocked(global.fetch)
    .mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "openai/gpt-oss-20b" }] })),
    );
  const result = await agent
    .post("/api/integrations/ai/test")
    .set("Origin", "http://localhost:3100")
    .set("X-CSRF-Token", csrf)
    .expect(201);
  expect(result.body).toMatchObject({
    provider: "groq",
    connected: true,
    generationReady: true,
  });
  expect(JSON.stringify(result.body)).not.toContain("isolated-groq-fixture");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/models");
  expect(generated).toBe(0);
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
test("automatic Commons discovery attaches an audited photo before standing-policy scheduling", async () => {
  process.env.COMMONS_AUTO_IMPORT = "true";
  const discover = jest
    .spyOn(app.get(CommonsPhotoService), "discover")
    .mockImplementation(async () =>
      db.mediaAsset.create({
        data: {
          title: "Laptop camera photo.jpg",
          url: "https://upload.wikimedia.org/wikipedia/commons/test/Laptop.jpg",
          alt: "Illustrative photograph: laptop on a desk",
          creator: "Fixture photographer",
          sourceUrl: "https://commons.wikimedia.org/?curid=123",
          provider: "WIKIMEDIA",
          license: "CC BY 4.0",
          licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
          attribution:
            "Photo by Fixture photographer · CC BY 4.0 · Wikimedia Commons",
          rightsConfirmed: true,
          metadata: {
            commonsAutoReview: { humanReviewed: false },
            editorialPhoto: {
              enabled: true,
              tags: ["laptop"],
              confirmedAt: new Date().toISOString(),
              reviewKind: "AUTOMATIC_COMMONS_METADATA",
            },
          },
        },
      }),
    );
  await enable(true);
  await service.queue();
  await service.tick();
  const run = await db.editorialRun.findFirstOrThrow({
    include: { article: { include: { media: { include: { media: true } } } } },
  });
  expect(run.state).toBe("SCHEDULED");
  expect(run.article?.media[0].media.attribution).toContain(
    "Fixture photographer",
  );
  expect(run.article?.media[0].media.metadata).toMatchObject({
    commonsAutoReview: { humanReviewed: false },
  });
  expect(discover).toHaveBeenCalledTimes(1);
  expect(app.get(CloudPublishingService).schedule).toHaveBeenCalledTimes(1);
});
test("automatic photo failure preserves the generated draft and makes no publication attempt", async () => {
  process.env.COMMONS_AUTO_IMPORT = "true";
  jest
    .spyOn(app.get(CommonsPhotoService), "discover")
    .mockRejectedValue(new Error("Commons fixture outage"));
  await enable(true);
  await service.queue();
  await service.tick();
  await service.tick();
  const run = await db.editorialRun.findFirstOrThrow({
    include: { article: true },
  });
  expect(run.state).toBe("BLOCKED_MEDIA");
  expect(run.article?.html).not.toBe("");
  expect(generated).toBe(1);
  expect(app.get(CloudPublishingService).schedule).not.toHaveBeenCalled();
});
test.each(["openai", "groq"])(
  "%s standing auto policy schedules at most two slots and records automated rather than human approval",
  async (provider) => {
    if (provider === "groq")
      Object.assign(process.env, {
        AI_PROVIDER: "groq",
        GROQ_API_KEY: "isolated-groq-fixture",
        GROQ_PLAN: "free",
        GROQ_FREE_TIER_CONFIRMED: "true",
        AI_BILLING_AUTHORIZED: "false",
      });
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
  },
);
test("uncertainty and uncertain Blogger results never auto-regenerate or replay", async () => {
  await pool();
  await pool(1);
  await enable(true);
  uncertain = true;
  await service.queue();
  await service.tick();
  expect((await db.editorialRun.findFirstOrThrow()).state).toBe("NEEDS_REVIEW");
  expect((await db.editorialRun.findFirstOrThrow()).stage).toBe("READY");
  expect(await db.articleMedia.count()).toBe(1);
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
  expect((await service.starters()).created).toBe(referenceBriefs.length);
  expect((await service.starters()).created).toBe(0);
});

async function blockedAutomaticPhotoRun() {
  const image = await pool();
  await enable(true);
  await db.mediaAsset.delete({ where: { id: image.id } });
  await service.queue();
  await service.tick();
  const run = await db.editorialRun.findFirstOrThrow();
  expect(run.state).toBe("BLOCKED_MEDIA");
  await db.editorialRun.update({
    where: { id: run.id },
    data: {
      slotAt: new Date(Date.now() + 60 * 60000),
      finishedAt: new Date(Date.now() - 3 * 60000),
    },
  });
  return run;
}
const recoverPhotos = () =>
  (service as unknown as { recoverPhotos(): Promise<void> }).recoverPhotos();

test("automatic photo recovery resumes a saved draft after refill without regenerating text", async () => {
  const run = await blockedAutomaticPhotoRun();
  await pool(1);
  await recoverPhotos();
  expect(
    (await db.editorialRun.findUniqueOrThrow({ where: { id: run.id } })).state,
  ).toBe("QUEUED");
  await service.tick();
  expect(
    (await db.editorialRun.findUniqueOrThrow({ where: { id: run.id } })).state,
  ).toBe("SCHEDULED");
  expect(generated).toBe(1);
  expect(app.get(CloudPublishingService).schedule).toHaveBeenCalledTimes(1);
});

test("photo recovery has a durable three-attempt budget and two-minute cooldown", async () => {
  const run = await blockedAutomaticPhotoRun();
  for (let attempt = 0; attempt < 3; attempt++) {
    await recoverPhotos();
    expect(
      await db.auditLog.count({
        where: { action: "EDITORIAL_PHOTO_AUTO_RETRY", entityId: run.id },
      }),
    ).toBe(attempt + 1);
    await db.editorialRun.update({
      where: { id: run.id },
      data: { state: "BLOCKED_MEDIA", finishedAt: new Date() },
    });
    await recoverPhotos();
    expect(
      (await db.editorialRun.findUniqueOrThrow({ where: { id: run.id } }))
        .state,
    ).toBe("BLOCKED_MEDIA");
    await db.editorialRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(Date.now() - 3 * 60000) },
    });
  }
  await recoverPhotos();
  expect(
    (await db.editorialRun.findUniqueOrThrow({ where: { id: run.id } })).state,
  ).toBe("BLOCKED_MEDIA");
  expect(generated).toBe(1);
});

test("photo recovery respects pause, scheduling window and draft version", async () => {
  const run = await blockedAutomaticPhotoRun();
  await db.automationSettings.update({
    where: { id: "owner" },
    data: { paused: true },
  });
  await recoverPhotos();
  await db.automationSettings.update({
    where: { id: "owner" },
    data: { paused: false },
  });
  await db.editorialRun.update({
    where: { id: run.id },
    data: { slotAt: new Date(Date.now() + 5 * 60000) },
  });
  await recoverPhotos();
  await db.editorialRun.update({
    where: { id: run.id },
    data: { slotAt: new Date(Date.now() + 60 * 60000) },
  });
  await db.article.update({
    where: { id: run.articleId! },
    data: { version: { increment: 1 } },
  });
  await recoverPhotos();
  expect(
    await db.auditLog.count({
      where: { action: "EDITORIAL_PHOTO_AUTO_RETRY", entityId: run.id },
    }),
  ).toBe(0);
  expect(
    (await db.editorialRun.findUniqueOrThrow({ where: { id: run.id } })).state,
  ).toBe("BLOCKED_MEDIA");
});

test("one daily image-led slot pins its unused library photo and prevents a second attempt", async () => {
  const image = await pool();
  await service.save({
    enabled: true,
    autoPublish: true,
    autoPlan: true,
    times: ["09:00"],
    revision: 0,
    confirmation: EDITORIAL_PUBLISH,
  });
  expect((await service.queue()).queued).toBe(true);
  expect((await service.queue()).queued).toBe(false);
  await service.tick();
  const run = await db.editorialRun.findFirstOrThrow({
    include: { article: { include: { media: true } } },
  });
  expect(run.state).toBe("SCHEDULED");
  expect(run.article?.intent).toContain("Illustrative image subject");
  expect(run.article?.media.map((m) => m.mediaId)).toEqual([image.id]);
  expect(generated).toBe(1);
});

test("empty image-led library stops before any text-generation call", async () => {
  const image = await pool();
  await service.save({
    enabled: true,
    autoPublish: true,
    autoPlan: true,
    times: ["09:00"],
    revision: 0,
    confirmation: EDITORIAL_PUBLISH,
  });
  await db.mediaAsset.delete({ where: { id: image.id } });
  await service.queue();
  await service.tick();
  expect(generated).toBe(0);
  expect(app.get(CloudPublishingService).schedule).not.toHaveBeenCalled();
});

test("owner can enroll manually imported Unsplash images and used assets remain unavailable", async () => {
  const image = await pool();
  await db.mediaAsset.update({
    where: { id: image.id },
    data: {
      provider: "UNSPLASH",
      license: "Unsplash",
      title: "MySQL icon in 3D",
      alt: "MySQL database render",
      url: "https://images.unsplash.com/photo-fixture",
      metadata: { providerPhotoId: "fixture", licenseCheckedBy: "owner" },
    },
  });
  expect((await service.enrollLibrary()).enrolled).toBe(1);
  const status = await service.status();
  const row = status.pool.find((p) => p.id === image.id)!;
  expect(row.eligible).toBe(true);
  expect((row.metadata.editorialPhoto as any).tags).toContain("mysql");
  expect(
    (await db.mediaAsset.findUniqueOrThrow({ where: { id: image.id } }))
      .attribution,
  ).toContain("Illustration / logo");
  await db.mediaAsset.update({
    where: { id: image.id },
    data: { metadata: { automaticPhotoUse: { articleId: "consumed" } } },
  });
  expect((await service.enrollLibrary()).enrolled).toBe(0);
});

test("automatic quality report and prepared continuation use the same minimum without another image or model call", async () => {
  await pool();
  await enable(true);
  uncertain = true;
  await service.queue();
  await service.tick();
  const run = await db.editorialRun.findFirstOrThrow();
  expect(run.state).toBe("NEEDS_REVIEW");
  const article = await db.article.findUniqueOrThrow({
    where: { id: run.articleId! },
  });
  await db.article.update({
    where: { id: article.id },
    data: {
      html: "<h2>Short incomplete draft</h2><p>Needs expansion.</p>",
      generation: { ...(article.generation as any), uncertainties: [] },
    },
  });
  const report = await app.get(ArticlesService).quality(article.id);
  expect(report.passed).toBe(false);
  expect(
    (report.issues as any[]).some(
      (i) => i.code === "THIN_CONTENT" && i.message.includes("450"),
    ),
  ).toBe(true);
  await expect(service.resumePrepared(run.id, article.version)).rejects.toThrow(
    "quality issues",
  );
  await db.article.update({
    where: { id: article.id },
    data: { html: article.html },
  });
  await db.editorialRun.update({
    where: { id: run.id },
    data: { slotAt: new Date(Date.now() - 60000) },
  });
  await service.resumePrepared(run.id, article.version);
  const queued = await db.editorialRun.findUniqueOrThrow({
    where: { id: run.id },
  });
  expect(queued.slotAt.getTime()).toBeGreaterThan(Date.now() + 5 * 60000);
  await service.tick();
  expect(
    (await db.editorialRun.findUniqueOrThrow({ where: { id: run.id } })).state,
  ).toBe("SCHEDULED");
  expect(generated).toBe(1);
  expect(
    await db.articleMedia.count({ where: { articleId: article.id } }),
  ).toBe(1);
});

test("one short automatic draft gets one bounded expansion and one publication schedule", async () => {
  const ai = app.get(AiService);
  const generate = jest.mocked(ai.generate).getMockImplementation()!;
  jest.spyOn(ai, "generate").mockImplementation(async (dto, version) => {
    const result = await generate(dto, version);
    if (generated === 1)
      await db.article.update({
        where: { id: dto.articleId! },
        data: { html: "<h2>Incomplete answer</h2><p>Too short.</p>" },
      });
    return result;
  });
  await pool();
  await enable(true);
  await service.queue();
  await service.tick();
  const run = await db.editorialRun.findFirstOrThrow();
  expect(run.state).toBe("SCHEDULED");
  expect(generated).toBe(2);
  expect(app.get(CloudPublishingService).schedule).toHaveBeenCalledTimes(1);
});
