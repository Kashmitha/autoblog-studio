import { test, expect } from "@playwright/test";
test("article performance distinguishes zero from missing, switches periods, searches, sorts and targets the CSV export", async ({
  page,
}) => {
  const ranges: string[] = [];
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url()),
      path = u.pathname;
    const configuration = {
      configured: true,
      readAccess: true,
      siteUrl: "https://fixture.blogspot.com/",
      googleConnected: true,
      googleConfigured: true,
    };
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "performance-fixture@localhost", csrfToken: "fixture" },
      });
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
    if (path === "/api/integrations")
      return route.fulfill({
        json: {
          bloggerMode: "live",
          google: { blogUrl: configuration.siteUrl },
          searchConsoleConfigured: true,
          searchConsoleReadAccess: true,
          aiEnabled: false,
        },
      });
    if (
      path === "/api/blogger/sync" ||
      path === "/api/seo/indexing/refresh-due"
    )
      return route.fulfill({ json: { results: [], remaining: 0 } });
    if (path === "/api/seo/indexing")
      return route.fulfill({ json: { configuration, articles: [] } });
    if (path === "/api/dashboard")
      return route.fulfill({
        json: {
          traffic: {
            pageviews: null,
            clicks: null,
            impressions: null,
            ctr: null,
            viewSource: null,
            searchSource: null,
          },
        },
      });
    if (path === "/api/traffic/articles/export")
      return route.fulfill({
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition":
            'attachment; filename="article-performance-7-days.csv"',
        },
        body: "title,clicks\r\nFixture,0\r\n",
      });
    if (path === "/api/traffic/articles") {
      const days = Number(u.searchParams.get("days"));
      ranges.push(String(days));
      const empty = {
        pageviews: null,
        impressions: null,
        clicks: null,
        ctr: null,
        daysReported: 0,
        viewDaysReported: 0,
        searchDaysReported: 0,
        latestReportedDate: null,
      };
      return route.fulfill({
        json: {
          days,
          generatedAt: new Date().toISOString(),
          current: {
            start: days === 7 ? "2026-10-30" : "2026-10-09",
            end: "2026-11-05",
          },
          previous: { start: "2026-09-11", end: "2026-10-08" },
          dateConvention: "Reporting dates use Pacific Time.",
          note: "Missing metrics remain unknown.",
          totalPublished: 2,
          truncated: false,
          articles: [
            {
              articleId: "zero-fixture",
              title: "Zero clicks with real impressions",
              url: "https://fixture.blogspot.com/zero.html",
              publishedAt: "2026-10-30T00:00:00Z",
              current: {
                ...empty,
                clicks: 0,
                impressions: 20,
                ctr: 0,
                daysReported: 1,
                searchDaysReported: 1,
                latestReportedDate: "2026-11-05",
              },
              previous: {
                ...empty,
                clicks: 2,
                impressions: 30,
                daysReported: 1,
              },
              searchSource: "SEARCH_CONSOLE",
              viewSource: null,
              changes: {
                clicks: { absolute: -2, percent: -100 },
                impressions: null,
                pageviews: null,
              },
            },
            {
              articleId: "missing-fixture",
              title: "An article with no recorded metrics",
              url: "https://fixture.blogspot.com/missing.html",
              publishedAt: "2026-11-05T00:00:00Z",
              current: empty,
              previous: empty,
              searchSource: null,
              viewSource: null,
              changes: { clicks: null, impressions: null, pageviews: null },
            },
          ],
        },
      });
    }
    throw new Error("Unexpected performance fixture request: " + path);
  });
  await page.goto("/analytics");
  const panel = page.getByRole("region", {
    name: "Article performance",
    exact: true,
  });
  const rows = panel.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  const zero = rows.filter({ hasText: "Zero clicks with real impressions" });
  await expect(zero.locator("td").nth(3)).toContainText("0");
  await expect(zero.locator("td").nth(4)).toHaveText("0.00%");
  await expect(zero.locator("td").nth(1)).toContainText("—");
  await expect(
    rows.filter({ hasText: "An article with no recorded metrics" }),
  ).toContainText("No recorded traffic for this period.");
  await panel.getByLabel("Sort article performance").selectOption("title");
  await expect(rows.first()).toContainText(
    "An article with no recorded metrics",
  );
  await panel.getByLabel("Find a published article").fill("zero.html");
  await expect(rows).toHaveCount(1);
  await zero.getByText("Sources and coverage", { exact: true }).click();
  await expect(
    zero.getByText("Search: Google Search Console", { exact: false }),
  ).toBeVisible();
  await panel.getByLabel("Performance period").selectOption("7");
  await expect(
    panel.getByText("2026-10-30 to 2026-11-05", { exact: false }),
  ).toBeVisible();
  const exportLink = panel.getByRole("link", {
    name: "Export full report CSV",
    exact: true,
  });
  await expect(exportLink).toHaveAttribute(
    "href",
    "/api/traffic/articles/export?days=7",
  );
  // Native download requests bypass page.route in Edge. Check the mocked
  // response contract here; the actual-data browser check verifies the download.
  const exported = await page.evaluate(async () => {
    const response = await fetch("/api/traffic/articles/export?days=7");
    return {
      disposition: response.headers.get("content-disposition"),
      body: await response.text(),
    };
  });
  expect(exported.disposition).toContain("article-performance-7-days.csv");
  expect(exported.body).toContain("Fixture,0");
  await panel
    .getByRole("button", { name: "Refresh saved reports", exact: true })
    .click();
  await expect.poll(() => ranges.filter((r) => r === "7").length).toBe(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    panel
      .locator("tbody tr")
      .filter({ hasText: "Zero clicks with real impressions" })
      .locator('td[data-label="Search CTR"]'),
  ).toHaveText("0.00%");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({
    path: ".local/screenshots/article-performance-fixture-mobile.png",
  });
});
