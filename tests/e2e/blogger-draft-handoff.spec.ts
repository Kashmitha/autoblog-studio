import { test, expect, type Page } from "@playwright/test";
async function fixture(page: Page, uncertain = false) {
  const calls = { drafts: 0, links: 0, publishOrSchedule: 0 };
  const article = {
    id: "handoff-ui",
    title: "Approved article for metadata review",
    slug: "handoff-ui",
    niche: "Git & GitHub",
    intent: "Prepare an approved post for final metadata",
    excerpt:
      "A specific summary to review before using it as the Blogger search description.",
    html: "<h2>Example</h2><p>Prepared text.</p>",
    labels: ["Git"],
    status: "APPROVED",
    approvedAt: "2026-11-14T08:00Z" as string | null,
    version: 3,
    aiAssisted: true,
    disclosure: false,
    sources: [],
    media: [],
    events: [],
    reports: [],
    publishingTarget: "local",
    remoteStatus: "",
    remotePostId: "",
    remoteBlogId: "",
    remoteSyncedAt: "",
    remoteSyncError: "",
    bloggerDraftHandoffAt: null as string | null,
    updatedAt: "2026-11-14T08:00Z",
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { email: "handoff@localhost", csrfToken: "fixture" },
      });
    if (path === "/api/integrations")
      return route.fulfill({
        json: {
          bloggerMode: "live",
          aiEnabled: false,
          aiConfigured: false,
          google: {
            blogId: "123",
            blogUrl: "https://fixture.blogspot.com/",
            liveTestSucceededAt: "2026-11-01T00:00Z",
          },
        },
      });
    if (path === "/api/media" || path === "/api/reminders")
      return route.fulfill({ json: [] });
    if (path === "/api/articles/handoff-ui/internal-links")
      return route.fulfill({
        json: { articleVersion: 3, suggestions: [], reason: "No suggestions" },
      });
    if (path === "/api/articles/handoff-ui")
      return route.fulfill({ json: article });
    if (path.includes("/schedule") || path.includes("/publish"))
      calls.publishOrSchedule++;
    if (path === "/api/blogger/articles/handoff-ui/draft") {
      calls.drafts++;
      expect(route.request().postDataJSON()).toEqual({
        version: 3,
        confirmation: "CREATE BLOGGER DRAFT",
      });
      Object.assign(article, {
        publishingTarget: "blogger",
        bloggerDraftHandoffAt: "2026-11-14T08:05Z",
        remoteBlogId: "123",
        status: uncertain ? "PUBLISHING" : "NEEDS_REVIEW",
        remotePostId: uncertain ? "" : "456",
        remoteStatus: uncertain ? "" : "DRAFT",
        approvedAt: uncertain ? article.approvedAt : null,
        remoteSyncError: uncertain
          ? "Blogger may have accepted this request. Recover the existing copy."
          : "",
      });
      return route.fulfill({
        status: uncertain ? 400 : 201,
        json: uncertain ? { message: article.remoteSyncError } : article,
      });
    }
    if (path === "/api/integrations/google/posts")
      return route.fulfill({
        json: [{ id: "456", title: article.title, status: "DRAFT" }],
      });
    if (path === "/api/blogger/articles/handoff-ui/link") {
      calls.links++;
      expect(route.request().postDataJSON()).toEqual({
        postId: "456",
        confirmation: "LINK EXISTING BLOGGER POST",
      });
      Object.assign(article, {
        status: "NEEDS_REVIEW",
        remotePostId: "456",
        remoteStatus: "DRAFT",
        approvedAt: null,
        remoteSyncError: "",
      });
      return route.fulfill({ status: 201, json: article });
    }
    if (path.includes("refresh-due") || path === "/api/blogger/sync")
      return route.fulfill({ json: { results: [], skipped: true } });
    return route.fulfill({
      status: 404,
      json: { message: "Unexpected fixture request" },
    });
  });
  return calls;
}
test("approved handoff requires its phrase and displays a private Blogger draft with manual SEO steps", async ({
  page,
}) => {
  const calls = await fixture(page);
  await page.goto("/articles/handoff-ui");
  await page
    .getByRole("button", { name: "Send to Blogger as draft", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("It does not publish or schedule it.", { exact: false }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Create draft on Blogger" }),
  ).toBeDisabled();
  expect(calls.drafts).toBe(0);
  await dialog
    .getByLabel("Type CREATE BLOGGER DRAFT")
    .fill("CREATE BLOGGER DRAFT");
  await dialog.getByRole("button", { name: "Create draft on Blogger" }).click();
  await expect(
    page.getByText("Blogger confirmed a draft.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Manage on Blogger" }),
  ).toHaveAttribute("href", "https://www.blogger.com/blog/post/edit/123/456");
  const metadata = page.getByRole("region", {
    name: "Blogger metadata review",
  });
  await expect(
    metadata.getByLabel("Suggested search description", { exact: false }),
  ).toHaveValue(
    "A specific summary to review before using it as the Blogger search description.",
  );
  await expect(
    page.getByRole("button", { name: "Send to Blogger as draft", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeDisabled();
  expect(calls).toEqual({ drafts: 1, links: 0, publishOrSchedule: 0 });
  await metadata.screenshot({
    path: ".local/screenshots/draft-handoff-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await metadata.screenshot({
    path: ".local/screenshots/draft-handoff-mobile.png",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("uncertain handoff refreshes into protected state and recovers an existing draft without another insertion", async ({
  page,
}) => {
  const calls = await fixture(page, true);
  await page.goto("/articles/handoff-ui");
  await page
    .getByRole("button", { name: "Send to Blogger as draft", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Type CREATE BLOGGER DRAFT")
    .fill("CREATE BLOGGER DRAFT");
  await dialog.getByRole("button", { name: "Create draft on Blogger" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Recover existing Blogger draft or post" })
    .click();
  const recovery = page.getByRole("dialog");
  await recovery
    .getByRole("combobox", { name: "Matching Blogger post", exact: true })
    .selectOption("456");
  await recovery
    .getByLabel("Type LINK EXISTING BLOGGER POST")
    .fill("LINK EXISTING BLOGGER POST");
  await recovery
    .getByRole("button", { name: "Link Blogger post", exact: true })
    .click();
  await expect(
    page.getByText("Blogger confirmed a draft.", { exact: false }),
  ).toBeVisible();
  expect(calls).toEqual({ drafts: 1, links: 1, publishOrSchedule: 0 });
});
