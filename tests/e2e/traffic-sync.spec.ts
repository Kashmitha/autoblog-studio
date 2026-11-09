import { test, expect } from "@playwright/test";
test("daily traffic imports distinguish empty reads from failure and retain successful history", async ({
  page,
}) => {
  const site = "https://fixture.example/";
  let calls = 0;
  const configuration = {
    siteUrl: site,
    configured: true,
    readAccess: true,
    googleConnected: true,
    googleConfigured: true,
  };
  const empty = {
    id: "empty",
    siteUrl: site,
    trigger: "automatic",
    state: "EMPTY",
    startDate: "2026-09-11T00:00:00Z",
    endDate: "2026-11-05T00:00:00Z",
    startedAt: "2026-11-06T12:00:00Z",
    finishedAt: "2026-11-06T12:00:02Z",
    imported: 0,
    errorCode: null,
    errorMessage: null,
  };
  let attempt = { ...empty } as Record<string, unknown>;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "fixture@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({
        json: {
          bloggerMode: "live",
          google: { blogUrl: site },
          searchConsoleConfigured: true,
          searchConsoleReadAccess: true,
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
            impressions: null,
            clicks: null,
            ctr: null,
            viewSource: null,
            searchSource: null,
          },
        },
      });
    if (path === "/api/traffic/articles")
      return route.fulfill({
        json: {
          days: 28,
          current: { start: "2026-10-09", end: "2026-11-05" },
          previous: { start: "2026-09-11", end: "2026-10-08" },
          dateConvention: "Pacific dates",
          note: "No metrics fabricated",
          totalPublished: 0,
          truncated: false,
          articles: [],
        },
      });
    if (path === "/api/reports/search-console/status")
      return route.fulfill({
        json: {
          configuration,
          lastSuccess: empty,
          lastAttempt: attempt,
          history: attempt.state === "FAILED" ? [attempt, empty] : [empty],
          nextAutomaticSyncAt: "2026-11-07T12:00:02Z",
        },
      });
    if (path === "/api/reports/search-console/refresh-due") {
      calls++;
      if (calls > 1)
        attempt = {
          ...empty,
          id: "failed",
          state: "FAILED",
          startedAt: "2026-11-07T12:00:05Z",
          finishedAt: "2026-11-07T12:00:06Z",
          errorCode: "QUOTA",
          errorMessage: "Google quota reached. Saved reports are retained.",
        };
      return route.fulfill({
        json: {
          sync: attempt,
          imported: 0,
          skipped: calls === 1,
          note:
            calls === 1
              ? "Google returned no search rows."
              : "Google quota reached. Saved reports are retained.",
        },
      });
    }
    throw new Error("Unexpected traffic sync fixture: " + path);
  });
  await page.goto("/analytics");
  const panel = page.getByRole("region", {
    name: "Search traffic imports",
    exact: true,
  });
  await expect.poll(() => calls).toBe(1);
  await expect(
    panel
      .getByText("Connected · Google returned no rows", { exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    panel.getByText(
      "This confirms a successful read, not zero traffic or completed indexing.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    panel.locator("dd").filter({ hasText: "6 Nov 2026, 17:30" }),
  ).toHaveCount(2);
  await panel
    .getByRole("button", { name: "Sync search traffic when due" })
    .click();
  await expect(
    panel.getByText("Import failed", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    panel.getByText("Previous saved reports are retained.", { exact: false }),
  ).toBeVisible();
  await panel.getByText("Traffic import history (2)", { exact: true }).click();
  await expect(
    panel.getByText("Connected · Google returned no rows", { exact: true }),
  ).toBeVisible();
  expect(calls).toBe(2);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({
    path: ".local/screenshots/traffic-sync-history-fixture-mobile.png",
  });
});
