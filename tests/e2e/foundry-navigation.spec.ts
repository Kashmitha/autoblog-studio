import { test, expect } from "@playwright/test";

test("Sidebar links stay visible, support keyboard navigation and work in the mobile drawer", async ({
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
  await expect(nav.locator("summary")).toHaveCount(0);
  await expect(nav.getByRole("link")).toHaveCount(12);
  for (const link of await nav.getByRole("link").all())
    await expect(link).toBeVisible();
  const articles = nav.getByRole("link", { name: "Articles", exact: true });
  await articles.focus();
  await expect(articles).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(articles).toHaveAttribute("aria-current", "page");
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
    await document.fonts.load("600 46px Poppins");
    await document.fonts.load("400 15px Inter");
  });
  expect(
    await page.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Poppins");
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Inter");
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
