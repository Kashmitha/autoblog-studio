import { test, expect, type Page } from "@playwright/test";
import {
  compareAdReports,
  type AdReportSnapshot,
} from "../../frontend/src/lib/ad-report-comparison";
import { parseAdsterraReport } from "../../frontend/src/lib/adsterra-report";

const header = "Date,Impressions,Clicks,CTR,CPM,Revenue\n";
const snapshot = (
  id: string,
  csv: string,
  scopeLabel = "",
  timezoneLabel = "",
): AdReportSnapshot => ({
  id,
  filename: id + ".csv",
  scopeLabel,
  timezoneLabel,
  createdAt: "2026-11-12T12:00:00Z",
  report: parseAdsterraReport(header + csv),
});
const previous = snapshot(
  "previous",
  "2026/11/05,40,0,0%,$0,$0\n2026/11/06,8,1,12.5%,$0.002,$0\n2026/11/08,1,0,0%,$0,$0\n2026/11/09,4,0,0%,$0.003,$0",
);
const current = snapshot(
  "current",
  "2026/11/08,1,0,0%,$0,$0\n2026/11/09,4,0,0%,$0.003,$0\n2026/11/12,20,0,0%,$0,$0",
);

test("different export coverage separates matching dates from dates missing in either file", () => {
  const result = compareAdReports(previous, current);
  expect(result.kind).toBe("unknown-scope");
  if (result.kind === "mismatch") throw new Error("Unexpected scope mismatch");
  expect(result.matchingPrevious).toMatchObject({
    dates: ["2026-11-08", "2026-11-09"],
    impressions: 5,
    clicks: 0,
    revenue: 0,
  });
  expect(result.matchingCurrent).toEqual(result.matchingPrevious);
  expect(result.onlyPrevious).toMatchObject({ impressions: 48, clicks: 1 });
  expect(result.onlyCurrent).toMatchObject({ impressions: 20, clicks: 0 });
  expect(
    result.rows.find((row) => row.date === "2026-11-05")?.current,
  ).toBeNull();
});

test("a genuine zero stays zero and a missing common period stays unavailable", () => {
  const zero = snapshot("zero", "2026/11/12,0,0,0%,$0,$0");
  const matching = compareAdReports(zero, zero);
  if (matching.kind === "mismatch") throw new Error("Unexpected mismatch");
  expect(matching.matchingCurrent?.impressions).toBe(0);
  expect(matching.onlyPrevious).toBeNull();
  const disjoint = compareAdReports(previous, zero);
  if (disjoint.kind === "mismatch") throw new Error("Unexpected mismatch");
  expect(disjoint.matchingPrevious).toBeNull();
  expect(disjoint.matchingCurrent).toBeNull();
  expect(disjoint.onlyCurrent?.impressions).toBe(0);
});

test("revised fractional revenue and clicks remain on their original shared dates", () => {
  const revised = snapshot("revised", "2026/11/09,8,1,12.5%,$0.003,$0.000004");
  const result = compareAdReports(previous, revised);
  if (result.kind === "mismatch") throw new Error("Unexpected mismatch");
  expect(result.matchingPrevious).toMatchObject({
    impressions: 4,
    clicks: 0,
    revenue: 0,
  });
  expect(result.matchingCurrent).toMatchObject({
    impressions: 8,
    clicks: 1,
    revenue: 0.000004,
  });
});

test("known conflicting metadata blocks numeric comparison while unknown labels remain unknown", () => {
  expect(
    compareAdReports(
      { ...previous, scopeLabel: "blog-a" },
      { ...current, scopeLabel: "blog-b" },
    ).kind,
  ).toBe("mismatch");
  expect(
    compareAdReports(
      { ...previous, timezoneLabel: "GMT+00:00" },
      { ...current, timezoneLabel: "GMT+05:30" },
    ).kind,
  ).toBe("mismatch");
  expect(
    compareAdReports(
      { ...previous, scopeLabel: " BLOG-A ", timezoneLabel: "UTC" },
      { ...current, scopeLabel: "blog-a", timezoneLabel: "utc" },
    ).kind,
  ).toBe("matching-labels");
  expect(
    compareAdReports(
      { ...previous, scopeLabel: "blog-a", timezoneLabel: "UTC" },
      current,
    ).kind,
  ).toBe("unknown-scope");
});

async function fixture(page: Page) {
  const reports: Record<string, AdReportSnapshot> = {
    previous,
    current,
    other: {
      ...current,
      id: "other",
      filename: "other.csv",
      scopeLabel: "Different domain",
      timezoneLabel: "UTC",
    },
    scoped: {
      ...previous,
      id: "scoped",
      filename: "scoped.csv",
      scopeLabel: "Original domain",
      timezoneLabel: "UTC",
    },
    broken: { ...current, id: "broken", filename: "broken.csv" },
  };
  const writes: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") writes.push(path);
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "comparison@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({ json: { bloggerMode: "mock", aiEnabled: false } });
    if (path === "/api/reminders") return route.fulfill({ json: [] });
    if (path === "/api/finance/ad-reports")
      return route.fulfill({
        json: Object.values(reports).map(({ report, ...summary }) => summary),
      });
    if (path.startsWith("/api/finance/ad-reports/")) {
      const id = path.split("/").at(-1)!;
      if (id === "broken")
        return route.fulfill({
          status: 503,
          json: { message: "Report temporarily unavailable" },
        });
      return route.fulfill({ json: reports[id] });
    }
    if (path.includes("refresh-due") || path === "/api/blogger/sync")
      return route.fulfill({ json: { results: [], skipped: true } });
    return route.fulfill({
      status: 503,
      json: { message: "Fixture ledger unavailable" },
    });
  });
  return writes;
}

test("comparison explains shorter exports, remains read-only, and clears results after errors or conflicting scopes", async ({
  page,
}) => {
  const writes = await fixture(page);
  await page.goto("/monetization");
  const panel = page.getByRole("region", {
    name: "Compare saved ad reports",
    exact: true,
  });
  await panel.getByLabel("Previous ad report").selectOption("previous");
  await panel.getByLabel("Current ad report").selectOption("current");
  await panel
    .getByRole("button", { name: "Compare reports", exact: true })
    .click();
  await expect(
    panel.getByText("a traffic trend cannot be confirmed", { exact: false }),
  ).toBeVisible();
  const table = panel.getByRole("table", {
    name: "Coverage comparison (reported USD revenue)",
  });
  await expect(table.getByRole("row").nth(1)).toHaveText(
    "Matching dates (2)5500$0$0",
  );
  await expect(table.getByRole("row").nth(2)).toContainText("48Not reported");
  await expect(table.getByRole("row").nth(3)).toContainText("Not reported20");
  await panel.getByText("Daily report differences", { exact: true }).click();
  await expect(
    panel
      .getByRole("table", { name: "Daily coverage and impressions" })
      .getByRole("row")
      .last(),
  ).toHaveText("2026-11-12Only in currentNot reported20");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.getByLabel("Current ad report").selectOption("previous");
  await expect(
    panel.getByRole("button", { name: "Compare reports", exact: true }),
  ).toBeDisabled();
  await expect(table).toHaveCount(0);
  await panel.getByLabel("Current ad report").selectOption("broken");
  await panel
    .getByRole("button", { name: "Compare reports", exact: true })
    .click();
  await expect(panel.getByRole("alert")).toContainText(
    "Report temporarily unavailable",
  );
  await expect(table).toHaveCount(0);
  await panel.getByLabel("Previous ad report").selectOption("scoped");
  await panel.getByLabel("Current ad report").selectOption("other");
  await panel
    .getByRole("button", { name: "Compare reports", exact: true })
    .click();
  await expect(
    panel.getByText("The recorded domain filters differ.", { exact: false }),
  ).toBeVisible();
  await expect(table).toHaveCount(0);
  expect(
    writes.filter(
      (path) => path.includes("finance") || path.includes("traffic"),
    ),
  ).toEqual([]);
});

test("a selection change prevents a delayed old comparison from reappearing", async ({
  page,
}) => {
  await fixture(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/api/finance/ad-reports/current", async (route) => {
    requested();
    await gate;
    await route.fulfill({ json: current });
  });
  await page.goto("/monetization");
  const panel = page.getByRole("region", {
    name: "Compare saved ad reports",
    exact: true,
  });
  await panel.getByLabel("Previous ad report").selectOption("previous");
  await panel.getByLabel("Current ad report").selectOption("current");
  await panel
    .getByRole("button", { name: "Compare reports", exact: true })
    .click();
  await started;
  await panel.getByLabel("Current ad report").selectOption("previous");
  const completed = page.waitForResponse((response) =>
    response.url().endsWith("/finance/ad-reports/current"),
  );
  release();
  await completed;
  await expect(
    panel.getByRole("button", { name: "Compare reports", exact: true }),
  ).toBeDisabled();
  await expect(panel.getByRole("table")).toHaveCount(0);
});
