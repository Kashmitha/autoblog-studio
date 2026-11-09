import {
  indexVerdict,
  inspectionError,
  safeInspectionLink,
  urlInProperty,
  validSearchProperty,
  inspectionDue,
  indexingFollowUp,
} from "../src/domain/indexing";
import { SearchConsoleAdapter } from "../src/infrastructure/search-console.adapter";
import { searchconsole } from "googleapis/build/src/apis/searchconsole";
import { webmasters } from "googleapis/build/src/apis/webmasters";
import { GoogleService } from "../src/infrastructure/blogger.service";
import { ReportingService } from "../src/application/reporting.service";
jest.mock("googleapis/build/src/apis/searchconsole", () => ({
  searchconsole: jest.fn(),
}));
jest.mock("googleapis/build/src/apis/webmasters", () => ({
  webmasters: jest.fn(),
}));

test("automatic inspection cadence spaces results by 24 hours and failed reads by one hour", () => {
  const now = Date.now();
  expect(inspectionDue(null, now)).toBe(true);
  expect(
    inspectionDue(
      { state: "NOT_INDEXED", checkedAt: new Date(now - 23 * 3600000) },
      now,
    ),
  ).toBe(false);
  expect(
    inspectionDue(
      { state: "INDEXED", checkedAt: new Date(now - 24 * 3600000) },
      now,
    ),
  ).toBe(true);
  expect(
    inspectionDue({ state: "ERROR", checkedAt: new Date(now - 3599999) }, now),
  ).toBe(false);
  expect(
    inspectionDue({ state: "ERROR", checkedAt: new Date(now - 3600000) }, now),
  ).toBe(true);
});
const observation = {
  state: "NOT_INDEXED",
  coverageState: "Redirect error",
  pageFetchState: "REDIRECT_ERROR",
  indexingState: "INDEXING_STATE_UNSPECIFIED",
  lastCrawlTime: new Date("2026-11-05T10:31:39Z"),
};
test("repeated observations of the same failed crawl do not claim a new crawl failure", () => {
  const result = indexingFollowUp(true, null, observation, { ...observation });
  expect(result.category).toBe("attention");
  expect(result.sameCrawl).toBe(true);
  expect(result.action).toContain("not a new crawl failure");
  expect(
    indexingFollowUp(true, null, observation, {
      ...observation,
      lastCrawlTime: null,
    }).sameCrawl,
  ).toBe(false);
});
test("discovery is waiting, unspecified permissions are unknown and a live fetch does not prove indexing", () => {
  expect(
    indexingFollowUp(true, null, {
      ...observation,
      coverageState: "Discovered - currently not indexed",
      pageFetchState: "PAGE_FETCH_STATE_UNSPECIFIED",
      lastCrawlTime: null,
    }).category,
  ).toBe("waiting");
  expect(
    indexingFollowUp(true, null, {
      ...observation,
      coverageState: "Crawled - currently not indexed",
      pageFetchState: "SUCCESSFUL",
      indexingState: "INDEXING_ALLOWED",
    }).category,
  ).toBe("waiting");
  expect(
    indexingFollowUp(true, null, {
      ...observation,
      state: "UNKNOWN",
      pageFetchState: "SUCCESSFUL",
      coverageState: null,
      indexingState: "INDEXING_ALLOWED",
    }).category,
  ).not.toBe("indexed");
  expect(
    indexingFollowUp(true, null, { ...observation, state: "INDEXED" }).category,
  ).toBe("indexed");
  expect(indexingFollowUp(false, null, null).category).toBe("scheduled");
  expect(indexingFollowUp(true, "Select property", null).category).toBe(
    "setup",
  );
});

test.each([
  ["PASS", "INDEXED"],
  ["FAIL", "NOT_INDEXED"],
  ["NEUTRAL", "NOT_INDEXED"],
  ["PARTIAL", "UNKNOWN"],
  ["VERDICT_UNSPECIFIED", "UNKNOWN"],
  [undefined, "UNKNOWN"],
])(
  "uses Google's indexing verdict %s without treating a successful fetch or noindex permission as indexed",
  (input, output) => expect(indexVerdict(input)).toBe(output),
);

test.each([
  ["https://blog.example/posts/a", "https://blog.example/", true],
  ["https://blog.example/posts/a", "https://blog.example/posts/", true],
  ["https://blog.example/other", "https://blog.example/posts/", false],
  ["https://blog.example.evil.test/a", "https://blog.example/", false],
  ["https://evilblog.example/a", "https://blog.example/", false],
  ["https://child.blog.example/a", "sc-domain:blog.example", true],
  ["https://blog.example/a", "sc-domain:blog.example", true],
  ["https://evilblog.example/a", "sc-domain:blog.example", false],
  ["https://blog.example.evil.test/a", "sc-domain:blog.example", false],
  ["http://blog.example/a", "https://blog.example/", false],
  ["https://user:secret@blog.example/a", "https://blog.example/", false],
  ["https://blog.example:444/a", "https://blog.example/", false],
])(
  "binds URL %s to its actual verified property %s",
  (url, property, expected) =>
    expect(urlInProperty(url, property)).toBe(expected),
);

test("rejects malformed properties and untrusted report links", () => {
  expect(validSearchProperty("sc-domain:example.com/path")).toBe(false);
  expect(validSearchProperty("https://example.com/?key=secret")).toBe(false);
  expect(safeInspectionLink("javascript:alert(1)")).toBeNull();
  expect(
    safeInspectionLink("https://search.google.com.evil.test/search-console/"),
  ).toBeNull();
  expect(
    safeInspectionLink(
      "https://search.google.com/search-console/inspect?resource_id=test",
    ),
  ).toContain("search.google.com");
});

test.each([
  [401, "AUTH_REQUIRED"],
  [403, "ACCESS_DENIED"],
  [429, "QUOTA"],
  [503, "GOOGLE_UNAVAILABLE"],
])("sanitizes API failure %s", (status, code) => {
  const result = inspectionError({
    response: { status },
    message: "SECRET_ACCESS_TOKEN_must_not_be_displayed",
  });
  expect(result.errorCode).toBe(code);
  expect(result.errorMessage).not.toContain("SECRET");
});
test("distinguishes a disabled API from property denial", () =>
  expect(
    inspectionError({
      response: {
        status: 403,
        data: { error: { details: [{ reason: "SERVICE_DISABLED" }] } },
      },
    }).errorCode,
  ).toBe("API_DISABLED"));

test("uses only the official stored-index inspection endpoint with explicit property and bounded reads", async () => {
  const inspect = jest.fn().mockResolvedValue({
    data: { inspectionResult: { indexStatusResult: { verdict: "PASS" } } },
  });
  (searchconsole as jest.Mock).mockReturnValue({
    urlInspection: { index: { inspect } },
  });
  const adapter = new SearchConsoleAdapter({
    client: async () => ({}),
  } as unknown as GoogleService);
  await adapter.inspect("https://blog.example/post", "https://blog.example/");
  expect(inspect).toHaveBeenCalledWith(
    {
      requestBody: {
        inspectionUrl: "https://blog.example/post",
        siteUrl: "https://blog.example/",
        languageCode: "en-US",
      },
    },
    { timeout: 20000, retry: false },
  );
});
test("lists authorized Search Console properties without writing Google settings", async () => {
  const list = jest.fn().mockResolvedValue({
    data: {
      siteEntry: [
        { siteUrl: "https://blog.example/", permissionLevel: "siteOwner" },
      ],
    },
  });
  (webmasters as jest.Mock).mockReturnValue({ sites: { list } });
  const adapter = new SearchConsoleAdapter({
    client: async () => ({}),
  } as unknown as GoogleService);
  expect(await adapter.properties()).toHaveLength(1);
  expect(list).toHaveBeenCalledWith({}, { timeout: 20000, retry: false });
});

test("traffic imports use the selected verified property, preserve actual zeros and do not invent missing metrics", async () => {
  const query = jest.fn().mockResolvedValue({
    data: {
      rows: [
        {
          keys: ["2026-11-01", "https://blog.example/one"],
          impressions: 45,
          clicks: 2,
        },
        {
          keys: ["2026-11-01", "https://blog.example/two"],
          impressions: 0,
          clicks: 0,
        },
        { keys: ["2026-11-01", "https://blog.example/three"] },
        {
          keys: ["2026-11-01", "https://blog.example/four"],
          impressions: 12,
        },
      ],
    },
  });
  (webmasters as jest.Mock).mockReturnValue({ searchanalytics: { query } });
  const traffic = jest.fn().mockImplementation(async (rows) => rows.length);
  const service = new ReportingService(
    {
      client: async () => ({}),
      reportingPermissions: async () => ({ searchConsole: true }),
    } as never,
    { searchTraffic: traffic } as never,
    { property: async () => "https://blog.example/" } as never,
  );
  expect(
    (await service.searchConsole("2026-11-01", "2026-11-02")).imported,
  ).toBe(3);
  expect(query.mock.calls[0][0].siteUrl).toBe("https://blog.example/");
  expect(traffic.mock.calls[0][0][0]).toMatchObject({
    impressions: 45,
    clicks: 2,
  });
  expect(traffic.mock.calls[0][0][1]).toMatchObject({
    impressions: 0,
    clicks: 0,
  });
  expect(traffic.mock.calls[0][0][2].clicks).toBeUndefined();
});
test("a later Google page failure does not save an earlier partial report", async () => {
  const query = jest
    .fn()
    .mockResolvedValueOnce({
      data: {
        rows: Array.from({ length: 25000 }, () => ({
          keys: ["2026-11-01", "https://blog.example/post"],
          clicks: 1,
          impressions: 2,
        })),
      },
    })
    .mockRejectedValueOnce({ response: { status: 503 }, message: "SECRET" });
  (webmasters as jest.Mock).mockReturnValue({ searchanalytics: { query } });
  const searchTraffic = jest.fn();
  const service = new ReportingService(
    {
      client: async () => ({}),
      reportingPermissions: async () => ({ searchConsole: true }),
    } as never,
    { searchTraffic } as never,
    { property: async () => "https://blog.example/" } as never,
  );
  await expect(
    service.searchConsole("2026-11-01", "2026-11-02"),
  ).rejects.toThrow("Google could not return a result");
  expect(searchTraffic).not.toHaveBeenCalled();
});

test("traffic reporting requires separate read permission and sanitizes provider failures", async () => {
  const traffic = jest.fn();
  const permissions = jest.fn().mockResolvedValue({ searchConsole: false });
  const service = new ReportingService(
    { client: async () => ({}), reportingPermissions: permissions } as never,
    { traffic } as never,
    { property: async () => "https://blog.example/" } as never,
  );
  await expect(
    service.searchConsole("2026-11-01", "2026-11-02"),
  ).rejects.toThrow("read access");
  permissions.mockResolvedValue({ searchConsole: true });
  (webmasters as jest.Mock).mockReturnValue({
    searchanalytics: {
      query: jest.fn().mockRejectedValue({
        response: { status: 403 },
        message: "PRIVATE_TOKEN",
      }),
    },
  });
  await expect(
    service.searchConsole("2026-11-01", "2026-11-02"),
  ).rejects.toThrow("Google denied access");
  expect(traffic).not.toHaveBeenCalled();
});
