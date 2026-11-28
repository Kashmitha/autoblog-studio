import { test, expect } from "@playwright/test";

test("blog discovery renders a selectable blog and a useful genuine-empty state", async ({
  page,
}) => {
  await page.route("**/api/reports/search-console/refresh-due", (route) =>
    route.fulfill({ json: { skipped: true, sync: null, imported: 0 } }),
  );
  await page.route("**/api/seo/indexing/refresh-due", (route) =>
    route.fulfill({ status: 201, json: { results: [], remaining: 0 } }),
  );
  let reconnectRequired = true;
  let testFails = false;
  let blogs: { id: string; name: string; url: string }[] = [
    {
      id: "fixture-blog",
      name: "Fixture owned blog",
      url: "https://fixture.example/",
    },
  ];
  await page.route("**/api/blogger/sync", (route) =>
    route.fulfill({ json: { results: [] } }),
  );
  await page.route("**/api/seo/search-console", (route) =>
    route.fulfill({
      json: {
        siteUrl: null,
        configured: false,
        readAccess: false,
        googleConnected: true,
        googleConfigured: true,
      },
    }),
  );
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      json: {
        email: "fixture@localhost",
        csrfToken: "fixture-only-no-real-session",
      },
    }),
  );
  await page.route("**/api/integrations", (route) =>
    route.fulfill({
      json: {
        google: {
          accountLabel: "Fixture Google account",
          blogId: null,
          blogUrl: null,
        },
        googleAuthorization: {
          reconnectRequired,
          checkedAt: new Date().toISOString(),
        },
        bloggerMode: "mock",
        aiEnabled: false,
        aiConfigured: false,
        aiModel: "fixture-model",
        aiMonthlyLimit: 3,
        googleConfigured: true,
        unsplashConfigured: false,
        searchConsoleConfigured: false,
        analyticsConfigured: false,
        adsterraConfigured: false,
      },
    }),
  );
  await page.route("**/api/integrations/google/blogs", (route) =>
    route.fulfill({ json: blogs }),
  );
  await page.route("**/api/integrations/google/test", (route) =>
    route.fulfill(
      testFails
        ? {
            status: 400,
            json: { message: "Google access has expired or been revoked." },
          }
        : { json: { ok: true, ownedBlogs: blogs.length } },
    ),
  );
  await page.goto("/connections?oauth=denied");
  await expect(
    page.getByText("reconnect required", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Google authorization was not completed/),
  ).toBeVisible();
  await expect(
    page.getByText(/Google rejected the saved authorization/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Reconnect Google", exact: true }),
  ).toHaveAttribute("href", "/api/integrations/google/reconnect");
  reconnectRequired = false;
  await page.getByRole("button", { name: "Load owned blogs" }).click();
  await expect(
    page.getByRole("combobox", { name: "Owned blog", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", {
      name: "Fixture owned blog · https://fixture.example/",
    }),
  ).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "Owned blog", exact: true })
    .selectOption("fixture-blog");
  await expect(
    page.getByRole("button", { name: "Select blog", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Test connection", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("1 owned blog found");
  await expect(
    page.getByText("reconnect required", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("connected", { exact: true })).toBeVisible();
  testFails = true;
  reconnectRequired = true;
  await page
    .getByRole("button", { name: "Test connection", exact: true })
    .click();
  await expect(
    page.getByText("reconnect required", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Google rejected the saved authorization/),
  ).toBeVisible();
  blogs = [];
  await page.getByRole("button", { name: "Load owned blogs" }).click();
  await expect(
    page.getByText("No owned blogs found.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Owned blog", exact: true }),
  ).toHaveCount(0);
});
