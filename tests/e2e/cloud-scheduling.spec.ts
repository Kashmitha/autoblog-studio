import { test, expect } from "@playwright/test";

test("Blogger scheduling uses Sri Lanka time and shows confirmed remote status without local cancel controls", async ({
  page,
}) => {
  let article = {
    id: "cloud-ui-fixture",
    title: "Approved cloud scheduling browser fixture",
    slug: "fixture",
    niche: "Git & GitHub",
    intent: "Test the scheduling interface",
    excerpt: "An isolated browser fixture; no post is sent to Google.",
    html: "<h2>Fixture only</h2><p>Browser test content.</p>",
    labels: ["Git"],
    status: "APPROVED",
    version: 1,
    aiAssisted: true,
    disclosure: false,
    updatedAt: new Date().toISOString(),
    publishingTarget: "local",
    remoteStatus: "",
    remotePostId: "",
    remoteBlogId: "",
    remoteSyncedAt: "",
    remoteSyncError: "",
    scheduledAt: "",
    publishedUrl: "",
    sources: [],
    media: [],
    events: [],
    reports: [],
  };
  let requested: { at?: string } | undefined;
  let remoteLive = false;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: {
          email: "fixture@localhost",
          csrfToken: "fixture-no-real-session",
        },
      });
    if (path === "/api/integrations")
      return route.fulfill({
        json: {
          bloggerMode: "live",
          google: {
            blogId: "123",
            blogUrl: "https://fixture.example/",
            liveTestSucceededAt: "2026-01-01T00:00:00Z",
          },
          aiEnabled: false,
          aiConfigured: false,
          aiModel: "fixture",
          aiMonthlyLimit: 3,
        },
      });
    if (path === "/api/media") return route.fulfill({ json: [] });
    if (path === "/api/articles/cloud-ui-fixture")
      return route.fulfill({ json: article });
    if (path === "/api/articles") return route.fulfill({ json: [article] });
    if (path === "/api/blogger/sync")
      return route.fulfill({ json: { results: [] } });
    if (path === "/api/blogger/articles/cloud-ui-fixture/schedule") {
      requested = route.request().postDataJSON();
      article = {
        ...article,
        status: "SCHEDULED",
        publishingTarget: "blogger",
        remoteStatus: "SCHEDULED",
        remotePostId: "456",
        remoteBlogId: "123",
        remoteSyncedAt: new Date().toISOString(),
        scheduledAt: requested!.at!,
        publishedUrl: "https://fixture.example/post",
      };
      return route.fulfill({ status: 201, json: article });
    }
    if (path === "/api/blogger/articles/cloud-ui-fixture/sync") {
      if (remoteLive)
        article = {
          ...article,
          status: "PUBLISHED",
          remoteStatus: "LIVE",
          scheduledAt: "",
        };
      return route.fulfill({
        json: { results: [{ id: article.id, status: article.status }] },
      });
    }
    throw new Error("Unexpected browser fixture request: " + path);
  });
  await page.goto("/articles/cloud-ui-fixture");
  await page.getByRole("button", { name: "Publish / schedule" }).click();
  await expect(page.getByLabel("Where to schedule")).toHaveValue("blogger");
  await expect(
    page.getByRole("button", { name: "Schedule on Blogger", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Schedule time · Asia/Colombo")
    .fill("2030-11-06T09:00");
  await page
    .getByRole("button", { name: "Schedule on Blogger", exact: true })
    .click();
  await expect.poll(() => requested?.at).toBe("2030-11-06T03:30:00.000Z");
  await expect(
    page.getByRole("heading", { name: "Managed by Blogger" }),
  ).toBeVisible();
  await expect(page.getByText(/Google has this post scheduled/)).toContainText(
    "Your computer can be off",
  );
  await expect(
    page.getByRole("button", { name: "Unschedule", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Manage on Blogger" }),
  ).toHaveAttribute("href", "https://www.blogger.com/blog/post/edit/123/456");
  await expect(page.getByLabel("Article title")).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".local/screenshots/cloud-scheduling-fixture-mobile.png",
    fullPage: true,
  });
  remoteLive = true;
  await page.getByRole("button", { name: "Sync Blogger status" }).click();
  await expect(
    page.getByText("Blogger confirmed this post is published."),
  ).toBeVisible();
});
