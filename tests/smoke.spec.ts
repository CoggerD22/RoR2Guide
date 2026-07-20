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

test("planner: cycling a card fills the run plan rail and persists a reload", async ({ page }) => {
  await page.goto("/planner");
  await expect(page.getByRole("heading", { name: "Run Planner" })).toBeVisible();

  // Cycle Crowbar to "targeted".
  await page.getByRole("button", { name: /^Crowbar: neutral/ }).click();

  // The Run Plan rail now lists Crowbar.
  const rail = page.getByRole("complementary");
  await expect(rail.getByText("Crowbar")).toBeVisible();

  // Plan survives a reload (localStorage persistence).
  await page.reload();
  await expect(page.getByRole("complementary").getByText("Crowbar")).toBeVisible();

  // "New run" clears it.
  await page.getByRole("button", { name: "New run" }).click();
  await expect(page.getByRole("complementary").getByText("Crowbar")).toHaveCount(0);
});

test("stat lab computes stats and reacts to items", async ({ page }) => {
  await page.goto("/stats");
  await expect(page.getByRole("heading", { name: "Stat Lab" })).toBeVisible();

  // Commando at level 1 has 110 max health.
  await expect(page.getByText("110", { exact: true }).first()).toBeVisible();

  // Adding a Bison Steak (+25 flat HP) bumps it to 135.
  await page.getByRole("button", { name: "Add one Bison Steak" }).click();
  await expect(page.getByText("135", { exact: true }).first()).toBeVisible();
});

test("stat lab shows verified proc coefficients and marks unverified honestly", async ({ page }) => {
  await page.goto("/stats");

  const panel = page.locator("section", { has: page.getByText("Proc coefficients") });
  await expect(panel).toBeVisible();

  // Commando's verified values, straight from the game's own assets/code:
  // Phase Blast 0.5 (skill config) and Double Tap 1 (attack default).
  const phaseBlast = panel.locator("tr", { hasText: "Phase Blast" });
  await expect(phaseBlast).toContainText("0.5");
  const doubleTap = panel.locator("tr", { hasText: "Double Tap" });
  await expect(doubleTap).toContainText("1");

  // Unverified skills must read "unverified" — never a number, never 0.
  const dive = panel.locator("tr", { hasText: "Tactical Dive" });
  await expect(dive).toContainText("unverified");

  // Switching survivor swaps the table (Huntress' Strafe is 1, Laser Glaive 0.8).
  await page.getByRole("button", { name: "Huntress", exact: true }).click();
  await expect(panel.locator("tr", { hasText: "Laser Glaive" })).toContainText("0.8");
});

test("codex item detail shows a provenance badge", async ({ page }) => {
  await page.goto("/items");
  // Crowbar's numbers come from the game's language files.
  await page.getByRole("button", { name: /Crowbar/ }).first().click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Game-text verified")).toBeVisible();
});
