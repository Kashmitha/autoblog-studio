import { test, expect } from "@playwright/test";
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
config({ quiet: true });
test("owner dashboard, article editing, safety gates, themes and navigation", async ({
  page,
}) => {
  page.on("pageerror", (error) =>
    console.log("[browser error]", error.message),
  );
  const title = "E2E local workflow fixture " + Date.now();
  const db = new PrismaClient(),
    testEmail = `e2e-${Date.now()}@localhost`,
    testPassword = randomBytes(20).toString("hex"),
    salt = randomBytes(16).toString("hex");
  const user = await db.user.create({
    data: {
      email: testEmail,
      passwordHash:
        salt + ":" + scryptSync(testPassword, salt, 64).toString("hex"),
    },
  });
  let articleId = "";
  try {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Welcome to your studio" }),
    ).toBeVisible();
    await page.getByLabel("Email address").fill(testEmail);
    await page.getByLabel("Password", { exact: true }).fill(testPassword);
    await page.getByRole("button", { name: "Open workspace" }).click();
    await expect(
      page.getByRole("heading", {
        name: "A little consistency. A lot of possibility.",
      }),
    ).toBeVisible();
    await expect(page.getByText("No actual earnings recorded")).toBeVisible();
    await expect(
      page.getByText("Mock publishing", { exact: false }).first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "New article", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Working title").fill(title);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Create article", exact: true })
      .click();
    await expect(page.getByLabel("Article title")).toHaveValue(title);
    articleId = new URL(page.url()).pathname.split("/")[2];
    await page
      .getByLabel("Descriptive excerpt")
      .fill("Local automated end-to-end test fixture; not for publication.");
    await page
      .getByLabel("Article HTML")
      .fill("<h2>Draft test</h2><p>This is deliberately incomplete.</p>");
    await page
      .getByLabel("AI assistance (workspace record)", { exact: true })
      .check();
    await expect(
      page.getByLabel("Show AI-assistance footer (public)", { exact: true }),
    ).not.toBeChecked();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(
      page.getByText("Draft saved. Approval reset for review."),
    ).toBeVisible();
    await expect(
      page.getByLabel("AI assistance (workspace record)", { exact: true }),
    ).toBeChecked();
    await expect(
      page.getByLabel("AI assistance (workspace record)", { exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByLabel("Show AI-assistance footer (public)", { exact: true }),
    ).not.toBeChecked();
    await expect(
      page.getByLabel("Show AI-assistance footer (public)", { exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Run quality checks" }).click();
    await expect(page.getByText("THIN CONTENT", { exact: true })).toBeVisible();
    await expect(page.getByText("NO SOURCES", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(
      page
        .frameLocator('iframe[title="Article preview"]')
        .getByRole("heading", { name: "Draft test" }),
    ).toBeVisible();
    await expect(
      page
        .frameLocator('iframe[title="Article preview"]')
        .getByText("Prepared with AI assistance.", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByLabel("Show AI-assistance footer (public)", { exact: true })
      .check();
    await expect(
      page
        .frameLocator('iframe[title="Article preview"]')
        .getByText("Prepared with AI assistance.", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Show AI-assistance footer (public)", { exact: true })
      .uncheck();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(
      page.getByRole("button", { name: "Save draft" }),
    ).toBeDisabled();
    await expect(
      page
        .frameLocator('iframe[title="Article preview"]')
        .getByText("Prepared with AI assistance.", { exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    for (const [path, heading] of [
      ["/planner", "Start with a real question."],
      ["/calendar", "Give good content its moment."],
      ["/automation", "Consistency, with a human in control."],
      ["/connections", "A studio that works with your tools."],
      ["/monetization", "Real earnings. A clearer picture."],
      ["/analytics", "Understand how people find you."],
      ["/jobs", "Know what’s running. Know what happened."],
      ["/media", "The right image, with the right credit."],
    ]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
    }
    await page.screenshot({
      path: ".local/screenshots/media-desktop.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.goto("/");
    await page.screenshot({
      path: ".local/screenshots/dashboard-desktop.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: ".local/screenshots/dashboard-mobile.png",
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page
        .locator("body")
        .evaluate((e) => e.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
  } finally {
    try {
      if (articleId) await db.article.delete({ where: { id: articleId } });
      await db.auditLog.deleteMany({
        where: { entityId: articleId || "__missing" },
      });
      await db.user.delete({ where: { id: user.id } });
    } finally {
      await db.$disconnect();
    }
  }
});
