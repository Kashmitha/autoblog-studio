import {
  commonsPhotoQueries,
  inspectCommonsPhoto,
  type CommonsFile,
} from "../src/domain/commons-photo";
import { CommonsPhotoService } from "../src/application/commons-photo.service";
import { PrismaService } from "../src/infrastructure/prisma.service";

const fixture = (): CommonsFile => ({
  pageid: 123,
  title: "File:Laptop on a desk.jpg",
  categories: [{ title: "Category:Laptop computers" }],
  imageinfo: [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/1/12/Laptop.jpg",
      mime: "image/jpeg",
      mediatype: "BITMAP",
      width: 1600,
      height: 1000,
      size: 100000,
      sha1: "a".repeat(40),
      timestamp: "2019-05-01T00:00:00Z",
      metadata: [
        { name: "Make", value: "Canon" },
        { name: "Model", value: "Camera fixture" },
        { name: "DateTimeOriginal", value: "2018:05:01 12:00:00" },
      ],
      extmetadata: {
        Artist: { value: "<b>Fixture photographer</b>" },
        LicenseShortName: { value: "CC BY 4.0" },
        LicenseUrl: { value: "https://creativecommons.org/licenses/by/4.0/" },
        ImageDescription: { value: "A laptop computer on a wooden desk" },
      },
    },
  ],
});
const old = process.env.COMMONS_AUTO_IMPORT;
beforeEach(() => {
  process.env.COMMONS_AUTO_IMPORT = "true";
});
afterEach(() => {
  jest.restoreAllMocks();
  if (old === undefined) delete process.env.COMMONS_AUTO_IMPORT;
  else process.env.COMMONS_AUTO_IMPORT = old;
});

test("queries are bounded photographic subjects without provider search operators", () => {
  expect(
    commonsPhotoQueries([
      "laptop desk",
      "keyboard",
      "server",
      "ocean",
      "AI generated laptop",
      "laptop desk",
    ]),
  ).toEqual(["laptop desk", "keyboard"]);
  expect(commonsPhotoQueries(["incategory:foo computer"])[0]).not.toContain(
    ":",
  );
});
test("eligible camera photo retains explicit rights, source and non-human-review evidence", () => {
  const result = inspectCommonsPhoto(fixture(), "laptop");
  expect(result).toMatchObject({
    provider: "WIKIMEDIA",
    creator: "Fixture photographer",
    license: "CC BY 4.0",
    sourceUrl: "https://commons.wikimedia.org/?curid=123",
    evidence: { make: "Canon", capturedAt: "2018-05-01T12:00:00.000Z" },
  });
  expect(result?.alt).toContain("Illustrative photograph");
});
test.each([
  "AI-generated laptop.jpg",
  "Computer rendering.jpg",
  "Laptop diagram.jpg",
  "Laptop screenshot.jpg",
])("rejects synthetic/diagram evidence: %s", (title) => {
  const p = fixture();
  p.title = title;
  expect(inspectCommonsPhoto(p, "laptop")).toBeNull();
});
test.each([
  "camera",
  "recent",
  "rights",
  "licenseUrl",
  "host",
  "mime",
  "size",
  "unrelated",
])("missing or unsafe %s evidence stops import", (kind) => {
  const p = fixture(),
    i = p.imageinfo![0];
  if (kind === "camera") i.metadata = [];
  if (kind === "recent") i.timestamp = "2026-01-01T00:00:00Z";
  if (kind === "rights")
    i.extmetadata!.Restrictions = { value: "Permission required" };
  if (kind === "licenseUrl")
    i.extmetadata!.LicenseUrl = { value: "https://example.com/license" };
  if (kind === "host") i.url = "https://127.0.0.1/Laptop.jpg";
  if (kind === "mime") i.mime = "image/svg+xml";
  if (kind === "size") i.width = 100;
  expect(
    inspectCommonsPhoto(p, kind === "unrelated" ? "server" : "laptop"),
  ).toBeNull();
});

function fakeDb(existing: unknown = null, recent = 0) {
  const create = jest
    .fn()
    .mockImplementation(async ({ data }) => ({ id: "imported", ...data }));
  const tx = {
    $executeRaw: jest.fn(),
    mediaAsset: { findFirst: jest.fn().mockResolvedValue(existing), create },
    articleMedia: { count: jest.fn().mockResolvedValue(recent) },
    auditLog: { create: jest.fn() },
  };
  return {
    db: {
      $transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
    } as unknown as PrismaService,
    tx,
  };
}
function responses() {
  return jest
    .spyOn(global, "fetch")
    .mockImplementation(async (_url, init) =>
      init?.method === "HEAD"
        ? new Response(null, { headers: { "content-type": "image/jpeg" } })
        : new Response(
            JSON.stringify({ query: { pages: { "123": fixture() } } }),
          ),
    );
}
test("disabled discovery makes no request or database write", async () => {
  process.env.COMMONS_AUTO_IMPORT = "false";
  const { db, tx } = fakeDb(),
    fetch = jest.spyOn(global, "fetch");
  expect(
    await new CommonsPhotoService(db).discover(["laptop"], "article"),
  ).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  expect(tx.mediaAsset.create).not.toHaveBeenCalled();
});
test("automatic import stores provenance and audit separately from human approval", async () => {
  const { db, tx } = fakeDb(),
    fetch = responses();
  const result = await new CommonsPhotoService(db).discover(
    ["laptop"],
    "article",
  );
  expect(result?.id).toBe("imported");
  expect(tx.mediaAsset.create.mock.calls[0][0].data.metadata).toMatchObject({
    licenseCheckedBy: "AUTOMATIC_COMMONS_METADATA_POLICY",
    commonsAutoReview: { humanReviewed: false, policyVersion: 1 },
    editorialPhoto: { reviewKind: "AUTOMATIC_COMMONS_METADATA" },
  });
  expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(2);
});
test("existing unapproved asset is never silently approved", async () => {
  const { db, tx } = fakeDb({ rightsConfirmed: false }),
    fetch = responses();
  expect(
    await new CommonsPhotoService(db).discover(["laptop"], "article"),
  ).toBeNull();
  expect(tx.mediaAsset.create).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledTimes(2);
});
test("recently used existing photo is skipped rather than duplicated", async () => {
  const { db, tx } = fakeDb(
    {
      id: "existing",
      provider: "WIKIMEDIA",
      license: "CC BY 4.0",
      url: "https://upload.wikimedia.org/photo.jpg",
      alt: "A laptop on a desk",
      rightsConfirmed: true,
      metadata: {
        editorialPhoto: {
          enabled: true,
          tags: ["laptop"],
          confirmedAt: new Date().toISOString(),
        },
      },
    },
    1,
  );
  responses();
  expect(
    await new CommonsPhotoService(db).discover(["laptop"], "article"),
  ).toBeNull();
  expect(tx.mediaAsset.create).not.toHaveBeenCalled();
  expect(tx.articleMedia.count).toHaveBeenCalledTimes(1);
});
test("unavailable image does not import", async () => {
  const { db, tx } = fakeDb();
  jest
    .spyOn(global, "fetch")
    .mockImplementation(async (_url, init) =>
      init?.method === "HEAD"
        ? new Response(null, { status: 404 })
        : new Response(
            JSON.stringify({ query: { pages: { "123": fixture() } } }),
          ),
    );
  expect(
    await new CommonsPhotoService(db).discover(["laptop"], "article"),
  ).toBeNull();
  expect(tx.mediaAsset.create).not.toHaveBeenCalled();
});
