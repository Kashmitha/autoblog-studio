import { test, expect, type Page } from "@playwright/test";
import type { EditorialStatus } from "../../frontend/src/components/editorial-pipeline";

async function fixture(page: Page, blocked = false) {
  let saves = 0,
    queues = 0,
    starters = 0,
    photos = 0;
  const status: EditorialStatus = {
    settings: {
      enabled: false,
      autoPublish: false,
      times: ["09:00", "17:00"],
      revision: 0,
    },
    blogUrl: "https://example.blogspot.com/",
    paidReady: !blocked,
    monthlyLimitUsd: 3,
    draftBlockers: blocked
      ? [
          "Configure the text provider, current token prices and explicit API billing authorization in private .env.",
        ]
      : [],
    publishingBlockers: blocked
      ? [
          "Configure the text provider first.",
          "Review real photographs and license rights.",
        ]
      : [],
    readyBriefs: [],
    pool: [
      {
        id: "photo",
        title: "Reviewed laptop photograph",
        url: "https://upload.wikimedia.org/example.jpg",
        alt: "A laptop on a desk",
        license: "CC BY 4.0",
        provider: "WIKIMEDIA",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
        eligible: false,
        metadata: {},
      },
    ],
    workerLastSeen: "2026-11-13T09:00:00Z",
    nextSlots: [],
    runs: [],
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname,
      method = route.request().method();
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "editorial@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({ json: { bloggerMode: "mock", aiEnabled: false } });
    if (path === "/api/reminders") return route.fulfill({ json: [] });
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
    if (path === "/api/editorial" && method === "PATCH") {
      const input = route.request().postDataJSON();
      expect(Object.keys(input).sort()).toEqual(
        [
          "autoPublish",
          "autoPlan",
          "confirmation",
          "enabled",
          "revision",
          "times",
        ].sort(),
      );
      expect(input.confirmation).toBe(
        "AUTHORIZE AUTOMATIC EDITORIAL PUBLISHING",
      );
      expect(input.autoPlan).toBe(true);
      status.settings = {
        enabled: input.enabled,
        autoPublish: input.autoPublish,
        autoPlan: input.autoPlan,
        times: input.times,
        revision: 1,
      };
      saves++;
      return route.fulfill({ json: status.settings });
    }
    if (path === "/api/editorial") return route.fulfill({ json: status });
    if (path === "/api/editorial/starter-briefs") {
      starters++;
      status.readyBriefs = [
        { id: "brief", title: "Inspect a Git commit", sources: 2 },
      ];
      return route.fulfill({ status: 201, json: { created: 1 } });
    }
    if (path === "/api/editorial/photos/photo") {
      photos++;
      const input = route.request().postDataJSON();
      expect(input.confirmation).toBe("CONFIRM REAL PHOTO RIGHTS");
      expect(input.tags).toEqual(["laptop", "programming"]);
      status.pool[0].eligible = true;
      status.pool[0].metadata = {
        editorialPhoto: { enabled: true, tags: input.tags },
      };
      return route.fulfill({ status: 201, json: { ok: true } });
    }
    if (path === "/api/editorial/queue") {
      queues++;
      status.runs = [
        {
          id: "run",
          slotKey: "2026-11-14:09:00",
          slotAt: "2026-11-14T03:30Z",
          state: "QUEUED",
          stage: "QUEUED",
          message: "Worker will prepare this future slot.",
          article: null,
          candidates: [],
        },
      ];
      return route.fulfill({ status: 201, json: { queued: true } });
    }
    if (path.includes("refresh-due") || path === "/api/blogger/sync")
      return route.fulfill({ json: { results: [], skipped: true } });
    return route.fulfill({
      status: 404,
      json: { message: "Unexpected fixture path" },
    });
  });
  return {
    get saves() {
      return saves;
    },
    get queues() {
      return queues;
    },
    get starters() {
      return starters;
    },
    get photos() {
      return photos;
    },
  };
}
test("editorial controls require explicit policy and real-photo confirmation before side effects", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/automation");
  const panel = page.getByRole("region", {
    name: "Editorial pipeline",
    exact: true,
  });
  await expect(
    panel.getByText("AI detectors cannot be guaranteed.", { exact: false }),
  ).toBeVisible();
  expect([state.saves, state.queues, state.starters, state.photos]).toEqual([
    0, 0, 0, 0,
  ]);
  await panel
    .getByRole("button", { name: "Add starter reference briefs", exact: true })
    .click();
  await expect(
    panel.getByText("1 briefs ready.", { exact: false }),
  ).toBeVisible();
  await panel.getByLabel("Reviewed photograph").selectOption("photo");
  await panel
    .getByLabel("Photo keywords (comma-separated)")
    .fill("laptop, programming");
  const allow = panel.getByRole("button", {
    name: "Allow reviewed photo in automatic pool",
    exact: true,
  });
  await expect(allow).toBeDisabled();
  await panel
    .getByLabel("I reviewed this real photograph", { exact: false })
    .check();
  await allow.click();
  await expect.poll(() => state.photos).toBe(1);
  await panel.getByLabel("Enable paid preparation", { exact: false }).check();
  await panel
    .getByLabel("Refill an empty brief queue", { exact: false })
    .check();
  await panel
    .getByLabel("Publish under standing owner policy", { exact: false })
    .check();
  const save = panel.getByRole("button", {
    name: "Save workflow settings",
    exact: true,
  });
  await expect(save).toBeDisabled();
  await panel
    .getByLabel("Type AUTHORIZE AUTOMATIC EDITORIAL PUBLISHING", {
      exact: true,
    })
    .fill("AUTHORIZE AUTOMATIC EDITORIAL PUBLISHING");
  await save.click();
  await expect.poll(() => state.saves).toBe(1);
  await panel
    .getByRole("button", { name: "Prepare next future slot", exact: true })
    .click();
  await expect.poll(() => state.queues).toBe(1);
  await expect(
    panel.getByText("Worker will prepare this future slot.", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      panel
        .locator(".two-column")
        .first()
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("disabled provider blockers and manual Unsplash boundary are visible without automatic calls", async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.goto("/automation");
  const panel = page.getByRole("region", {
    name: "Editorial pipeline",
    exact: true,
  });
  await expect(
    panel.getByText("Before enabling:", { exact: true }),
  ).toBeVisible();
  const preparation = panel.getByRole("region", {
    name: "Prepare without an AI key",
  });
  await expect(
    preparation.getByText("Prepare now; connect AI later"),
  ).toBeVisible();
  await expect(
    preparation.getByRole("link", { name: "Find real photographs" }),
  ).toHaveAttribute("href", "/media?provider=wikimedia&q=laptop%20keyboard");
  await expect(
    preparation.getByRole("link", { name: "Write or review articles" }),
  ).toHaveAttribute("href", "/articles");
  await expect(
    panel.getByText("Prepare next future slot is unavailable", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    panel.getByText("Unsplash's current API guidelines", { exact: false }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", {
      name: "Prepare next future slot",
      exact: true,
    }),
  ).toBeDisabled();
  expect([state.saves, state.queues, state.starters, state.photos]).toEqual([
    0, 0, 0, 0,
  ]);
});
