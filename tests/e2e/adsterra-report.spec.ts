import { test, expect } from "@playwright/test";
import {
  parseAdsterraReport,
  adReportMoney,
} from "../../frontend/src/lib/adsterra-report";

const header = "Date,Impressions,Clicks,CTR,CPM,Revenue\r\n";
const sample =
  header +
  "2026/11/09,4,0,0%,$0.003,$0\r\n2026/11/08,1,0,0%,$0,$0\r\n2026/11/06,8,1,12.5%,$0.002,$0\r\n2026/11/05,40,0,0%,$0,$0\r\n";

test("native report totals reconcile and retain zero rather than inferring earnings from rounded CPM", () => {
  const report = parseAdsterraReport(sample);
  expect(report).toMatchObject({ impressions: 53, clicks: 1, revenue: 0 });
  expect(report.ctr).toBeCloseTo(100 / 53);
  expect(report.rows[0].date).toBe("2026-11-05");
  expect(report.rows.at(-1)?.cpm).toBe(0.003);
});

test("quoted numbers, BOM, missing dates and fractional revenue survive parsing", () => {
  const report = parseAdsterraReport(
    "\uFEFF" + header + '2026/11/09,"1,234",1,0.081%,$0.003,$0.000004',
  );
  expect(report.impressions).toBe(1234);
  expect(adReportMoney(report.revenue)).toBe("$0.000004");
  expect(adReportMoney(0)).toBe("$0");
  expect(
    parseAdsterraReport(header + "2026/11/09,0,0,0%,$0,$0").ctr,
  ).toBeNull();
});

test("malformed, duplicate and non-daily reports reject rather than double count", () => {
  for (const text of [
    header,
    sample + "2026/11/09,4,0,0%,$0.003,$0",
    header + "2026/02/30,4,0,0%,$0,$0",
    header + "2026/11/09,1,2,200%,$0,$0",
    header + "2026/11/09,1.5,0,0%,$0,$0",
    header + "2026/11/09,4,0,0%,$0,",
    header + '2026/11/09,"4,0,0%,$0,$0',
    header + '2026/11/09,"4"bad,0,0%,$0,$0',
    header + "Total,4,0,0%,$0,$0",
    header.replace("Date", "Domain") + "example.com,4,0,0%,$0,$0",
    "x".repeat(1_000_001),
  ])
    expect(() => parseAdsterraReport(text)).toThrow();
});

test("monetization previews reports without ledger writes and clears stale results on invalid input", async ({
  page,
}) => {
  const writes: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") writes.push(path);
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "report@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({ json: { bloggerMode: "mock", aiEnabled: false } });
    if (path === "/api/reminders") return route.fulfill({ json: [] });
    if (path.includes("refresh-due"))
      return route.fulfill({ json: { results: [], skipped: true } });
    if (path === "/api/blogger/sync")
      return route.fulfill({ json: { results: [] } });
    return route.fulfill({
      status: 503,
      json: { message: "Fixture: ledger unavailable" },
    });
  });
  await page.goto("/monetization");
  const panel = page.getByRole("region", { name: "Adsterra report preview" });
  await panel.getByLabel("Adsterra CSV report").setInputFiles({
    name: "stats.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(sample),
  });
  await expect(panel.getByRole("row").last()).toContainText("53");
  await expect(
    panel.getByText("Every revenue row exports $0.", { exact: false }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.getByLabel("Adsterra CSV report").setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(header + "2026/11/09,4,0,0%,$0,"),
  });
  await expect(panel.getByRole("alert")).toContainText("Invalid or duplicate");
  await expect(panel.getByRole("table")).toHaveCount(0);
  expect(
    writes.filter(
      (path) => path.includes("finance") || path.includes("traffic"),
    ),
  ).toEqual([]);
});

test("saved report can be reopened after refresh without reuploading", async ({
  page,
}) => {
  let saved = false;
  let saves = 0;
  const snapshot = {
    id: "saved-report",
    filename: "stats.csv",
    scopeLabel: "All Domains",
    timezoneLabel: "GMT+00:00",
    createdAt: "2026-11-09T12:00:00Z",
    report: parseAdsterraReport(sample),
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "report@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({ json: { bloggerMode: "mock", aiEnabled: false } });
    if (path === "/api/reminders") return route.fulfill({ json: [] });
    if (
      path === "/api/finance/ad-reports" &&
      route.request().method() === "POST"
    ) {
      expect(route.request().headers()["content-type"]).toContain(
        "multipart/form-data",
      );
      expect(route.request().postData()).toContain("GMT+00:00");
      saved = true;
      saves++;
      return route.fulfill({ status: 201, json: snapshot });
    }
    if (path === "/api/finance/ad-reports")
      return route.fulfill({ json: saved ? [snapshot] : [] });
    if (path === "/api/finance/ad-reports/saved-report")
      return route.fulfill({ json: snapshot });
    if (path.includes("refresh-due") || path === "/api/blogger/sync")
      return route.fulfill({ json: { results: [], skipped: true } });
    return route.fulfill({
      status: 503,
      json: { message: "Fixture: ledger unavailable" },
    });
  });
  await page.goto("/monetization");
  const panel = page.getByRole("region", { name: "Adsterra report preview" });
  await panel
    .getByLabel("Adsterra CSV report")
    .setInputFiles({
      name: "stats.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(sample),
    });
  await panel
    .getByLabel("Domain filter used in Adsterra (optional)")
    .fill("All Domains");
  await panel.getByLabel("Report timezone (optional)").fill("GMT+00:00");
  await panel
    .getByRole("button", { name: "Save ad report", exact: true })
    .click();
  await expect(panel.getByRole("status")).toContainText("Report saved");
  await page.reload();
  await panel
    .getByLabel("Saved Adsterra reports (latest 30)")
    .selectOption("saved-report");
  await expect(panel.getByRole("row").last()).toContainText("53");
  await expect(
    panel.getByText("Recorded domain filter:", { exact: false }),
  ).toContainText("GMT+00:00");
  await expect(
    panel.getByRole("button", { name: "Save ad report", exact: true }),
  ).toHaveCount(0);
  expect(saves).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
