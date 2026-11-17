import { test, expect, type Page } from "@playwright/test";
async function fixture(page: Page, readAccess = true) {
  let saves = 0,
    tests = 0,
    fail = false;
  const config = {
    propertyId: null as string | null,
    measurementId: null as string | null,
    blogUrl: "https://example.blogspot.com/",
    configured: false,
    readAccess,
    googleConnected: true,
    googleConfigured: true,
    propertyTimeZone: null as string | null,
    verifiedAt: null as string | null,
    revision: 0,
    destinationChanged: false,
    note: "Read access does not confirm collection.",
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "analytics@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({
        json: {
          googleConfigured: true,
          google: { blogId: "blog", blogUrl: config.blogUrl },
          bloggerMode: "mock",
          aiEnabled: false,
          analyticsConfigured: config.configured,
          analyticsReadAccess: config.readAccess,
        },
      });
    if (path === "/api/reminders") return route.fulfill({ json: [] });
    if (path.includes("refresh-due") || path === "/api/blogger/sync")
      return route.fulfill({ json: { skipped: true, results: [] } });
    if (path === "/api/integrations/analytics/configuration") {
      if (route.request().method() === "PATCH") {
        saves++;
        if (fail)
          return route.fulfill({
            status: 400,
            json: {
              message:
                "Enable Google Analytics Data API in the existing Google Cloud project used by Studio, then test again.",
            },
          });
        const data = route.request().postDataJSON();
        expect(data).toEqual({
          propertyId: "123456789",
          measurementId: "G-ABCDEF1234",
          revision: 0,
        });
        Object.assign(config, {
          propertyId: data.propertyId,
          measurementId: data.measurementId,
          revision: 1,
          configured: true,
          propertyTimeZone: "Asia/Colombo",
          verifiedAt: "2026-11-17T08:00:00Z",
        });
        return route.fulfill({
          json: {
            ...config,
            test: {
              readable: true,
              matchingReportRows: 0,
              message:
                "Read access succeeded. No rows returned; this does not prove zero traffic or working tracking.",
            },
          },
        });
      }
      return route.fulfill({ json: config });
    }
    if (path === "/api/integrations/analytics/test") {
      tests++;
      return route.fulfill({
        json: {
          readable: true,
          matchingReportRows: 0,
          message:
            "Read access succeeded. No rows returned; this does not prove zero traffic or working tracking.",
        },
      });
    }
    return route.fulfill({
      status: 503,
      json: { message: "Unavailable in Analytics fixture" },
    });
  });
  return {
    get saves() {
      return saves;
    },
    get tests() {
      return tests;
    },
    fail: () => {
      fail = true;
    },
  };
}
test("GA4 setup separates the IDs, saves after validation and tests access without changing publishing", async ({
  page,
}) => {
  const f = await fixture(page),
    writes: string[] = [];
  page.on("request", (r) => {
    if (["POST", "PATCH"].includes(r.method()))
      writes.push(new URL(r.url()).pathname);
  });
  await page.goto("/connections");
  const panel = page.getByRole("region", {
    name: "Google Analytics connection",
    exact: true,
  });
  await panel.getByLabel("GA4 Property ID").fill("G-ABCDEF1234");
  await panel.getByLabel("Blogger Measurement ID").fill("G-ABCDEF1234");
  await panel
    .getByRole("button", { name: "Save Analytics configuration" })
    .click();
  expect(f.saves).toBe(0);
  await panel.getByLabel("GA4 Property ID").fill("123456789");
  await panel
    .getByRole("button", { name: "Save Analytics configuration" })
    .click();
  await expect(panel.getByText(/Selected property:/)).toBeVisible();
  await expect(panel.getByText(/does not prove zero traffic/)).toBeVisible();
  expect(f.saves).toBe(1);
  await panel
    .getByRole("button", { name: "Test Analytics read access" })
    .click();
  await expect.poll(() => f.tests).toBe(1);
  expect(
    writes.filter(
      (p) => !p.endsWith("refresh-due") && p !== "/api/blogger/sync",
    ),
  ).toEqual([
    "/api/integrations/analytics/configuration",
    "/api/integrations/analytics/test",
  ]);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("missing Analytics consent explains setup and prevents saving", async ({
  page,
}) => {
  const f = await fixture(page, false);
  await page.goto("/connections");
  const panel = page.getByRole("region", {
    name: "Google Analytics connection",
    exact: true,
  });
  await expect(
    panel.getByRole("button", {
      name: "Authorize Google Analytics read access",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    panel.getByRole("button", { name: "Save Analytics configuration" }),
  ).toBeDisabled();
  expect(f.saves).toBe(0);
  await expect(
    panel.getByText(/collects visits; Studio reads the reports/),
  ).toBeVisible();
});
test("API enablement failures retain entered identifiers and show a recoverable explanation", async ({
  page,
}) => {
  const f = await fixture(page);
  f.fail();
  await page.goto("/connections");
  const panel = page.getByRole("region", {
    name: "Google Analytics connection",
    exact: true,
  });
  await panel.getByLabel("GA4 Property ID").fill("123456789");
  await panel.getByLabel("Blogger Measurement ID").fill("G-ABCDEF1234");
  await panel
    .getByRole("button", { name: "Save Analytics configuration" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Enable Google Analytics Data API",
  );
  await expect(panel.getByLabel("GA4 Property ID")).toHaveValue("123456789");
  await expect(
    panel.getByRole("button", { name: "Test Analytics read access" }),
  ).toHaveCount(0);
});
