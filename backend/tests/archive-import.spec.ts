import { parseContentArchive } from "../src/domain/archive-import";
const archive = () => ({
  format: "autoblog-studio-content",
  schemaVersion: 1,
  counts: { articles: 1, sources: 1, media: 0 },
  media: [],
  articles: [
    {
      id: "original",
      title: "Test a staged Git diff",
      niche: "Git",
      intent: "Keep work",
      excerpt: "",
      html: '<h2>Example</h2><script>alert(1)</script><img src="https://example.com/private.png"><p onclick="x()">Saved work</p>',
      labels: ["Git"],
      planningNotes: "Test commands",
      backlogPriority: 2,
      aiAssisted: true,
      disclosure: false,
      sources: [
        {
          url: "https://git-scm.com/docs/git-diff",
          title: "Git diff",
          note: "Explains staged changes",
          checkedAt: "2026-11-09",
          httpStatus: 200,
        },
      ],
      media: [],
      approvedAt: "2026-11-09",
      status: "PUBLISHED",
      remotePostId: "never-restore",
    },
  ],
});
const parse = (a: unknown) =>
  parseContentArchive(Buffer.from(JSON.stringify(a)));
test("archive parsing preserves content and provenance while removing executable markup and inline images", () => {
  const parsed = parse(archive()),
    a = parsed.articles[0];
  expect(a.data.html).toContain("Saved work");
  for (const s of ["script", "onclick", "<img"])
    expect(a.data.html).not.toContain(s);
  expect(a.htmlAdjusted).toBe(true);
  expect(a.data.aiAssisted).toBe(true);
  expect(a.data).not.toHaveProperty("remotePostId");
  expect(a.sources[0]).not.toHaveProperty("checkedAt");
});
test("fingerprints bind the exact file while stable draft identity ignores export timestamps and publication status", () => {
  const a = archive(),
    first = parse(a),
    second = parse({ ...a, exportedAt: "another-time" });
  expect(first.fingerprint).not.toBe(second.fingerprint);
  expect(first.articles[0].slug).toBe(second.articles[0].slug);
});
test("malformed, unsupported and inconsistent archives are rejected", () => {
  expect(() => parseContentArchive(Buffer.from("not-json"))).toThrow(
    "valid Studio",
  );
  expect(() => parse({ ...archive(), schemaVersion: 2 })).toThrow(
    "Unsupported",
  );
  expect(() =>
    parse({ ...archive(), counts: { articles: 2, sources: 1, media: 0 } }),
  ).toThrow("counts");
});
test("duplicates, missing references, invalid source URLs and out-of-range fields are rejected", () => {
  const a = archive();
  expect(() =>
    parse({ ...a, articles: [...a.articles, ...a.articles] }),
  ).toThrow("Duplicate article IDs");
  const wrong = (patch: object) => ({
    ...a,
    articles: [{ ...a.articles[0], ...patch }],
  });
  expect(() => parse(wrong({ media: [{ mediaId: "missing" }] }))).toThrow(
    "missing media",
  );
  expect(() => parse(wrong({ backlogPriority: 4 }))).toThrow("priority");
  expect(() => parse(wrong({ aiAssisted: "true" }))).toThrow("provenance");
  expect(() =>
    parse(
      wrong({
        sources: [
          {
            url: "https://secret:password@example.com",
            title: "Bad",
            note: "",
          },
        ],
      }),
    ),
  ).toThrow("without credentials");
});
