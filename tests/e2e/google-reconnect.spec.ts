import { test, expect } from "@playwright/test";

test("expired Google access explains recovery and reconnect starts consent without disconnecting or publishing", async ({
  page,
  baseURL,
}) => {
  let connects = 0;
  const unexpectedWrites: string[] = [];
  await page.route("**/api/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/api/auth/session")
      return route.fulfill({
        json: { email: "fixture@localhost", csrfToken: "fixture" },
      });
    if (p === "/api/integrations")
      return route.fulfill({
        json: {
          google: { blogId: "owned-blog", blogUrl: "https://fixture.example/" },
          googleConfigured: true,
          bloggerMode: "live",
        },
      });
    if (p === "/api/blogger/sync" || p.includes("refresh-due"))
      return route.fulfill({ json: { results: [], skipped: true } });
    if (p === "/api/integrations/google/test")
      return route.fulfill({
        status: 400,
        json: {
          message:
            "Google access has expired or been revoked. Open Blog connections and choose Reconnect Google, sign in with the same blog-owning account, then test the connection and retry scheduling. Your saved articles and approvals are kept.",
        },
      });
    if (p === "/api/integrations/google/connect") {
      connects++;
      return route.fulfill({
        json: { url: baseURL + "/connections?consent=fixture" },
      });
    }
    if (route.request().method() !== "GET") unexpectedWrites.push(p);
    return route.fulfill({
      status: 404,
      json: { message: "Fixture route not provided" },
    });
  });
  await page.goto("/connections");
  await page
    .getByRole("button", { name: "Test connection", exact: true })
    .click();
  await expect(
    page.getByText("Google access has expired or been revoked.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reconnect Google", exact: true })
    .click();
  await expect(page).toHaveURL(baseURL + "/connections?consent=fixture");
  expect(connects).toBe(1);
  expect(unexpectedWrites).toEqual([]);
});
