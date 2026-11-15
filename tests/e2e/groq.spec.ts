import { test, expect } from "@playwright/test";

test("Groq Free displays its own model, limits and non-generating connection test", async ({
  page,
}) => {
  let tests = 0;
  const writes: string[] = [];
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") writes.push(path);
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "fixture@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({
        json: {
          google: null,
          bloggerMode: "mock",
          aiEnabled: true,
          aiConfigured: true,
          aiProvider: "groq",
          aiFreePlan: true,
          aiModel: "openai/gpt-oss-20b",
          aiMonthlyLimit: 3,
          aiBlockers: [],
        },
      });
    if (path === "/api/integrations/ai/test") {
      tests++;
      return route.fulfill({
        json: {
          message:
            "API key and selected model are accessible. No text was generated.",
        },
      });
    }
    if (path === "/api/blogger/sync" || path.includes("refresh-due"))
      return route.fulfill({ json: { results: [], skipped: true } });
    if (path === "/api/seo/search-console")
      return route.fulfill({
        json: { configured: false, readAccess: false, googleConfigured: false },
      });
    return route.fulfill({ json: [] });
  });
  await page.goto("/connections");
  await expect(page.getByText("Groq", { exact: false }).first()).toBeVisible();
  await expect(
    page.getByText("$0 declared Free plan", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("openai/gpt-oss-20b", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open provider account" }),
  ).toHaveAttribute("href", "https://console.groq.com/keys");
  expect(tests).toBe(0);
  await page.getByRole("button", { name: "Test text provider" }).click();
  await expect(page.getByRole("status")).toContainText("No text was generated");
  expect(tests).toBe(1);
  expect(
    writes.some(
      (p) =>
        p.includes("generate") ||
        p.includes("publish") ||
        p === "/editorial/queue",
    ),
  ).toBe(false);
});
