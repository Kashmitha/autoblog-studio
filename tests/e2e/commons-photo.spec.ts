import { test, expect } from "@playwright/test";

test("automatic Commons status explains the checks and queues only on explicit action", async ({
  page,
}) => {
  let queued = 0;
  await page.route("**/api/**", (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/api/auth/session")
      return route.fulfill({
        json: { email: "fixture@localhost", csrfToken: "fixture" },
      });
    if (p === "/api/integrations")
      return route.fulfill({
        json: {
          bloggerMode: "mock",
          aiEnabled: true,
          aiProvider: "groq",
          aiFreePlan: true,
        },
      });
    if (p === "/api/settings")
      return route.fulfill({
        json: {
          id: "owner",
          paused: false,
          emergencyStop: false,
          dailyLimit: 2,
          times: [],
          timezone: "Asia/Colombo",
        },
      });
    if (p === "/api/editorial")
      return route.fulfill({
        json: {
          settings: {
            enabled: true,
            autoPublish: true,
            autoPlan: true,
            times: ["09:00", "17:00"],
            revision: 1,
          },
          blogUrl: "https://example.blogspot.com/",
          paidReady: true,
          aiFreePlan: true,
          automaticCommonsDiscovery: true,
          monthlyLimitUsd: 3,
          draftBlockers: [],
          publishingBlockers: [],
          readyBriefs: [],
          pool: [],
          runs: [],
          nextSlots: [],
          workerLastSeen: new Date().toISOString(),
        },
      });
    if (p === "/api/editorial/queue") {
      queued++;
      return route.fulfill({ json: { queued: true } });
    }
    if (p.includes("refresh-due") || p === "/api/blogger/sync")
      return route.fulfill({ json: { skipped: true, results: [] } });
    return route.fulfill({ json: [] });
  });
  await page.goto("/automation");
  const panel = page.getByRole("region", {
    name: "Editorial pipeline",
    exact: true,
  });
  await expect(
    panel.getByText("Automatic Commons discovery is enabled.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(queued).toBe(0);
  await panel
    .getByRole("button", { name: "Prepare next future slot", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Next future slot queued",
  );
  expect(queued).toBe(1);
});
