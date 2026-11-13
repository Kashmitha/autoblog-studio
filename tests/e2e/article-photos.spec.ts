import { test, expect, type Page } from "@playwright/test";

async function fixture(
  page: Page,
  status = "NEEDS_REVIEW",
  failLibrary = false,
) {
  const calls = { attachments: [] as string[], libraryReads: 0, failLibrary };
  const photos = [
    {
      id: "unsplash",
      title: "Laptop on a desk",
      provider: "UNSPLASH",
      url: "https://images.unsplash.com/fixture.jpg",
      creator: "Fixture photographer",
      license: "Unsplash",
      licenseUrl: "https://unsplash.com/license",
      sourceUrl: "https://unsplash.com/photos/fixture",
      alt: "An open laptop on a wooden desk",
      attribution: "Photo by Fixture photographer on Unsplash. Resized.",
      rightsConfirmed: true,
    },
    {
      id: "unreviewed",
      title: "Programming classroom",
      provider: "WIKIMEDIA",
      url: "https://upload.wikimedia.org/fixture.jpg",
      creator: "Fixture author",
      license: "CC0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Fixture.jpg",
      alt: "A classroom of desktop computers",
      attribution: "Fixture author, CC0",
      rightsConfirmed: false,
    },
    {
      id: "original",
      title: "My terminal screenshot",
      provider: "ORIGINAL",
      url: "/api/media/original/file",
      creator: "Owner",
      license: "Original work",
      licenseUrl: "",
      sourceUrl: "",
      alt: "Terminal showing a Git status example",
      attribution: "Original screenshot by owner.",
      rightsConfirmed: true,
    },
    {
      id: "archive",
      title: "Archived credit reference",
      provider: "ARCHIVE",
      url: "",
      creator: "Unknown",
      license: "",
      sourceUrl: "",
      licenseUrl: "",
      alt: "Archived image",
      attribution: "Archived reference",
      rightsConfirmed: false,
    },
  ];
  const article = {
    id: "photo-ui",
    title: "Inspect a Git commit safely",
    slug: "photo-ui",
    niche: "Git & GitHub",
    intent: "Read a commit without changing files",
    html: "<h2>Example</h2><p>Draft text.</p>",
    labels: ["Git"],
    excerpt: "",
    status,
    version: 1,
    aiAssisted: false,
    disclosure: false,
    sources: [],
    media: [] as { media: (typeof photos)[number] }[],
    events: [],
    reports: [],
    publishingTarget: "local",
    updatedAt: "2026-11-13T08:00:00Z",
  };
  await page.route("https://images.unsplash.com/**", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.route("https://upload.wikimedia.org/**", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "photos@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({ json: { bloggerMode: "mock", aiEnabled: false } });
    if (path === "/api/reminders") return route.fulfill({ json: [] });
    if (path === "/api/media") {
      calls.libraryReads++;
      return calls.failLibrary
        ? route.fulfill({ status: 503, json: { message: "Media unavailable" } })
        : route.fulfill({ json: photos });
    }
    if (path === "/api/articles/photo-ui/internal-links")
      return route.fulfill({
        json: {
          articleVersion: article.version,
          suggestions: [],
          reason: "No matches",
        },
      });
    if (
      path === "/api/articles/photo-ui/media" &&
      request.method() === "POST"
    ) {
      const { mediaId } = request.postDataJSON();
      calls.attachments.push(mediaId);
      article.media.push({ media: photos.find((p) => p.id === mediaId)! });
      article.version++;
      article.status = "NEEDS_REVIEW";
      return route.fulfill({ json: article });
    }
    if (path === "/api/articles/photo-ui")
      return route.fulfill({ json: article });
    if (path.includes("refresh-due") || path === "/api/blogger/sync")
      return route.fulfill({ json: { results: [], skipped: true } });
    if (path === "/api/media/original/file")
      return route.fulfill({ status: 204 });
    return route.fulfill({
      status: 404,
      json: { message: "Unexpected fixture request" },
    });
  });
  return calls;
}

test("preview and filter are read-only; manual Unsplash attachment requires its explicit button", async ({
  page,
}) => {
  const calls = await fixture(page);
  await page.goto("/articles/photo-ui");
  const picker = page.getByRole("region", { name: "Choose article photo" });
  await picker
    .getByRole("combobox", { name: "Photo provider", exact: true })
    .selectOption("UNSPLASH");
  await picker
    .getByRole("combobox", { name: "Preview a library image", exact: true })
    .selectOption("unsplash");
  await expect(
    picker.getByText(
      "Credit: Photo by Fixture photographer on Unsplash. Resized.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    picker.getByRole("link", { name: "Original photo source" }),
  ).toHaveAttribute("href", "https://unsplash.com/photos/fixture");
  expect(calls.attachments).toEqual([]);
  await picker.getByLabel("Find a library photo").fill("no matching image");
  await expect(
    picker.getByRole("button", { name: "Attach selected image" }),
  ).toBeDisabled();
  expect(calls.attachments).toEqual([]);
  await picker.getByLabel("Find a library photo").fill("Fixture photographer");
  await picker
    .getByRole("combobox", { name: "Preview a library image", exact: true })
    .selectOption("unsplash");
  await picker.getByRole("button", { name: "Attach selected image" }).click();
  await expect.poll(() => calls.attachments).toEqual(["unsplash"]);
  await expect(
    picker.getByRole("option", {
      name: "Laptop on a desk · UNSPLASH",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove image", exact: true }),
  ).toBeVisible();
  await expect(
    picker.getByRole("button", { name: "Attach selected image" }),
  ).toBeDisabled();
});

test("unreviewed rights and unsaved article changes block attachment; archived references stay excluded", async ({
  page,
}) => {
  const calls = await fixture(page);
  await page.goto("/articles/photo-ui");
  const picker = page.getByRole("region", { name: "Choose article photo" });
  await expect(
    picker.getByRole("option", {
      name: "Archived credit reference",
      exact: false,
    }),
  ).toHaveCount(0);
  await picker
    .getByRole("combobox", { name: "Preview a library image", exact: true })
    .selectOption("unreviewed");
  await expect(
    picker.getByText("This image has no confirmed rights review.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    picker.getByRole("button", { name: "Attach selected image" }),
  ).toBeDisabled();
  await picker
    .getByRole("combobox", { name: "Preview a library image", exact: true })
    .selectOption("original");
  await expect(
    picker.getByText("Private image:", { exact: false }),
  ).toBeVisible();
  await expect(
    picker.getByRole("button", { name: "Attach selected image" }),
  ).toBeEnabled();
  await page
    .getByLabel("Article title", { exact: true })
    .fill("An edited title not saved yet");
  await expect(
    picker.getByRole("button", { name: "Attach selected image" }),
  ).toBeDisabled();
  await expect(
    picker.getByText("Save your article changes before attaching a photo.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(calls.attachments).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => picker.evaluate((el) => el.scrollWidth <= el.clientWidth))
    .toBe(true);
});

test("media read failure is distinct from an empty library and can be refreshed without changing the article", async ({
  page,
}) => {
  const calls = await fixture(page, "NEEDS_REVIEW", true);
  await page.goto("/articles/photo-ui");
  const picker = page.getByRole("region", { name: "Choose article photo" });
  await expect(
    picker.getByText("Could not load the media library.", { exact: false }),
  ).toBeVisible();
  await expect(
    picker.getByRole("button", { name: "Attach selected image" }),
  ).toBeDisabled();
  calls.failLibrary = false;
  await picker.getByRole("button", { name: "Refresh media library" }).click();
  await expect(
    picker.getByText("3 matching images not already attached.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(calls.libraryReads).toBeGreaterThanOrEqual(2);
  expect(calls.attachments).toEqual([]);
});

test("published articles have no media mutation controls", async ({ page }) => {
  const calls = await fixture(page, "PUBLISHED");
  await page.goto("/articles/photo-ui");
  await expect(
    page.getByRole("heading", { name: "Article images", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Choose article photo" }),
  ).toHaveCount(0);
  expect(calls.attachments).toEqual([]);
});
