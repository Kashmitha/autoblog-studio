import "reflect-metadata";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { PrismaService } from "../src/infrastructure/prisma.service";
import { CommonsPhotoService } from "../src/application/commons-photo.service";
import { PhotoPreparationService } from "../src/application/photo-preparation.service";
import { ArticlesService } from "../src/application/articles.service";
import { AiService } from "../src/application/ai.service";
import { hashPassword } from "../src/domain/security";

let app: INestApplication,
  db: PrismaService,
  photos: PhotoPreparationService,
  agent: ReturnType<typeof request.agent>,
  csrf: string;
let auto: string | undefined;
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/autoblog_test")
    throw Error("Isolated test database required");
  auto = process.env.COMMONS_AUTO_IMPORT;
  app = await createApp();
  await app.init();
  db = app.get(PrismaService);
  photos = app.get(PhotoPreparationService);
  await db.user.upsert({
    where: { email: "photo-test@localhost" },
    create: {
      email: "photo-test@localhost",
      passwordHash: hashPassword("photo-test-password"),
    },
    update: {},
  });
  agent = request.agent(app.getHttpServer());
  const login = await agent
    .post("/api/auth/login")
    .set("Origin", "http://localhost:3100")
    .send({ email: "photo-test@localhost", password: "photo-test-password" })
    .expect(201);
  csrf = login.body.csrfToken;
});
async function cleanup() {
  await db.editorialRun.deleteMany();
  await db.publishJob.deleteMany();
  await db.article.deleteMany();
  await db.mediaAsset.deleteMany();
}
beforeEach(async () => {
  jest.restoreAllMocks();
  await cleanup();
  process.env.COMMONS_AUTO_IMPORT = "false";
  jest
    .spyOn(global, "fetch")
    .mockRejectedValue(Error("Unexpected external request"));
});
afterAll(async () => {
  jest.restoreAllMocks();
  await cleanup();
  await db.user.deleteMany({ where: { email: "photo-test@localhost" } });
  if (auto === undefined) delete process.env.COMMONS_AUTO_IMPORT;
  else process.env.COMMONS_AUTO_IMPORT = auto;
  await app.close();
});
async function draft(n = 0) {
  return db.article.create({
    data: {
      title: `Inspect laptop browser requests ${n}`,
      slug: `photo-draft-${n}`,
      niche: "Web development",
      intent: "Debug a browser request",
      html: "<p>Saved article text.</p>",
      status: "NEEDS_REVIEW",
    },
  });
}
async function photo(n = 0) {
  return db.mediaAsset.create({
    data: {
      title: `Laptop photograph ${n}`,
      url: `https://upload.wikimedia.org/wikipedia/commons/test/Laptop-${n}.jpg`,
      alt: "A laptop on a desk",
      creator: "Fixture photographer",
      sourceUrl: `https://commons.wikimedia.org/?curid=${n + 1}`,
      provider: "WIKIMEDIA",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      attribution: "Fixture photographer / CC BY 4.0",
      rightsConfirmed: true,
      metadata: {
        editorialPhoto: {
          enabled: true,
          tags: ["laptop"],
          confirmedAt: new Date().toISOString(),
        },
      },
    },
  });
}
const prepare = (id: string, version: number) =>
  agent
    .post(`/api/editorial/articles/${id}/prepare-photo`)
    .set("Origin", "http://localhost:3100")
    .set("X-CSRF-Token", csrf)
    .send({ version });

test("queue and preparation require owner auth, CSRF and a valid version", async () => {
  const a = await draft();
  await request(app.getHttpServer())
    .get("/api/editorial/photo-queue")
    .expect(401);
  await agent
    .post(`/api/editorial/articles/${a.id}/prepare-photo`)
    .set("Origin", "http://localhost:3100")
    .send({ version: a.version })
    .expect(403);
  await prepare(a.id, 0).expect(400);
  expect(await db.articleMedia.count()).toBe(0);
});
test("library-first preparation adds one credited photo without AI or publication", async () => {
  const a = await draft(),
    p = await photo(),
    ai = jest.spyOn(app.get(AiService), "generate"),
    discover = jest.spyOn(app.get(CommonsPhotoService), "discover");
  const response = await prepare(a.id, a.version).expect(201);
  expect(response.body).toMatchObject({
    state: "ATTACHED",
    source: "LIBRARY",
    mediaId: p.id,
  });
  const saved = await app.get(ArticlesService).get(a.id);
  expect(saved.html).toBe(a.html);
  expect(saved.version).toBe(a.version + 1);
  expect(saved.status).toBe("NEEDS_REVIEW");
  expect(saved.approvedAt).toBeNull();
  expect(saved.media[0].media.attribution).toContain("CC BY 4.0");
  expect(ai).not.toHaveBeenCalled();
  expect(discover).not.toHaveBeenCalled();
  expect(await db.publishJob.count()).toBe(0);
});
test("Commons fallback attaches the discovered candidate when enabled", async () => {
  const a = await draft();
  process.env.COMMONS_AUTO_IMPORT = "true";
  const discover = jest
    .spyOn(app.get(CommonsPhotoService), "discover")
    .mockImplementation(async () => photo());
  const response = await prepare(a.id, a.version).expect(201);
  expect(response.body.source).toBe("COMMONS");
  expect(discover).toHaveBeenCalledWith(
    ["laptop keyboard", "computer workstation"],
    a.id,
  );
});
test("failed discovery records a retryable reason and leaves text and version unchanged", async () => {
  const a = await draft();
  process.env.COMMONS_AUTO_IMPORT = "true";
  jest
    .spyOn(app.get(CommonsPhotoService), "discover")
    .mockRejectedValue(Error("provider failure"));
  const response = await prepare(a.id, a.version).expect(201);
  expect(response.body).toMatchObject({
    state: "BLOCKED",
    code: "PROVIDER_UNAVAILABLE",
  });
  expect(await db.article.findUnique({ where: { id: a.id } })).toMatchObject({
    version: a.version,
    html: a.html,
    status: a.status,
  });
  expect((await photos.queue()).articles[0].lastAttempt?.code).toBe(
    "PROVIDER_UNAVAILABLE",
  );
  expect(await db.articleMedia.count()).toBe(0);
});
test("no matching photo stops without an unrelated, Unsplash or generated-image fallback", async () => {
  const a = await draft();
  const response = await prepare(a.id, a.version).expect(201);
  expect(response.body).toMatchObject({
    state: "BLOCKED",
    code: "DISCOVERY_DISABLED",
  });
  expect(await db.articleMedia.count()).toBe(0);
  expect(global.fetch).not.toHaveBeenCalled();
});
test("existing attachments are preserved and approved or Blogger articles cannot be changed", async () => {
  const a = await draft(),
    p = await photo();
  await db.articleMedia.create({ data: { articleId: a.id, mediaId: p.id } });
  expect((await prepare(a.id, a.version).expect(201)).body.state).toBe(
    "ALREADY_ATTACHED",
  );
  await db.article.update({
    where: { id: a.id },
    data: { status: "APPROVED" },
  });
  await prepare(a.id, a.version).expect(409);
  await db.article.update({
    where: { id: a.id },
    data: { status: "NEEDS_REVIEW", publishingTarget: "blogger" },
  });
  await prepare(a.id, a.version).expect(409);
  expect((await photos.queue()).articles).toHaveLength(0);
  expect(await db.articleMedia.count()).toBe(1);
});
test("concurrent calls for one draft attach only once; stale retries are rejected", async () => {
  const a = await draft();
  await photo();
  const responses = await Promise.all([
    prepare(a.id, a.version),
    prepare(a.id, a.version),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(await db.articleMedia.count()).toBe(1);
  await prepare(a.id, a.version).expect(409);
});
test("concurrent different drafts cannot claim the same recent photograph", async () => {
  const a = await draft(),
    b = await draft(1);
  await photo();
  const responses = await Promise.allSettled([
    photos.prepare(a.id, a.version),
    photos.prepare(b.id, b.version),
  ]);
  expect(
    responses.filter(
      (r) => r.status === "fulfilled" && r.value.state === "ATTACHED",
    ),
  ).toHaveLength(1);
  expect(await db.articleMedia.count()).toBe(1);
});
test("approval or pool changes during discovery are checked again at attachment", async () => {
  const a = await draft();
  process.env.COMMONS_AUTO_IMPORT = "true";
  jest
    .spyOn(app.get(CommonsPhotoService), "discover")
    .mockImplementation(async () => {
      const p = await photo();
      await db.article.update({
        where: { id: a.id },
        data: { status: "APPROVED", approvedAt: new Date() },
      });
      return p;
    });
  await prepare(a.id, a.version).expect(409);
  expect(await db.articleMedia.count()).toBe(0);
  expect(
    (await db.article.findUniqueOrThrow({ where: { id: a.id } })).status,
  ).toBe("APPROVED");
});
test("queue distinguishes empty briefs and attached images; recently used draft images are skipped", async () => {
  const a = await draft(),
    p = await photo();
  await db.articleMedia.create({ data: { articleId: a.id, mediaId: p.id } });
  const b = await draft(1);
  await db.article.update({ where: { id: b.id }, data: { html: "" } });
  const rows = (await photos.queue()).articles;
  expect(rows.find((r) => r.id === a.id)?.state).toBe("ATTACHED");
  expect(rows.find((r) => r.id === b.id)?.state).toBe("NEEDS_TEXT");
  const c = await draft(2);
  expect((await photos.prepare(c.id, c.version)).state).toBe("BLOCKED");
});

test("a scheduled workflow already processing a draft blocks manual preparation", async () => {
  const a = await draft();
  await photo();
  await db.editorialRun.create({
    data: {
      slotKey: "photo-active-test",
      slotAt: new Date(),
      policyRevision: 1,
      state: "PROCESSING",
      articleId: a.id,
    },
  });
  expect((await photos.queue()).articles[0].state).toBe("WORKFLOW_BUSY");
  await prepare(a.id, a.version).expect(409);
  expect(await db.articleMedia.count()).toBe(0);
});

test("pool rights revoked after selection cannot be attached", async () => {
  const a = await draft(),
    p = await photo();
  jest
    .spyOn(app.get(CommonsPhotoService), "select")
    .mockImplementation(async () => {
      await db.mediaAsset.update({
        where: { id: p.id },
        data: { rightsConfirmed: false },
      });
      return { photo: p, source: "LIBRARY" };
    });
  await prepare(a.id, a.version).expect(409);
  expect(await db.articleMedia.count()).toBe(0);
  expect(
    (await db.article.findUniqueOrThrow({ where: { id: a.id } })).version,
  ).toBe(a.version);
});
