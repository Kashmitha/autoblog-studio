import { test, expect } from "@playwright/test";

test("blog discovery renders a selectable blog and a useful genuine-empty state", async ({
  page,
}) => {
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
    route.fulfill({ json: { ok: true, ownedBlogs: blogs.length } }),
  );
  await page.goto("/connections");
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
  blogs = [];
  await page.getByRole("button", { name: "Load owned blogs" }).click();
  await expect(
    page.getByText("No owned blogs found.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Owned blog", exact: true }),
  ).toHaveCount(0);
});
