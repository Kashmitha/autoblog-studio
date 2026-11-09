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
const origin = "http://localhost:3100",
  prefix = "planning-test-";
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/autoblog_test")
    throw new Error("Isolated test database required");
  app = await createApp();
  await app.init();
  db = app.get(PrismaService);
  await db.user.create({
    data: {
      email: "planning@localhost",
      passwordHash: hashPassword("planning-password-123"),
    },
  });
  agent = request.agent(app.getHttpServer());
  csrf = (
    await agent
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: "planning@localhost", password: "planning-password-123" })
      .expect(201)
  ).body.csrfToken;
});
beforeEach(async () => {
  await db.article.deleteMany({ where: { slug: { startsWith: prefix } } });
  await db.integration.upsert({
    where: { provider: "google" },
    create: {
      provider: "google",
      encryptedTokens: "unused",
      blogUrl: "https://fixture.blogspot.com/",
    },
    update: { blogUrl: "https://fixture.blogspot.com/" },
  });
});
afterAll(async () => {
  await db.article.deleteMany({ where: { slug: { startsWith: prefix } } });
  await db.user.deleteMany({ where: { email: "planning@localhost" } });
  await app.close();
});
const create = (name: string, data: object = {}) =>
  db.article.create({
    data: {
      title: "Git staged changes " + name,
      slug: prefix + name,
      niche: "Git",
      intent: "Understand Git staged work",
      ...data,
    },
  });
const patch = (id: string, data: object) =>
  agent
    .patch("/api/articles/" + id + "/planning")
    .set("Origin", origin)
    .set("X-CSRF-Token", csrf)
    .send(data);
test("backlog and suggestions require authentication; plan mutations require CSRF and valid fields", async () => {
  const a = await create("auth");
  await request(app.getHttpServer()).get("/api/articles/backlog").expect(401);
  await request(app.getHttpServer())
    .get(`/api/articles/${a.id}/internal-links`)
    .expect(401);
  await agent
    .patch(`/api/articles/${a.id}/planning`)
    .set("Origin", origin)
    .send({})
    .expect(403);
  await patch(a.id, {
    backlogPriority: 4,
    planningNotes: "",
    planningVersion: 1,
  }).expect(400);
  await patch(a.id, {
    backlogPriority: 1,
    planningNotes: "x".repeat(3001),
    planningVersion: 1,
  }).expect(400);
});
test("backlog includes all editable stages ordered by priority and excludes published or Blogger-managed work", async () => {
  const low = await create("low", { backlogPriority: 1 }),
    high = await create("high", { backlogPriority: 3, status: "APPROVED" });
  const live = await create("live", { status: "PUBLISHED" }),
    remote = await create("remote", { publishingTarget: "blogger" });
  const rows = (await agent.get("/api/articles/backlog").expect(200)).body
    .articles;
  expect(rows.findIndex((x: any) => x.id === high.id)).toBeLessThan(
    rows.findIndex((x: any) => x.id === low.id),
  );
  expect(rows.some((x: any) => [live.id, remote.id].includes(x.id))).toBe(
    false,
  );
  expect(rows[0].html).toBeUndefined();
});
test("private planning changes preserve editorial approval and content and reject stale updates", async () => {
  const a = await create("preserve", {
    status: "APPROVED",
    approvedAt: new Date(),
    html: "<p>Reviewed content</p>",
  });
  await patch(a.id, {
    backlogPriority: 3,
    planningNotes: "Test three cases",
    planningVersion: 1,
  }).expect(200);
  const saved = await db.article.findUniqueOrThrow({ where: { id: a.id } });
  expect(saved).toMatchObject({
    status: a.status,
    version: a.version,
    html: a.html,
    approvedAt: a.approvedAt,
    planningVersion: 2,
  });
  await patch(a.id, {
    backlogPriority: 0,
    planningNotes: "stale",
    planningVersion: 1,
  }).expect(409);
  await db.article.update({
    where: { id: a.id },
    data: { status: "SCHEDULED" },
  });
  await patch(a.id, {
    backlogPriority: 0,
    planningNotes: "locked",
    planningVersion: 2,
  }).expect(409);
});
test("suggestions use only published owned-blog posts, omit existing links and never change content", async () => {
  const a = await create("source", {
    html: '<p>Draft</p><a href="https://fixture.blogspot.com/existing?m=1">Read</a>',
  });
  const published = await create("published", {
    status: "PUBLISHED",
    publishedUrl: "https://fixture.blogspot.com/new",
  });
  await create("existing", {
    status: "PUBLISHED",
    publishedUrl: "https://fixture.blogspot.com/existing",
  });
  await create("scheduled", {
    status: "SCHEDULED",
    publishedUrl: "https://fixture.blogspot.com/future",
  });
  await create("external", {
    status: "PUBLISHED",
    publishedUrl: "https://other.test/post",
  });
  const report = (
    await agent.get(`/api/articles/${a.id}/internal-links`).expect(200)
  ).body;
  expect(report.suggestions.map((s: any) => s.id)).toEqual([published.id]);
  expect(await db.article.findUnique({ where: { id: a.id } })).toEqual(a);
  await db.integration.update({
    where: { provider: "google" },
    data: { blogUrl: null },
  });
  expect(
    (await agent.get(`/api/articles/${a.id}/internal-links`).expect(200)).body
      .suggestions,
  ).toEqual([]);
});
