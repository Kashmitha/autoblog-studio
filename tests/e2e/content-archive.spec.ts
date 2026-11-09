import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function fixture(page: Page, failFirst = false) {
  let exports = 0,
    imports = 0,
    previews = 0;
  const coverage = {
    included: ["Article HTML, source notes and planning"],
    excluded: ["Credentials and original uploads"],
    limitation:
      "This content archive is not a complete database backup. No automatic import is provided.",
  };
  const archive = {
    format: "autoblog-studio-content",
    schemaVersion: 1,
    exportedAt: "2026-11-09T09:00:00Z",
    counts: { articles: 1, sources: 0, media: 0 },
    articles: [
      {
        id: "fixture",
        title: "Saved Git tutorial",
        html: "<p>Reviewed &amp; saved</p>",
        planningNotes: "Test a working example",
      },
    ],
    media: [],
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "archive-fixture@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({ json: { bloggerMode: "mock", aiEnabled: false } });
    if (
      path === "/api/blogger/sync" ||
      path === "/api/seo/indexing/refresh-due"
    )
      return route.fulfill({ json: { results: [] } });
    if (path === "/api/reports/search-console/refresh-due")
      return route.fulfill({ json: { skipped: true, sync: null } });
    if (path === "/api/reminders") return route.fulfill({ json: [] });
    if (path === "/api/content/archive")
      return route.fulfill({
        json: {
          articles: 1,
          sources: 0,
          media: 0,
          coverage,
          withinCountLimits: true,
          limits: { articles: 500, media: 2000, bytes: 20 * 1024 * 1024 },
        },
      });
    if (path === "/api/content/archive/export") {
      exports++;
      if (failFirst && exports === 1)
        return route.fulfill({
          status: 400,
          json: {
            message:
              "The content archive exceeds 20 MiB. No partial archive was created.",
          },
        });
      return route.fulfill({
        json: archive,
        headers: {
          "Content-Disposition":
            'attachment; filename="autoblog-content-2026-11-09.json"',
          "Cache-Control": "no-store",
        },
      });
    }
    if (path === "/api/content/archive/preview") {
      previews++;
      return route.fulfill({
        json: {
          fingerprint: "a".repeat(64),
          notice:
            "New articles become review drafts. No publication state is restored.",
          articles: [
            {
              sourceId: "fixture",
              title: "Saved Git tutorial",
              action: imports ? "skip" : "create",
              htmlAdjusted: true,
            },
          ],
          media: [],
        },
      });
    }
    if (path === "/api/content/archive/import") {
      imports++;
      return route.fulfill({
        json: {
          createdArticles: 1,
          createdMedia: 0,
          skippedArticles: 0,
          skippedMedia: 0,
        },
      });
    }
    throw new Error("Unexpected archive fixture request " + path);
  });
  return {
    get exports() {
      return exports;
    },
    get imports() {
      return imports;
    },
    get previews() {
      return previews;
    },
  };
}
test("settings show archive coverage and download valid saved JSON without exporting automatically", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const state = await fixture(page);
  await page.goto("/settings");
  const panel = page.getByRole("region", {
    name: "Portable content archive",
    exact: true,
  });
  await expect(
    panel.getByText("1 articles · 0 sources · 0 media references", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.exports).toBe(0);
  await expect(
    panel.getByText("Credentials and original uploads", { exact: true }),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await panel
    .getByRole("button", { name: "Download content archive", exact: true })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("autoblog-content-2026-11-09.json");
  const data = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(data.format).toBe("autoblog-studio-content");
  expect(data.articles[0].planningNotes).toBe("Test a working example");
  expect(state.exports).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({
    path: ".local/screenshots/content-archive-fixture-mobile.png",
  });
});

test("archive import requires preview, creates review drafts explicitly and prevents repeated import in the UI", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const state = await fixture(page);
  await page.goto("/settings");
  const panel = page.getByRole("region", {
    name: "Import content archive",
    exact: true,
  });
  await expect(
    panel.getByRole("button", { name: "Preview archive import" }),
  ).toBeDisabled();
  expect(state.imports).toBe(0);
  await panel
    .getByLabel("Choose Studio JSON archive")
    .setInputFiles({
      name: "autoblog-content-fixture.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"fixture":"no real content"}'),
    });
  await expect(
    panel.getByRole("button", { name: "Import as review drafts" }),
  ).toHaveCount(0);
  await panel.getByRole("button", { name: "Preview archive import" }).click();
  await expect(
    panel.getByText("1 new review drafts · 0 new media references", {
      exact: true,
    }),
  ).toBeVisible();
  expect(state.imports).toBe(0);
  await panel.getByRole("button", { name: "Import as review drafts" }).click();
  await expect(
    panel.getByRole("link", { name: "Open content backlog" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Import as review drafts" }),
  ).toBeDisabled();
  expect(state.imports).toBe(1);
  await panel.getByRole("button", { name: "Preview archive import" }).click();
  await expect(
    panel.getByText("Everything in this archive is already present.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Import as review drafts" }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({
    path: ".local/screenshots/archive-import-fixture-mobile.png",
  });
});
test("a failed export shows the server explanation and allows retry without claiming success", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.goto("/settings");
  const panel = page.getByRole("region", {
    name: "Portable content archive",
    exact: true,
  });
  await panel
    .getByRole("button", { name: "Download content archive", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "No partial archive was created",
  );
  await expect(
    panel.getByText("Download requested this visit:", { exact: false }),
  ).toHaveCount(0);
  const downloading = page.waitForEvent("download");
  await panel
    .getByRole("button", { name: "Download content archive", exact: true })
    .click();
  await downloading;
  expect(state.exports).toBe(2);
  await expect(
    panel.getByText("Download requested this visit:", { exact: false }),
  ).toBeVisible();
});
