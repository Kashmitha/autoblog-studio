import { test, expect, type Page } from "@playwright/test";

async function installFixture(page: Page, configured = true) {
  const site = "https://fixture.example/",
    id = "indexed-ui-fixture";
  let configuration = {
    siteUrl: configured ? site : (null as string | null),
    configured,
    readAccess: true,
    googleConnected: true,
    googleConfigured: true,
  };
  let refreshes = 0,
    automaticChecks = 0,
    diagnosticChecks = 0;
  const article = {
    id,
    title: "Published indexing interface fixture",
    slug: "fixture",
    niche: "Git & GitHub",
    intent: "Interface verification",
    excerpt: "An isolated browser fixture.",
    html: "<h2>Fixture content</h2><p>No real Google requests.</p>",
    labels: ["Git"],
    status: "PUBLISHED",
    version: 1,
    aiAssisted: true,
    disclosure: false,
    updatedAt: new Date().toISOString(),
    publishingTarget: "blogger",
    remoteStatus: "LIVE",
    remotePostId: "456",
    remoteBlogId: "123",
    publishedUrl: site + "post",
    sources: [],
    media: [],
    events: [],
    reports: [],
  };
  let latest = {
    id: "old-redirect",
    state: "NOT_INDEXED",
    verdict: "FAIL",
    coverageState: "Redirect error",
    checkedAt: "2026-11-05T11:00:00.000Z",
    lastCrawlTime: "2026-11-04T15:49:13.000Z" as string | null,
    pageFetchState: "REDIRECT_ERROR",
    indexingState: "INDEXING_STATE_UNSPECIFIED" as string | null,
    robotsTxtState: "ALLOWED",
    crawledAs: "MOBILE",
    googleCanonical: null as string | null,
    userCanonical: site + "post",
    inspectionResultLink:
      "https://search.google.com/search-console/inspect?fixture=true",
    errorCode: null as string | null,
    errorMessage: null as string | null,
  };
  let lastAttempt = { ...latest },
    history = [{ ...latest }];
  const report = () => ({
    articleId: id,
    title: article.title,
    publishingStatus: "PUBLISHED",
    url: article.publishedUrl,
    eligible: true,
    canInspect: configuration.configured,
    blockedReason: configuration.configured
      ? null
      : "Select your verified Search Console property in Blog connections.",
    configuration,
    latest: configuration.configured ? latest : null,
    lastAttempt: configuration.configured ? lastAttempt : null,
    history: configuration.configured ? history : [],
    followUp: {
      category: latest.state === "INDEXED" ? "indexed" : "attention",
      title:
        latest.state === "INDEXED"
          ? "Indexing confirmed"
          : "Investigate the recorded redirect error",
      action:
        latest.state === "INDEXED"
          ? "Google reports this URL indexed."
          : "Open Search Console for this URL and compare the live test with the recorded crawl.",
      sameCrawl: false,
    },
    nextAutomaticCheckAt: "2026-11-06T11:00:00Z",
  });
  const diagnosticResult = {
    outcome: "NO_ISSUE_REPRODUCED",
    checkedAt: "2026-11-06T14:00:00Z",
    url: article.publishedUrl,
    scriptsExecuted: false,
    limitation:
      "These are Studio HTTP requests, not Googlebot. A successful fetch does not confirm indexing.",
    profiles: [
      {
        name: "Desktop",
        finalUrl: article.publishedUrl,
        status: 200,
        error: null,
        findings: [],
        hops: [{ url: article.publishedUrl, status: 200, location: null }],
        metadata: {
          canonicals: [article.publishedUrl],
          robots: [],
          metaRefresh: [],
          refreshHeader: null,
          noindex: false,
        },
      },
      {
        name: "Mobile",
        finalUrl: article.publishedUrl + "?m=1",
        status: 200,
        error: null,
        findings: [],
        hops: [
          {
            url: article.publishedUrl,
            status: 302,
            location: article.publishedUrl + "?m=1",
          },
          { url: article.publishedUrl + "?m=1", status: 200, location: null },
        ],
        metadata: {
          canonicals: [article.publishedUrl],
          robots: [],
          metaRefresh: [],
          refreshHeader: null,
          noindex: false,
        },
      },
    ],
  };
  let diagnosticRun: {
    id: string;
    state: string;
    startedAt: string;
    finishedAt: string;
    errorMessage: null;
    result: typeof diagnosticResult;
  } | null = null;
  const diagnosticReport = () => ({
    article: { id, title: article.title, publishedUrl: article.publishedUrl },
    eligible: true,
    canCheck: true,
    blockedReason: null,
    latest: diagnosticRun,
    history: diagnosticRun ? [diagnosticRun] : [],
    google: {
      state: latest.state,
      coverageState: latest.coverageState,
      lastCrawlTime: latest.lastCrawlTime,
      checkedAt: latest.checkedAt,
      inspectionResultLink: latest.inspectionResultLink,
    },
    nextCheckAt: null,
  });
  const dashboard = {
    month: "2026-11",
    totalArticles: 2,
    counts: { PUBLISHED: 1, SCHEDULED: 1 },
    finance: {
      actualRevenue: 0,
      estimatedRevenue: 0,
      expenses: 0,
      aiCost: 0,
      netProfit: 0,
      rpm: null,
      breakEvenRevenue: 0,
      currency: "USD",
      source: "No records",
    },
    traffic: {
      pageviews: null,
      impressions: null,
      clicks: null,
      ctr: null,
      viewSource: null,
      searchSource: null,
    },
    daily: [],
    recentArticles: [],
    entries: [],
    jobs: [],
    hasFinancialRecords: false,
    publishingSuccessRate: null,
    monthOverMonth: null,
    goals: { initial: 1, stretch: 1, longTerm: 1, progress: 0 },
    topArticles: [],
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: {
          email: "fixture@localhost",
          csrfToken: "fixture-no-real-session",
        },
      });
    if (path === "/api/integrations")
      return route.fulfill({
        json: {
          bloggerMode: "live",
          google: {
            blogId: "123",
            blogUrl: site,
            accountLabel: "Fixture account",
            liveTestSucceededAt: "2026-01-01T00:00:00Z",
          },
          googleConfigured: true,
          aiEnabled: false,
          aiConfigured: false,
          aiModel: "fixture",
          aiMonthlyLimit: 3,
          searchConsoleConfigured: configuration.configured,
          searchConsoleReadAccess: true,
        },
      });
    if (path === "/api/blogger/sync")
      return route.fulfill({ json: { results: [] } });
    if (path === "/api/reports/search-console/refresh-due")
      return route.fulfill({
        json: { skipped: true, sync: null, imported: 0 },
      });
    if (path === "/api/reports/search-console/status")
      return route.fulfill({
        json: {
          configuration,
          history: [],
          lastSuccess: null,
          lastAttempt: null,
          nextAutomaticSyncAt: null,
        },
      });
    if (path === "/api/seo/indexing/refresh-due") {
      automaticChecks++;
      return route.fulfill({
        status: 201,
        json: { results: [], remaining: 0 },
      });
    }
    if (path === "/api/reminders") return route.fulfill({ json: [] });
    if (path === "/api/media") return route.fulfill({ json: [] });
    if (path === "/api/articles/" + id) return route.fulfill({ json: article });
    if (path === "/api/dashboard") return route.fulfill({ json: dashboard });
    if (path === "/api/traffic/articles")
      return route.fulfill({
        json: {
          days: Number(
            new URL(route.request().url()).searchParams.get("days") || 28,
          ),
          current: { start: "2026-10-09", end: "2026-11-05" },
          previous: { start: "2026-09-11", end: "2026-10-08" },
          dateConvention: "Dates use source labels.",
          note: "No simulated metrics are saved.",
          totalPublished: 0,
          truncated: false,
          articles: [],
        },
      });
    if (path === "/api/seo/articles/" + id + "/indexing")
      return route.fulfill({ json: report() });
    if (path === "/api/seo/articles/" + id + "/fetch-diagnostics")
      return route.fulfill({ json: diagnosticReport() });
    if (path === "/api/seo/articles/" + id + "/fetch-diagnostics/run") {
      diagnosticChecks++;
      diagnosticRun = {
        id: "trace-fixture",
        state: "COMPLETED",
        startedAt: "2026-11-06T14:00:00Z",
        finishedAt: "2026-11-06T14:00:02Z",
        errorMessage: null,
        result: diagnosticResult,
      };
      return route.fulfill({
        status: 201,
        json: { ...diagnosticReport(), cached: diagnosticChecks > 1 },
      });
    }
    if (path === "/api/seo/articles/" + id + "/fetch-diagnostics/export")
      return route.fulfill({
        json: diagnosticReport(),
        headers: {
          "Content-Disposition":
            'attachment; filename="article-fetch-diagnostics.json"',
        },
      });
    if (path === "/api/seo/articles/" + id + "/inspect") {
      refreshes++;
      if (refreshes === 1) {
        latest = {
          ...latest,
          id: "new-indexed",
          state: "INDEXED",
          verdict: "PASS",
          coverageState: "Submitted and indexed",
          checkedAt: "2026-11-05T12:00:00.000Z",
          lastCrawlTime: "2026-11-05T11:30:00.000Z",
          pageFetchState: "SUCCESSFUL",
          indexingState: "INDEXING_ALLOWED",
          googleCanonical: article.publishedUrl,
        };
        lastAttempt = { ...latest };
      } else
        lastAttempt = {
          ...latest,
          id: "failed-check",
          state: "ERROR",
          errorCode: "QUOTA",
          errorMessage:
            "Google's inspection quota was reached. Your previous result is retained.",
          checkedAt: "2026-11-05T12:01:00.000Z",
          lastCrawlTime: null,
        };
      history = [{ ...lastAttempt }, ...history];
      return route.fulfill({
        status: 201,
        json: { ...report(), cached: false },
      });
    }
    if (path === "/api/seo/search-console")
      return route.fulfill({ json: configuration });
    if (path === "/api/seo/search-console/properties")
      return route.fulfill({
        json: [{ siteUrl: site, permissionLevel: "siteOwner" }],
      });
    if (path === "/api/seo/search-console/property") {
      expect(route.request().postDataJSON()).toEqual({ siteUrl: site });
      configuration = { ...configuration, siteUrl: site, configured: true };
      return route.fulfill({ status: 201, json: configuration });
    }
    if (path === "/api/seo/indexing")
      return route.fulfill({
        json: {
          configuration,
          articles: [
            report(),
            {
              ...report(),
              articleId: "discovered-ui-fixture",
              title: "Another published article awaiting Google's crawl",
              url: site + "second-post",
              latest: {
                ...latest,
                id: "discovered",
                state: "NOT_INDEXED",
                coverageState: "Discovered - currently not indexed",
                pageFetchState: "PAGE_FETCH_STATE_UNSPECIFIED",
                lastCrawlTime: null,
              },
              followUp: {
                category: "waiting",
                title: "Waiting for Google's crawl",
                action:
                  "Google has discovered this URL but reports no completed crawl yet.",
                sameCrawl: false,
              },
            },
            {
              ...report(),
              articleId: "future-ui-fixture",
              title: "Future scheduled article fixture",
              publishingStatus: "SCHEDULED",
              eligible: false,
              canInspect: false,
              blockedReason: "Check after publication.",
              latest: null,
              lastAttempt: null,
              history: [],
            },
          ],
        },
      });
    throw new Error("Unexpected indexing fixture request: " + path);
  });
  return {
    id,
    get refreshes() {
      return refreshes;
    },
    get automaticChecks() {
      return automaticChecks;
    },
    get diagnosticChecks() {
      return diagnosticChecks;
    },
  };
}

test("indexing reports distinguish old crawls from new checks and retain the last result after a failed refresh", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = await installFixture(page);
  await page.goto("/articles/" + fixture.id);
  const panel = page.getByRole("region", {
    name: "Google indexing",
    exact: true,
  });
  await expect(panel.getByText("not indexed", { exact: true })).toBeVisible();
  await expect(
    panel.locator("dd").filter({ hasText: "4 Nov 2026, 21:19" }),
  ).toBeVisible();
  await expect(
    panel.locator("dd").filter({ hasText: "5 Nov 2026, 16:30" }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Refresh indexing status" }).click();
  await expect(panel.getByText("indexed", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Refresh indexing status" }).click();
  await expect(
    panel.getByText(/The last confirmed result below is retained/),
  ).toBeVisible();
  await expect(panel.getByText("indexed", { exact: true })).toBeVisible();
  expect(fixture.refreshes).toBe(2);
  await panel.getByText("Inspection history (3)").click();
  await expect(
    panel.getByText("Redirect error", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({
    path: ".local/screenshots/indexing-history-fixture-mobile.png",
    animations: "disabled",
  });
});

test("live fetch diagnostics show the redirect chain while preserving Google’s separate failed crawl", async ({
  page,
}) => {
  const fixture = await installFixture(page);
  await page.goto("/articles/" + fixture.id);
  const diagnostics = page.getByRole("region", {
    name: "Live fetch diagnostics",
    exact: true,
  });
  await expect(
    diagnostics.getByRole("button", {
      name: "Check live redirects",
      exact: true,
    }),
  ).toBeVisible();
  expect(fixture.diagnosticChecks).toBe(0);
  await diagnostics
    .getByRole("button", { name: "Check live redirects", exact: true })
    .click();
  await expect(
    diagnostics.getByText("No issue reproduced in these requests", {
      exact: true,
    }),
  ).toBeVisible();
  const google = page.getByRole("region", {
    name: "Google indexing",
    exact: true,
  });
  await expect(google.getByText("not indexed", { exact: true })).toBeVisible();
  expect(fixture.refreshes).toBe(0);
  await diagnostics
    .locator("summary")
    .filter({ hasText: "Mobile · HTTP 200" })
    .click();
  await expect(
    diagnostics.getByText("HTTP 302", { exact: true }),
  ).toBeVisible();
  await expect(
    diagnostics
      .locator("details[open]")
      .getByText("Not detected in fetched HTML/headers", {
        exact: true,
      }),
  ).toBeVisible();
  await expect(
    diagnostics.getByRole("link", { name: "Download diagnostic report" }),
  ).toHaveAttribute(
    "href",
    "/api/seo/articles/" + fixture.id + "/fetch-diagnostics/export",
  );
  await diagnostics
    .getByRole("button", { name: "Check live redirects", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Recent diagnostic reused",
  );
  expect(fixture.diagnosticChecks).toBe(2);
  expect(fixture.refreshes).toBe(0);
  await diagnostics
    .getByText("Next step in Google Search Console", { exact: true })
    .click();
  await expect(
    diagnostics.getByText("TEST LIVE URL", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await diagnostics.screenshot({
    path: ".local/screenshots/fetch-diagnostics-fixture-mobile.png",
  });
});

test("daily follow-up identifies exact posts, filters waiting versus access issues and never requests indexing", async ({
  page,
}) => {
  const fixture = await installFixture(page);
  await page.goto("/");
  const panel = page.getByRole("region", {
    name: "Publishing follow-up",
    exact: true,
  });
  await expect(
    panel.getByRole("heading", { name: "Publishing follow-up", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Published indexing interface fixture", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("link", {
      name: "https://fixture.example/post",
      exact: false,
    }),
  ).toBeVisible();
  await expect.poll(() => fixture.automaticChecks).toBe(1);
  expect(fixture.refreshes).toBe(0);
  await page.goto("/analytics");
  const overview = page.getByRole("region", {
    name: "Publishing follow-up",
    exact: true,
  });
  await overview.getByLabel("Show indexing reports").selectOption("waiting");
  await expect(overview.locator(".indexing-row")).toHaveCount(1);
  await expect(
    overview.getByText("Another published article awaiting Google's crawl", {
      exact: true,
    }),
  ).toBeVisible();
  await overview.getByLabel("Show indexing reports").selectOption("attention");
  await expect(overview.locator(".indexing-row")).toHaveCount(1);
  await expect(
    overview.getByText("Investigate the recorded redirect error", {
      exact: true,
    }),
  ).toBeVisible();
  await overview
    .getByRole("button", { name: "Check reports due", exact: true })
    .click();
  await expect.poll(() => fixture.automaticChecks).toBe(3);
  expect(fixture.refreshes).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/screenshots/daily-follow-up-fixture-mobile.png",
    fullPage: true,
  });
});

test("verified property selection connects the traffic view while future posts remain ineligible for inspection", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installFixture(page, false);
  await page.goto("/connections");
  const connection = page.getByRole("region", {
    name: "Search Console connection",
    exact: true,
  });
  await expect(
    connection.getByText("Not selected", { exact: true }),
  ).toBeVisible();
  await connection
    .getByRole("button", { name: "Load verified properties" })
    .click();
  await expect(
    connection.getByLabel("Verified Search Console property"),
  ).toHaveValue("https://fixture.example/");
  await connection.getByRole("button", { name: "Use this property" }).click();
  await expect(
    connection.getByText("configured", { exact: true }),
  ).toBeVisible();
  await page.goto("/analytics");
  const row = page
    .locator(".indexing-row")
    .filter({ hasText: "Future scheduled article fixture" });
  await expect(row.getByText("scheduled", { exact: true })).toBeVisible();
  await expect(row.getByText("not published", { exact: true })).toBeVisible();
  await expect(
    row.getByRole("button", { name: "Check indexing" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Search Console", exact: true }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/screenshots/indexing-traffic-fixture-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
