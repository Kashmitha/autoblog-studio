import { test, expect, type Page } from "@playwright/test";

async function fixture(page: Page) {
  const rows = ["first", "second", "third"].map((id, index) => ({
    id,
    title: `Browser tutorial ${index + 1}`,
    version: 3,
    state: "MISSING_IMAGE",
    searchTerms: ["laptop keyboard"],
    image: null as unknown,
    lastAttempt: null,
  }));
  const calls: string[] = [];
  let release: (() => void) | null = null;
  let hold = false;
  await page.route("https://upload.wikimedia.org/**", (route) =>
    route.fulfill({ status: 204 }),
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "photos@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({ json: { bloggerMode: "mock", aiEnabled: false } });
    if (path === "/api/reminders" || path === "/api/media")
      return route.fulfill({ json: [] });
    if (path === "/api/articles/first")
      return route.fulfill({
        json: {
          id: "first",
          updatedAt: "2026-11-16T08:00:00Z",
          title: rows[0].title,
          slug: "first",
          niche: "Web development",
          intent: "Explain browser requests",
          html: "<p>Saved browser tutorial text.</p>",
          excerpt: "",
          labels: [],
          version: rows[0].version,
          status: "NEEDS_REVIEW",
          publishingTarget: "local",
          aiAssisted: false,
          disclosure: false,
          sources: [],
          events: [],
          reports: [],
          media: rows[0].image
            ? [{ media: { id: "photo", ...(rows[0].image as object) } }]
            : [],
        },
      });
    if (path === "/api/articles/first/internal-links")
      return route.fulfill({
        json: {
          articleVersion: rows[0].version,
          suggestions: [],
          reason: "No matches",
        },
      });
    if (path.includes("refresh-due") || path === "/api/blogger/sync")
      return route.fulfill({ json: { skipped: true, results: [] } });
    if (path === "/api/settings")
      return route.fulfill({
        json: {
          id: "owner",
          paused: true,
          emergencyStop: false,
          dailyLimit: 2,
          times: [],
          timezone: "Asia/Colombo",
          sitemapValid: false,
        },
      });
    if (path === "/api/editorial")
      return route.fulfill({
        json: {
          settings: {
            enabled: false,
            autoPublish: false,
            times: ["09:00", "17:00"],
            revision: 0,
          },
          blogUrl: null,
          paidReady: false,
          monthlyLimitUsd: null,
          draftBlockers: [],
          publishingBlockers: [],
          readyBriefs: [],
          pool: [],
          runs: [],
          nextSlots: [],
          workerLastSeen: null,
        },
      });
    if (path === "/api/editorial/photo-queue")
      return route.fulfill({
        json: { automaticDiscovery: true, hasMore: false, articles: rows },
      });
    const match = path.match(
      /^\/api\/editorial\/articles\/(first|second|third)\/prepare-photo$/,
    );
    if (match) {
      const id = match[1];
      calls.push(id);
      expect(route.request().postDataJSON().version).toBe(3);
      if (hold)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      if (id === "second")
        return route.fulfill({
          status: 201,
          json: {
            state: "BLOCKED",
            message: "No eligible image matched; your article text is saved.",
          },
        });
      const row = rows.find((r) => r.id === id)!;
      row.state = "ATTACHED";
      row.version++;
      row.image = {
        title: "Reviewed laptop",
        url: "https://upload.wikimedia.org/test.jpg",
        alt: "A laptop on a desk",
        attribution: "Photographer / CC BY 4.0",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Test.jpg",
      };
      return route.fulfill({
        status: 201,
        json: {
          state: "ATTACHED",
          message: "Photo and attribution attached. Preview before approval.",
        },
      });
    }
    return route.fulfill({
      status: 503,
      json: { message: "Unavailable in photo fixture" },
    });
  });
  return {
    calls,
    hold: () => {
      hold = true;
    },
    release: () => {
      hold = false;
      release?.();
    },
  };
}
test("batch image preparation attaches credits, keeps blocked drafts, and never starts publication", async ({
  page,
}) => {
  const f = await fixture(page);
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET" && new URL(r.url()).pathname.startsWith("/api/"))
      writes.push(new URL(r.url()).pathname);
  });
  await page.goto("/automation");
  const queue = page.getByRole("region", {
    name: "Automatic photo preparation",
  });
  await queue
    .getByRole("button", { name: "Prepare up to 5 missing images" })
    .click();
  await expect(
    queue.getByText("1 drafts missing images in this queue"),
  ).toBeVisible();
  expect(f.calls).toEqual(["first", "second", "third"]);
  await expect(
    queue.getByText("No eligible image matched; your article text is saved."),
  ).toBeVisible();
  await expect(
    queue.getByRole("img", { name: "A laptop on a desk" }),
  ).toHaveCount(2);
  await expect(queue.getByText("Photographer / CC BY 4.0")).toHaveCount(2);
  const backgroundReads = [
    "/api/blogger/sync",
    "/api/seo/indexing/refresh-due",
    "/api/reports/search-console/refresh-due",
  ];
  expect(writes.filter((path) => !backgroundReads.includes(path))).toEqual(
    f.calls.map((id) => `/api/editorial/articles/${id}/prepare-photo`),
  );
  await page.setViewportSize({ width: 320, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("stop finishes only the current photo and leaves remaining drafts untouched", async ({
  page,
}) => {
  const f = await fixture(page);
  f.hold();
  await page.goto("/automation");
  const queue = page.getByRole("region", {
    name: "Automatic photo preparation",
  });
  await queue
    .getByRole("button", { name: "Prepare up to 5 missing images" })
    .click();
  await expect(
    queue.getByRole("button", { name: "Stop after current photo" }),
  ).toBeVisible();
  await expect.poll(() => f.calls.length).toBe(1);
  await queue.getByRole("button", { name: "Stop after current photo" }).click();
  f.release();
  await expect(
    queue.getByRole("button", { name: "Prepare up to 5 missing images" }),
  ).toBeEnabled();
  expect(f.calls).toEqual(["first"]);
  await expect(
    queue.getByText("2 drafts missing images in this queue"),
  ).toBeVisible();
});

test("editor photo preparation requires saved text and displays the attached photo and credit", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto("/articles/first");
  const button = page.getByRole("button", {
    name: "Find and attach a real photo",
    exact: true,
  });
  await expect(button).toBeEnabled();
  await page
    .getByLabel("Article title", { exact: true })
    .fill("Unsaved title change");
  await expect(button).toBeDisabled();
  expect(f.calls).toEqual([]);
  await page.reload();
  await button.click();
  await expect(
    page.getByRole("img", { name: "A laptop on a desk" }),
  ).toBeVisible();
  await expect(
    page.getByText("Photographer / CC BY 4.0", { exact: true }),
  ).toBeVisible();
  expect(f.calls).toEqual(["first"]);
  await expect(button).toHaveCount(0);
});
