import {
  articlePerformance,
  csvCell,
  performanceUrl,
  type PerformanceMetric,
} from "../src/domain/performance";
const row = (values: Partial<PerformanceMetric> = {}): PerformanceMetric => ({
  date: new Date("2026-11-02T00:00:00Z"),
  url: "https://fixture.blogspot.com/post.html",
  source: "SEARCH_CONSOLE",
  clicks: null,
  impressions: null,
  pageviews: null,
  ...values,
});
test("missing data stays unknown while genuine zeros remain zero", () => {
  const empty = articlePerformance([], "2026-11-01");
  expect(empty.current).toMatchObject({
    clicks: null,
    pageviews: null,
    impressions: null,
    ctr: null,
    daysReported: 0,
  });
  expect(empty.changes.clicks).toBeNull();
  const zero = articlePerformance(
    [row({ clicks: 0, impressions: 0 })],
    "2026-11-01",
  );
  expect(zero.current).toMatchObject({
    clicks: 0,
    impressions: 0,
    ctr: null,
    daysReported: 1,
  });
});
test("one consistent source spans both periods without adding API and CSV totals together", () => {
  const r = articlePerformance(
    [
      row({ clicks: 4, impressions: 20 }),
      row({ source: "MANUAL", clicks: 400, impressions: 2000, pageviews: 900 }),
      row({ source: "GOOGLE_ANALYTICS", pageviews: 10 }),
      row({
        date: new Date("2026-10-28T00:00:00Z"),
        clicks: 2,
        impressions: 20,
      }),
      row({
        date: new Date("2026-10-28T00:00:00Z"),
        source: "MANUAL",
        pageviews: 500,
      }),
    ],
    "2026-11-01",
  );
  expect(r.current).toMatchObject({
    clicks: 4,
    impressions: 20,
    pageviews: 10,
    ctr: 20,
    daysReported: 1,
  });
  expect(r.previous.pageviews).toBeNull();
  expect(r.changes.clicks).toEqual({ absolute: 2, percent: 100 });
  expect(r.searchSource).toBe("SEARCH_CONSOLE");
  expect(r.viewSource).toBe("GOOGLE_ANALYTICS");
});
test("sparse and mismatched metrics do not produce a misleading CTR or percentage from a zero baseline", () => {
  const r = articlePerformance(
    [
      row({ clicks: 2, impressions: 10 }),
      row({ date: new Date("2026-11-03T00:00:00Z"), impressions: 30 }),
      row({
        date: new Date("2026-10-29T00:00:00Z"),
        clicks: 0,
        impressions: 0,
      }),
    ],
    "2026-11-01",
  );
  expect(r.current.ctr).toBeNull();
  expect(r.current.daysReported).toBe(2);
  expect(r.changes.clicks).toEqual({ absolute: 2, percent: null });
});
test("only Blogger mobile variants normalize, preserving other query values and exact hosts", () => {
  expect(
    performanceUrl("https://fixture.blogspot.com/post.html?m=1#section"),
  ).toBe("https://fixture.blogspot.com/post.html");
  expect(
    performanceUrl("https://fixture.blogspot.com/post.html?m=0&lang=en"),
  ).toBe("https://fixture.blogspot.com/post.html?lang=en");
  expect(
    performanceUrl("https://fixture.blogspot.com/post.html?m=other"),
  ).toContain("?m=other");
  expect(
    performanceUrl("https://fixture.blogspot.com.evil.test/post.html?m=1"),
  ).toContain("?m=1");
  expect(performanceUrl("https://custom.example/post.html?m=1")).toContain(
    "?m=1",
  );
  expect(performanceUrl("javascript:alert(1)")).toBeNull();
  expect(
    performanceUrl("https://user:secret@fixture.blogspot.com/post.html"),
  ).toBeNull();
});
test("CSV neutralizes spreadsheet formulas in text, quotes line breaks and leaves unknowns blank", () => {
  expect(csvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
  expect(csvCell("\t+command")).toBe('"\'\t+command"');
  expect(csvCell('comma, "quote"\r\nline')).toBe('"comma, ""quote""\r\nline"');
  expect(csvCell(null)).toBe('""');
  expect(csvCell(0)).toBe('"0"');
  expect(csvCell(-2)).toBe('"-2"');
});
