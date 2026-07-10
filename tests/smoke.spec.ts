import { test, expect } from "@playwright/test";

test("app shell renders, redirects to codex, and shows the disclaimer", async ({ page }) => {
  await page.goto("/");

  // `/` redirects to the codex.
  await expect(page).toHaveURL(/\/items$/);

  // Primary nav is present with all four sections.
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav).toBeVisible();
  for (const label of ["Item Codex", "Run Planner", "Stat Lab", "Reference"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }

  // Non-affiliation disclaimer must be present (CLAUDE.md rule #6).
  await expect(
    page.getByText(/Not affiliated with Gearbox Publishing or Hopoo Games/i),
  ).toBeVisible();
});

test("navigating to the planner updates the route", async ({ page }) => {
  await page.goto("/items");
  await page.getByRole("link", { name: "Run Planner" }).click();
  await expect(page).toHaveURL(/\/planner$/);
  await expect(page.getByRole("heading", { name: "Run Planner" })).toBeVisible();
});

test("codex renders items, searches by tag, and opens the detail drawer", async ({ page }) => {
  await page.goto("/items");
  await expect(page.getByRole("heading", { name: "Item Codex" })).toBeVisible();

  // A known white item card is present.
  await expect(page.getByRole("button", { name: /Crowbar/ })).toBeVisible();

  // Fuzzy search by a tag ("bleed" should surface Tri-Tip Dagger).
  await page.getByRole("searchbox", { name: "Search items" }).fill("bleed");
  const triTip = page.getByRole("button", { name: /Tri-Tip Dagger/ });
  await expect(triTip).toBeVisible();
  await expect(page.getByRole("button", { name: /Crowbar/ })).toHaveCount(0);

  // Clicking a card opens the detail drawer.
  await triTip.click();
  const drawer = page.getByRole("dialog", { name: "Tri-Tip Dagger" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(/View on wiki\.gg/)).toBeVisible();
});
