import { test, expect, type Page } from "@playwright/test";
async function fixture(page: Page) {
  let saved = 0,
    suggestions = 0;
  const article = {
    id: "planning-ui",
    title: "Unstage Git changes safely",
    slug: "planning-ui",
    niche: "Git & GitHub",
    intent: "Preserve Git working changes",
    html: "<h2>Draft</h2><p>Working content.</p>",
    labels: ["Git"],
    excerpt: "",
    status: "NEEDS_REVIEW",
    version: 1,
    aiAssisted: false,
    disclosure: false,
    sources: [],
    media: [],
    events: [],
    reports: [],
    publishingTarget: "local",
    updatedAt: "2026-11-09T08:00:00Z",
  };
  let plan = {
    ...article,
    backlogPriority: 0,
    planningVersion: 1,
    planningNotes: "",
    hasDraft: true,
    sourceCount: 0,
    checkedSourceCount: 0,
    qualityPassed: false,
  };
  const approved = {
    ...plan,
    id: "second-ui",
    title: "Docker build cache troubleshooting",
    niche: "Docker",
    status: "APPROVED",
    backlogPriority: 3,
    qualityPassed: true,
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "fixture@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({
        json: {
          bloggerMode: "mock",
          aiEnabled: false,
          googleConfigured: false,
        },
      });
    if (
      path === "/api/blogger/sync" ||
      path === "/api/seo/indexing/refresh-due"
    )
      return route.fulfill({ json: { results: [] } });
    if (path === "/api/reports/search-console/refresh-due")
      return route.fulfill({ json: { skipped: true, sync: null } });
    if (path === "/api/reminders" || path === "/api/media")
      return route.fulfill({ json: [] });
    if (path === "/api/articles/backlog")
      return route.fulfill({ json: { articles: [approved, plan] } });
    if (path === "/api/articles/planning-ui/planning") {
      expect(route.request().method()).toBe("PATCH");
      const data = route.request().postDataJSON();
      expect(data.planningVersion).toBe(plan.planningVersion);
      plan = { ...plan, ...data, planningVersion: plan.planningVersion + 1 };
      return route.fulfill({ json: { ok: true } });
    }
    if (path === "/api/articles/planning-ui/internal-links") {
      suggestions++;
      return route.fulfill({
        json: {
          articleVersion: article.version,
          reason: "Saved terms matched; review relevance.",
          suggestions: [
            {
              id: "published",
              title: 'Git diff & "staged" <examples>',
              url: "https://fixture.blogspot.com/git-diff.html",
              sharedTerms: ["git", "staged"],
            },
          ],
        },
      });
    }
    if (path === "/api/articles/planning-ui") {
      if (route.request().method() === "PATCH") {
        saved++;
        const data = route.request().postDataJSON();
        expect(data.html).toContain(
          'href="https://fixture.blogspot.com/git-diff.html"',
        );
        expect(data.html).toContain("&lt;examples&gt;");
        Object.assign(article, data, {
          version: article.version + 1,
          status: "NEEDS_REVIEW",
        });
      }
      return route.fulfill({ json: article });
    }
    throw new Error("Unexpected planning fixture request " + path);
  });
  return {
    get saved() {
      return saved;
    },
    get suggestions() {
      return suggestions;
    },
  };
}
test("backlog filters all editable stages and persists priority and private notes", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/planner");
  const panel = page.getByRole("region", {
    name: "Content backlog",
    exact: true,
  });
  await expect(
    panel.getByText("2 of 2 backlog articles", { exact: false }),
  ).toBeVisible();
  await panel
    .getByRole("combobox", { name: "Backlog stage", exact: true })
    .selectOption("APPROVED");
  await expect(panel.locator("article")).toHaveCount(1);
  await expect(
    panel
      .getByText("Docker build cache troubleshooting", { exact: true })
      .first(),
  ).toBeVisible();
  await panel.getByRole("combobox", { name: "Backlog stage", exact: true }).selectOption("all");
  await panel.getByLabel("Search backlog").fill("Unstage");
  const item = panel.locator("article");
  await item.getByText("Priority and private notes", { exact: true }).click();
  await item
    .getByLabel("Priority for Unstage Git changes safely")
    .selectOption("3");
  await item
    .getByLabel("Private notes for Unstage Git changes safely")
    .fill("Capture the working-tree verification example.");
  await item.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Plan saved");
  await item.getByText("Priority and private notes", { exact: true }).click();
  await expect(
    item.getByLabel("Private notes for Unstage Git changes safely"),
  ).toHaveValue("Capture the working-tree verification example.");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({
    path: ".local/screenshots/content-backlog-fixture-mobile.png",
  });
});
test("internal links are explicit unsaved edits, safely escaped, deduplicated and saved through normal review", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/articles/planning-ui");
  const panel = page.getByRole("region", {
    name: "Internal-link suggestions",
    exact: true,
  });
  expect(state.suggestions).toBe(0);
  await panel.getByRole("button", { name: "Find related posts" }).click();
  await expect(
    panel.getByText('Git diff & "staged" <examples>', { exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "Add link to draft", exact: true })
    .click();
  expect(state.saved).toBe(0);
  await expect(
    panel.getByRole("button", { name: "Already in draft" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Article HTML")).toHaveValue(/&lt;examples&gt;/);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Approval reset for review",
  );
  expect(state.saved).toBe(1);
  await panel.getByRole("button", { name: "Find related posts" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({
    path: ".local/screenshots/internal-links-fixture-mobile.png",
  });
});
