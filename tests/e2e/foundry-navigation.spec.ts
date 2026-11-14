import { test, expect } from "@playwright/test";

test("template navigation opens by keyboard, dismisses, reaches Studio tools and works on a narrow screen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "design@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({ json: { bloggerMode: "mock", aiEnabled: false } });
    if (path.includes("refresh-due") || path === "/api/blogger/sync")
      return route.fulfill({ json: { skipped: true, results: [] } });
    if (["/api/articles", "/api/reminders", "/api/media"].includes(path))
      return route.fulfill({ json: [] });
    return route.fulfill({
      status: 503,
      json: { message: "Reporting unavailable in design fixture" },
    });
  });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const workspace = nav.locator("summary").filter({ hasText: "Workspace" });
  await expect(workspace).toBeVisible();
  await workspace.focus();
  await page.keyboard.press("Enter");
  await expect(
    nav.getByRole("link", { name: "Articles", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    nav.getByRole("link", { name: "Articles", exact: true }),
  ).not.toBeVisible();
  await expect(workspace).toBeFocused();
  await workspace.click();
  await page.locator("h1").click();
  await expect(
    nav.getByRole("link", { name: "Articles", exact: true }),
  ).not.toBeVisible();
  await workspace.click();
  await nav.getByRole("link", { name: "Articles", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Articles", exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Publishing shortcuts" })
    .getByRole("link", { name: /Find a photograph/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Media library", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.load('500 60px "Grenze Gotisch"');
    await document.fonts.load("400 13px Poppins");
  });
  expect(
    await page.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Grenze Gotisch");
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Poppins");
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(nav).not.toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    nav.getByRole("link", { name: "Articles", exact: true }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Articles", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Articles", exact: true }),
  ).toBeVisible();
  await expect(nav).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Close navigation" }).click();
  await expect(nav).not.toBeVisible();
  expect(errors).toEqual([]);
});
