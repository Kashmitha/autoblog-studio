import { test, expect } from "@playwright/test";
test("public landing explains the product without account calls, and workflow controls work by keyboard", async ({
  page,
}) => {
  const apiCalls: string[] = [];
  await page.route("**/api/**", (route) => {
    apiCalls.push(route.request().url());
    return route.fulfill({ status: 401, json: { message: "Sign in" } });
  });
  await page.goto("/welcome");
  await expect(page).toHaveTitle("AutoBlog Studio — Ideas into impact");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your ideas.Their nextgreat read.",
  );
  expect(apiCalls).toEqual([]);
  const tabs = page.getByRole("tablist", {
    name: "Explore the publishing workflow",
  });
  await tabs.getByRole("tab", { name: /Shape/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: /Refine/ })).toBeFocused();
  await expect(tabs.getByRole("tab", { name: /Refine/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("End");
  await expect(page.getByRole("tabpanel")).toContainText(
    "Google-hosted scheduling",
  );
  await page.getByRole("button", { name: "Pause motion", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play motion", exact: true }),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Can I use Studio without an AI API key?" })
    .click();
  await expect(
    page.getByText("Yes. Write and edit your own articles,", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Enter your studio", exact: true }),
  ).toHaveAttribute("href", "/");
  await expect(
    page.getByRole("link", { name: "Explore Dev & AI Toolbox", exact: true }),
  ).toHaveAttribute("href", "https://devaitoolbox.blogspot.com/");
  expect(apiCalls).toEqual([]);
  await page
    .getByRole("link", { name: "Enter your studio", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome to your studio" }),
  ).toBeVisible();
});
test("mobile navigation, reduced motion and responsive page remain usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/welcome");
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Close navigation" }),
  ).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("navigation", { name: "Landing navigation" })
    .getByRole("link", { name: "Good questions" })
    .click();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const animated = await page
    .locator('[aria-hidden="true"]')
    .evaluateAll((elements) =>
      elements
        .flatMap((e) => [e, ...e.querySelectorAll("*")])
        .map((e) => getComputedStyle(e).animationName)
        .filter((name) => name !== "none"),
    );
  expect(animated).toEqual([]);
  await page.setViewportSize({ width: 320, height: 780 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
