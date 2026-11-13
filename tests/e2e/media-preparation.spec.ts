import { test, expect, type Page } from "@playwright/test";

async function fixture(page: Page, unsplashConfigured = false) {
  const calls = { searches: 0, imports: [] as Record<string, unknown>[] };
  await page.route("https://images.unsplash.com/**", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.route("https://upload.wikimedia.org/**", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "media@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({
        json: { bloggerMode: "mock", aiEnabled: false, unsplashConfigured },
      });
    if (path === "/api/reminders") return route.fulfill({ json: [] });
    if (path === "/api/media/search") {
      calls.searches++;
      const unsplash = url.searchParams.get("provider") === "unsplash";
      return route.fulfill({
        json: [
          {
            title: "Real laptop photograph",
            alt: "An open laptop on a wooden desk",
            creator: "Fixture photographer",
            url: unsplash
              ? "https://images.unsplash.com/photo-fixture"
              : "https://upload.wikimedia.org/fixture.jpg",
            sourceUrl: unsplash
              ? "https://unsplash.com/photos/fixture"
              : "https://commons.wikimedia.org/wiki/File:Fixture.jpg",
            profileUrl: unsplash ? "https://unsplash.com/@fixture" : "",
            provider: unsplash ? "UNSPLASH" : "WIKIMEDIA",
            license: unsplash ? "Unsplash" : "CC0",
            licenseUrl: unsplash
              ? "https://unsplash.com/license"
              : "https://creativecommons.org/publicdomain/zero/1.0/",
            attribution:
              "Photo by Fixture photographer. Resized for web display.",
            rightsConfirmed: false,
            ...(unsplash ? { providerPhotoId: "fixture-photo-id" } : {}),
          },
        ],
      });
    }
    if (path === "/api/media" && request.method() === "POST") {
      calls.imports.push(request.postDataJSON());
      return route.fulfill({ status: 201, json: { id: "imported" } });
    }
    if (path === "/api/media") return route.fulfill({ json: [] });
    if (path.includes("refresh-due") || path === "/api/blogger/sync")
      return route.fulfill({ json: { skipped: true, results: [] } });
    return route.fulfill({
      status: 404,
      json: { message: "Unexpected fixture request" },
    });
  });
  return calls;
}

test("missing Unsplash key explains the blocker before search or import; provider URLs never start search automatically", async ({
  page,
}) => {
  const calls = await fixture(page);
  await page.goto("/media?provider=unsplash&q=laptop");
  await expect(page.getByLabel("Image search", { exact: true })).toHaveValue(
    "laptop",
  );
  await expect(page.getByLabel("Image provider")).toHaveValue("unsplash");
  await expect(
    page.getByRole("button", { name: "Search images", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Unsplash Access Key is not configured.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import original / licensed image" })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Provider", exact: true })
    .selectOption("UNSPLASH");
  await expect(
    dialog.getByRole("button", { name: "Import reviewed image" }),
  ).toBeDisabled();
  await expect(
    dialog.getByText("Unsplash import is unavailable", { exact: false }),
  ).toBeVisible();
  expect(calls).toEqual({ searches: 0, imports: [] });
});

for (const provider of ["wikimedia", "unsplash"])
  test(`${provider} search carries provider metadata into a reviewed import without enabling automation`, async ({
    page,
  }) => {
    const calls = await fixture(page, provider === "unsplash");
    await page.goto(`/media?provider=${provider}&q=laptop`);
    await expect(page.getByLabel("Image search", { exact: true })).toHaveValue(
      "laptop",
    );
    expect(calls.searches).toBe(0);
    await page
      .getByRole("button", { name: "Search images", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Review & import", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByLabel("Actual creator / photographer"),
    ).toHaveValue("Fixture photographer");
    await expect(
      dialog.getByLabel("Visible attribution, including any modifications"),
    ).toHaveValue("Photo by Fixture photographer. Resized for web display.");
    expect(calls.imports).toHaveLength(0);
    await dialog
      .getByLabel("I reviewed the original source", { exact: false })
      .check();
    await dialog
      .getByRole("button", { name: "Import reviewed image", exact: true })
      .click();
    await expect.poll(() => calls.imports.length).toBe(1);
    expect(calls.searches).toBe(1);
    expect(calls.imports[0].provider).toBe(
      provider === "unsplash" ? "UNSPLASH" : "WIKIMEDIA",
    );
    expect(calls.imports[0].rightsConfirmed).toBe(true);
    if (provider === "unsplash")
      expect(calls.imports[0].providerPhotoId).toBe("fixture-photo-id");
    await expect(dialog).not.toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page
          .getByRole("region", { name: "Media import guide" })
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
      )
      .toBe(true);
  });
