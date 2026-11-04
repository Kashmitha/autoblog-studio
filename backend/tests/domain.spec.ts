import {
  assertTransition,
  canTransition,
  normalizeTopic,
  similarity,
} from "../src/domain/workflow";
import { checkQuality, safeHtml } from "../src/domain/quality";
import {
  decrypt,
  encrypt,
  hashPassword,
  verifyPassword,
} from "../src/domain/security";
import { summarizeFinance } from "../src/domain/finance";
import { publicV4 } from "../src/infrastructure/public-http";
import { MockBloggerAdapter } from "../src/infrastructure/blogger.service";
const article = () => ({
  id: "one",
  title: "Troubleshoot Docker build cache problems",
  html:
    "<h2>Start with useful evidence</h2><p>" +
    Array.from({ length: 200 }, (_, i) => `explanation${i}`).join(" ") +
    ' <a href="https://docs.docker.com/build/cache/">Docker documentation</a></p>',
  excerpt: "A practical guide to diagnosing Docker build cache issues.",
  aiAssisted: false,
  disclosure: true,
  sources: [
    {
      url: "https://docs.docker.com/build/cache/",
      checkedAt: new Date(),
      httpStatus: 200,
      note: "Supports cache invalidation and cache mount behavior.",
    },
  ],
  media: [],
});
describe("editorial state machine", () => {
  test.each([
    ["PLANNED", "PUBLISHED"],
    ["NEEDS_REVIEW", "SCHEDULED"],
    ["PUBLISHED", "DRAFTING"],
    ["APPROVED", "PUBLISHED"],
  ])("rejects unsafe transition %s → %s", (from, to) =>
    expect(() => assertTransition(from as never, to as never)).toThrow(),
  );
  test("supports reviewed publication sequence", () => {
    expect(canTransition("NEEDS_REVIEW", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "SCHEDULED")).toBe(true);
    expect(canTransition("SCHEDULED", "PUBLISHING")).toBe(true);
    expect(canTransition("PUBLISHING", "PUBLISHED")).toBe(true);
  });
  test("normalizes duplicate topics", () => {
    expect(normalizeTopic("Git: Undo a COMMIT!")).toBe("git undo a commit");
    expect(similarity("Docker build cache", "Docker build cache")).toBe(1);
  });
});
describe("concrete quality evidence", () => {
  test("accepts a complete sourced article but still requires editorial review", () => {
    const r = checkQuality(article(), []);
    expect(r.passed).toBe(true);
    expect(r.issues.some((i) => i.code === "EDITORIAL_REVIEW")).toBe(true);
  });
  test("blocks short unsupported draft", () => {
    const a = article();
    a.html = "<p>Hello.</p>";
    a.sources = [];
    const r = checkQuality(a, []);
    expect(r.passed).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["THIN_CONTENT", "NO_SOURCES", "HEADINGS"]),
    );
  });
  test("blocks stale or broken source links", () => {
    const a = article();
    a.sources[0].checkedAt = new Date(0);
    expect(
      checkQuality(a, []).issues.some((i) => i.code === "SOURCE_STALE"),
    ).toBe(true);
    a.sources[0].httpStatus = 404;
    expect(
      checkQuality(a, []).issues.some((i) => i.code === "SOURCE_UNVERIFIED"),
    ).toBe(true);
  });
  test("blocks duplicate article", () => {
    const a = article();
    expect(checkQuality(a, [{ ...a, id: "two" }]).passed).toBe(false);
  });
  test("allows an optional public footer while retaining AI provenance and editorial review", () => {
    const a = article();
    a.aiAssisted = true;
    a.disclosure = false;
    const report = checkQuality(a, []);
    expect(report.passed).toBe(true);
    expect(a.aiAssisted).toBe(true);
    expect(report.issues.some((i) => i.code === "EDITORIAL_REVIEW")).toBe(true);
  });
  test("requires real image rights and attribution", () => {
    const a = {
      ...article(),
      media: [
        {
          media: {
            rightsConfirmed: false,
            creator: "",
            alt: "",
            attribution: "",
            license: "Unknown",
            checkedAt: new Date(),
          },
        },
      ],
    };
    expect(
      checkQuality(a, []).issues.some((i) => i.code === "IMAGE_RIGHTS"),
    ).toBe(true);
  });
  test("removes scripts, handlers, javascript and insecure image URLs", () => {
    const html = safeHtml(
      '<script>alert(1)</script><img src="http://evil.test/x" onerror="alert(1)"/><a href="javascript:alert(1)">test</a>',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("http://");
  });
  test("preserves code and valid source hyperlinks", () => {
    const html =
      '<h2>Example</h2><pre><code>const answer = 42;</code></pre><a href="https://example.com/">Source</a>';
    expect(safeHtml(html)).toBe(html);
  });
});
describe("security boundaries", () => {
  test("hashes passwords and rejects wrong input", () => {
    const hash = hashPassword("a sufficiently long password");
    expect(hash).not.toContain("password");
    expect(verifyPassword("a sufficiently long password", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });
  test("encrypts tokens and detects tampering", () => {
    const key = "ab".repeat(32);
    const value = encrypt("secret-refresh-token", key);
    expect(value).not.toContain("secret");
    expect(decrypt(value, key)).toBe("secret-refresh-token");
    expect(() => decrypt(value, "cd".repeat(32))).toThrow();
  });
  test.each([
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "192.168.0.1",
    "172.20.0.1",
    "100.64.0.1",
    "::1",
    "0.0.0.0",
    "224.0.0.1",
  ])("rejects nonpublic source address %s", (ip) =>
    expect(publicV4(ip)).toBe(false),
  );
  test("allows public IPv4", () => expect(publicV4("8.8.8.8")).toBe(true));
});
describe("financial truthfulness", () => {
  test("estimates do not count as actual profit", () => {
    const r = summarizeFinance(
      [
        { kind: "ACTUAL_REVENUE", amount: 10 },
        { kind: "ESTIMATED_REVENUE", amount: 200 },
        { kind: "EXPENSE", amount: 3 },
      ],
      1000,
      2,
    );
    expect(r.actualRevenue).toBe(10);
    expect(r.estimatedRevenue).toBe(200);
    expect(r.netProfit).toBe(5);
    expect(r.rpm).toBe(10);
  });
  test("handles zero earnings and absent traffic", () => {
    expect(summarizeFinance([], null)).toMatchObject({
      actualRevenue: 0,
      netProfit: 0,
      rpm: null,
    });
    expect(summarizeFinance([{ kind: "EXPENSE", amount: 2 }], 0)).toMatchObject(
      { netProfit: -2, breakEvenRevenue: 2, rpm: null },
    );
  });
});
test("mock Blogger adapter exercises drafts and publish without a live URL", async () => {
  const b = new MockBloggerAdapter();
  const id = await b.createDraft();
  expect((await b.getPost("test", id)).status).toBe("DRAFT");
  expect((await b.publish("test", id)).status).toBe("LIVE");
  expect((await b.getPost("test", id)).url).toBe("");
  expect(b.posts.size).toBe(1);
});
