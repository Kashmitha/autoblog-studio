import { test, expect, type Page } from "@playwright/test";
import type { WeeklyReviewData } from "../../frontend/src/components/weekly-review";

const summary: WeeklyReviewData = {
  generatedAt: "2026-11-13T02:00:00Z",
  window: {
    startDate: "2026-11-06",
    endDate: "2026-11-12",
    timezone: "Asia/Colombo",
  },
  publishing: {
    published: 3,
    needsReview: 1,
    approved: 2,
    pastSchedules: 1,
    paused: true,
    emergencyStop: false,
    scheduled: [
      {
        id: "remote",
        title: "Blogger-scheduled tutorial",
        scheduledAt: "2026-11-14T03:30:00Z",
        publishingTarget: "blogger",
        remoteStatus: "SCHEDULED",
      },
      {
        id: "local",
        title: "Local scheduled tutorial",
        scheduledAt: "2026-11-15T03:30:00Z",
        publishingTarget: "local",
        remoteStatus: null,
      },
    ],
  },
  search: {
    siteUrl: "https://example.blogspot.com/",
    lastAttempt: {
      state: "EMPTY",
      startDate: "2026-10-15",
      endDate: "2026-11-12",
      imported: 0,
      startedAt: "2026-11-12T12:00Z",
      finishedAt: "2026-11-12T12:01Z",
      errorCode: null,
    },
    lastSuccess: null,
  },
  adReport: {
    id: "ad",
    filename: "stats.csv",
    scopeLabel: "",
    timezoneLabel: "",
    savedAt: "2026-11-12T12:00Z",
    summary: {
      startDate: "2026-11-08",
      endDate: "2026-11-12",
      reportedDates: 3,
      impressions: 25,
      clicks: 0,
      revenue: 0,
    },
  },
  actions: [
    { label: "Review 1 draft", href: "/articles" },
    { label: "Review saved ad report results", href: "/monetization" },
  ],
};
const dashboard = {
  month: "2026-11",
  totalArticles: 0,
  counts: {},
  finance: {
    actualRevenue: 0,
    estimatedRevenue: 0,
    expenses: 0,
    aiCost: 0,
    netProfit: 0,
    rpm: null,
    breakEvenRevenue: 0,
  },
  traffic: {
    pageviews: null,
    clicks: null,
    impressions: null,
    ctr: null,
    viewSource: null,
    searchSource: null,
  },
  jobs: [],
  entries: [],
  daily: [],
  recentArticles: [],
  topArticles: [],
  hasFinancialRecords: false,
  publishingSuccessRate: null,
  monthOverMonth: null,
  goals: { initial: 1, stretch: 1, longTerm: 1, progress: 0 },
};

async function fixture(
  page: Page,
  mode: "empty" | "failed" | "missing" = "empty",
) {
  let reads = 0,
    failNext = false;
  const writes: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") writes.push(path);
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "weekly@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({ json: { bloggerMode: "mock", aiEnabled: false } });
    if (path === "/api/reminders") return route.fulfill({ json: [] });
    if (path === "/api/dashboard") return route.fulfill({ json: dashboard });
    if (path === "/api/seo/indexing")
      return route.fulfill({
        json: {
          configuration: { configured: false, readAccess: false },
          articles: [],
        },
      });
    if (path === "/api/dashboard/weekly-review") {
      reads++;
      if (failNext) {
        failNext = false;
        return route.fulfill({
          status: 503,
          json: { message: "Weekly test outage" },
        });
      }
      const value = structuredClone(summary);
      if (mode === "failed") {
        value.search.lastSuccess = value.search.lastAttempt;
        value.search.lastAttempt = {
          ...value.search.lastAttempt!,
          state: "FAILED",
          startedAt: "2026-11-13T01:00Z",
          finishedAt: null,
          errorCode: "QUOTA",
        };
      }
      if (mode === "missing") {
        value.search = { siteUrl: null, lastAttempt: null, lastSuccess: null };
        value.adReport = null;
      }
      return route.fulfill({ json: value });
    }
    if (path.includes("refresh-due") || path === "/api/blogger/sync")
      return route.fulfill({ json: { results: [], skipped: true } });
    return route.fulfill({
      status: 404,
      json: { message: "Unknown fixture path" },
    });
  });
  return {
    writes,
    failNextRead() {
      failNext = true;
    },
    get reads() {
      return reads;
    },
  };
}

test("weekly review preserves different source ranges, empty search evidence and schedules; refresh only reads saved data", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/");
  const panel = page.getByRole("region", {
    name: "Weekly review",
    exact: true,
  });
  await expect(
    panel.getByText("3 published during this window.", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Google returned no rows", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText(
      "A successful empty read does not confirm zero traffic or indexing.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    panel.getByText("Requested dates:", { exact: false }),
  ).toContainText("Pacific dates");
  await expect(
    panel.getByText("Report dates:", { exact: false }),
  ).toContainText("not the publishing week");
  await expect(
    panel.getByText("25 ad impressions", { exact: false }),
  ).toContainText("$0 exported revenue");
  await expect(
    panel.getByText("Blogger-held", { exact: false }).last(),
  ).toBeVisible();
  await expect(
    panel.getByText("Local worker; this computer must be running", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    panel.getByRole("link", { name: "Review 1 draft", exact: true }),
  ).toHaveAttribute("href", "/articles");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const before = state.writes.length;
  const readsBefore = state.reads;
  state.failNextRead();
  await panel
    .getByRole("button", { name: "Refresh summary", exact: true })
    .click();
  await expect(panel.getByRole("alert")).toContainText("Weekly test outage");
  await expect(
    panel.getByText("25 ad impressions", { exact: false }),
  ).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Refresh summary", exact: true })
    .click();
  await expect(
    panel.getByText("25 ad impressions", { exact: false }),
  ).toBeVisible();
  expect(state.writes.length).toBe(before);
  expect(state.reads).toBeGreaterThanOrEqual(readsBefore + 2);
});

test("failed imports retain older successful evidence rather than reporting zero", async ({
  page,
}) => {
  await fixture(page, "failed");
  await page.goto("/");
  const panel = page.getByRole("region", {
    name: "Weekly review",
    exact: true,
  });
  await expect(
    panel.getByText("Last import failed", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Previous successful read:", { exact: false }),
  ).toContainText("No rows returned");
  await expect(
    panel.getByText("Reason: QUOTA.", { exact: false }),
  ).toBeVisible();
});

test("missing sources remain unavailable without fabricated zero income or traffic", async ({
  page,
}) => {
  await fixture(page, "missing");
  await page.goto("/");
  const panel = page.getByRole("region", {
    name: "Weekly review",
    exact: true,
  });
  await expect(
    panel.getByText("No saved import for this property.", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText(
      "No saved ad report. Earnings are unavailable from this source.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    panel.getByText("$0 exported revenue", { exact: false }),
  ).toHaveCount(0);
});
