import "reflect-metadata";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { PrismaService } from "../src/infrastructure/prisma.service";
import {
  ContentArchiveService,
  archiveLimits,
} from "../src/application/content-archive.service";
import { hashPassword } from "../src/domain/security";
import { ContentImportService } from "../src/application/content-import.service";
let app: INestApplication,
  db: PrismaService,
  agent: ReturnType<typeof request.agent>,
  csrf: string;
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/autoblog_test")
    throw new Error("Archives require isolated test database");
  app = await createApp();
  await app.init();
  db = app.get(PrismaService);
  await db.user.upsert({
    where: { email: "archive@localhost" },
    create: {
      email: "archive@localhost",
      passwordHash: hashPassword("archive-test-password"),
    },
    update: { passwordHash: hashPassword("archive-test-password") },
  });
  agent = request.agent(app.getHttpServer());
  const login = await agent
    .post("/api/auth/login")
    .set("Origin", "http://localhost:3100")
    .send({ email: "archive@localhost", password: "archive-test-password" })
    .expect(201);
  csrf = login.body.csrfToken;
});
beforeEach(async () => {
  jest.restoreAllMocks();
  await db.publishJob.deleteMany();
  await db.article.deleteMany();
  await db.mediaAsset.deleteMany();
});
afterAll(async () => {
  jest.restoreAllMocks();
  await db.user.deleteMany({ where: { email: "archive@localhost" } });
  await app.close();
});
test("summary and export require an owner session", async () => {
  await request(app.getHttpServer()).get("/api/content/archive").expect(401);
  await request(app.getHttpServer())
    .get("/api/content/archive/export")
    .expect(401);
});
test("empty archives are genuine versioned downloads with explicit coverage and no-cache headers", async () => {
  const summary = await agent.get("/api/content/archive").expect(200);
  expect(summary.body).toMatchObject({
    articles: 0,
    sources: 0,
    media: 0,
    withinCountLimits: true,
  });
  const result = await agent.get("/api/content/archive/export").expect(200);
  expect(result.headers["cache-control"]).toBe("no-store");
  expect(result.headers["x-content-type-options"]).toBe("nosniff");
  expect(result.headers["content-disposition"]).toMatch(
    /attachment; filename="autoblog-content-\d{4}-\d{2}-\d{2}\.json"/,
  );
  expect(result.body).toMatchObject({
    format: "autoblog-studio-content",
    schemaVersion: 1,
    articles: [],
    media: [],
    counts: { articles: 0, sources: 0, media: 0 },
  });
  expect(result.body.coverage.excluded).toContain(
    "Original uploaded image files",
  );
});
test("archive preserves content, sources, plans and credit references without credentials, metadata or publication mutations", async () => {
  const media = await db.mediaAsset.create({
    data: {
      title: "Original example",
      url: "/api/media/uploads/private/preview",
      alt: "Example",
      creator: "Editor",
      sourceUrl: "https://example.com/source",
      provider: "ORIGINAL",
      license: "Original work",
      licenseUrl: "https://example.com/license",
      attribution: "Editor credit",
      metadata: { privateStoragePath: "private-storage-sentinel" },
    },
  });
  const article = await db.article.create({
    data: {
      title: 'Git & "staged" changes',
      slug: "archive-integration-fixture",
      html: "<h2>Review</h2><p>Unicode: සිංහල &amp; examples.</p>",
      niche: "Git",
      intent: "Preserve work",
      labels: ["Git"],
      planningNotes: "Private research notes",
      backlogPriority: 3,
      status: "APPROVED",
      approvedAt: new Date(),
      aiAssisted: true,
      disclosure: false,
      generation: { privateProviderData: "provider-sentinel" },
      sources: {
        create: {
          url: "https://git-scm.com/docs/git-diff",
          title: "Git diff",
          note: "Supports staged comparison",
          checkedAt: new Date(),
          httpStatus: 200,
        },
      },
      media: { create: { mediaId: media.id } },
    },
  });
  await db.integration.upsert({
    where: { provider: "google" },
    create: { provider: "google", encryptedTokens: "oauth-secret-sentinel" },
    update: { encryptedTokens: "oauth-secret-sentinel" },
  });
  const result = await agent.get("/api/content/archive/export").expect(200),
    exported = result.body.articles.find((a: any) => a.id === article.id);
  expect(exported).toMatchObject({
    title: article.title,
    html: article.html,
    planningNotes: article.planningNotes,
    aiAssisted: true,
    disclosure: false,
    status: "APPROVED",
    media: [{ mediaId: media.id }],
  });
  expect(exported.sources[0].note).toBe("Supports staged comparison");
  expect(result.body.media[0]).toMatchObject({
    id: media.id,
    attribution: "Editor credit",
    license: "Original work",
  });
  for (const forbidden of [
    "oauth-secret-sentinel",
    "archive-test-password",
    "private-storage-sentinel",
    "provider-sentinel",
    '"passwordHash"',
    '"csrfToken"',
    '"approvedAt"',
    '"jobs"',
  ])
    expect(result.text).not.toContain(forbidden);
  expect(
    await db.article.findUniqueOrThrow({ where: { id: article.id } }),
  ).toMatchObject({
    html: article.html,
    version: article.version,
    status: article.status,
    approvedAt: article.approvedAt,
  });
  expect(await db.publishJob.count({ where: { articleId: article.id } })).toBe(
    0,
  );
});
test("record limits fail explicitly without returning a truncated archive", async () => {
  await db.article.createMany({
    data: Array.from({ length: archiveLimits.articles + 1 }, (_, i) => ({
      title: "Archive limit fixture " + i,
      slug: "archive-limit-" + i,
    })),
  });
  expect(
    (await agent.get("/api/content/archive").expect(200)).body
      .withinCountLimits,
  ).toBe(false);
  await expect(app.get(ContentArchiveService).export()).rejects.toThrow(
    "no partial archive",
  );
});
test("byte limits fail explicitly instead of sending a partial JSON file", async () => {
  await db.article.create({
    data: {
      title: "Size bounded archive",
      slug: "archive-size-fixture",
      html: "<p>" + "x".repeat(2000) + "</p>",
    },
  });
  const limit = archiveLimits.bytes;
  archiveLimits.bytes = 100;
  try {
    const result = await agent.get("/api/content/archive/export").expect(400);
    expect(result.body.message).toContain("no partial archive");
    expect(result.headers["content-disposition"]).toBeUndefined();
  } finally {
    archiveLimits.bytes = limit;
  }
});

async function importFixture() {
  const media = await db.mediaAsset.create({
    data: {
      id: "archive-old-media",
      title: "Original screenshot",
      url: "/api/media/private/original",
      alt: "Staged diff",
      creator: "Editor",
      provider: "ORIGINAL",
      sourceUrl: "",
      license: "Original",
      licenseUrl: "",
      attribution: "Editor credit",
      rightsConfirmed: true,
    },
  });
  const a = await db.article.create({
    data: {
      id: "archive-old-article",
      title: "Git changes for import",
      slug: "archive-old-article",
      niche: "Git",
      html: '<h2>Example</h2><p>Saved text</p><img src="https://example.com/photo.png">',
      aiAssisted: true,
      disclosure: false,
      status: "PUBLISHED",
      approvedAt: new Date(),
      remotePostId: "remote-never-restore",
      sources: {
        create: {
          url: "https://git-scm.com/docs/git-diff",
          title: "Git diff",
          note: "Supports staged comparison",
          checkedAt: new Date(),
          httpStatus: 200,
        },
      },
      media: { create: { mediaId: media.id } },
    },
  });
  const buffer = Buffer.from(
    (await app.get(ContentArchiveService).export()).json,
  );
  await db.article.delete({ where: { id: a.id } });
  await db.mediaAsset.delete({ where: { id: media.id } });
  return buffer;
}
test("preview and import require owner authentication, origin and CSRF", async () => {
  const file = Buffer.from("{}");
  await request(app.getHttpServer())
    .post("/api/content/archive/preview")
    .set("Origin", "http://localhost:3100")
    .attach("file", file, "archive.json")
    .expect(401);
  await agent
    .post("/api/content/archive/preview")
    .set("Origin", "http://localhost:3100")
    .attach("file", file, "archive.json")
    .expect(403);
  await agent
    .post("/api/content/archive/import")
    .set("Origin", "https://evil.test")
    .set("X-CSRF-Token", csrf)
    .attach("file", file, "archive.json")
    .expect(403);
});
test("preview writes nothing; imports create only sanitized review drafts, reset source checks and retain unreviewed image credits", async () => {
  const file = await importFixture(),
    importer = app.get(ContentImportService);
  const plan = await importer.preview(file);
  expect(await db.article.count()).toBe(0);
  expect(plan.articles[0].action).toBe("create");
  const result = await agent
    .post("/api/content/archive/import")
    .set("Origin", "http://localhost:3100")
    .set("X-CSRF-Token", csrf)
    .field("fingerprint", plan.fingerprint)
    .attach("file", file, "archive.json")
    .expect(201);
  expect(result.body.createdArticles).toBe(1);
  const article = await db.article.findFirstOrThrow({
    include: { sources: true, media: { include: { media: true } } },
  });
  expect(article).toMatchObject({
    status: "NEEDS_REVIEW",
    approvedAt: null,
    version: 1,
    publishingTarget: "local",
    remotePostId: null,
    remoteBlogId: null,
    publishedUrl: null,
    aiAssisted: true,
    disclosure: false,
  });
  expect(article.html).not.toContain("<img");
  expect(article.sources[0]).toMatchObject({
    checkedAt: null,
    httpStatus: null,
    note: "Supports staged comparison",
  });
  expect(article.media[0].media).toMatchObject({
    provider: "ARCHIVE",
    url: "",
    rightsConfirmed: false,
    attribution: "Editor credit",
  });
  expect(await db.publishJob.count()).toBe(0);
  const repeat = await importer.import(file, plan.fingerprint);
  expect(repeat.createdArticles).toBe(0);
  expect(repeat.createdMedia).toBe(0);
  expect(await db.article.count()).toBe(1);
});
test("concurrent imports are serialized and changed files cannot use an old preview", async () => {
  const file = await importFixture(),
    importer = app.get(ContentImportService),
    plan = await importer.preview(file);
  await expect(
    importer.import(Buffer.from(file.toString() + " "), plan.fingerprint),
  ).rejects.toThrow("changed after preview");
  expect(await db.article.count()).toBe(0);
  const results = await Promise.all([
    importer.import(file, plan.fingerprint),
    importer.import(file, plan.fingerprint),
  ]);
  expect(results.reduce((sum, r) => sum + r.createdArticles, 0)).toBe(1);
  expect(await db.article.count()).toBe(1);
  expect(await db.mediaAsset.count()).toBe(1);
});
test("an archive imported into its original workspace skips existing IDs and preserves publication and approvals", async () => {
  const article = await db.article.create({
    data: {
      title: "Existing reviewed publication",
      slug: "archive-existing",
      status: "PUBLISHED",
      approvedAt: new Date(),
      html: "<p>Original body</p>",
    },
  });
  const file = Buffer.from(
      (await app.get(ContentArchiveService).export()).json,
    ),
    importer = app.get(ContentImportService),
    plan = await importer.preview(file);
  expect(plan.articles[0].action).toBe("skip");
  expect((await importer.import(file, plan.fingerprint)).createdArticles).toBe(
    0,
  );
  expect(await db.article.findUnique({ where: { id: article.id } })).toEqual(
    article,
  );
});
