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

  // Data-verification stamp (PLAN §4.6) tells readers how fresh the data is.
  await expect(page.getByText(/Data verified against .* on \d{4}-\d{2}-\d{2}\./)).toBeVisible();
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

test("codex secondary filters are collapsed by default and expand on demand", async ({ page }) => {
  await page.goto("/items");

  // Tier stays visible (primary browse axis); the ~30 other chips start hidden so
  // items are above the fold.
  await expect(page.getByRole("button", { name: "Legendary", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^movement speed$/i })).toHaveCount(0);

  const toggle = page.getByRole("button", { name: /More filters/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();

  // Category chips now available, and filtering by one narrows the grid.
  const chip = page.getByRole("button", { name: /^movement speed$/i });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page.getByRole("button", { name: /Paul's Goat Hoof/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Crowbar/ })).toHaveCount(0);

  // The toggle reports how many hidden filters are active.
  await expect(page.getByRole("button", { name: /Fewer filters/ })).toContainText("1");
});

test("survivor page joins base stats, skills, procs and unlock challenges", async ({ page }) => {
  await page.goto("/survivors");
  await page.getByRole("link", { name: /Commando/ }).click();
  await expect(page).toHaveURL(/\/survivors\/commando$/);

  // Base stats straight from the body prefab, with per-level growth.
  await expect(page.getByRole("row", { name: /Health\s+110/ })).toBeVisible();

  // Skills sit under their real in-game slot, with verified procs.
  await expect(page.getByText("Phase Blast")).toBeVisible();

  // Unlock challenge + requirement are joined in. The requirement is the verbatim
  // ACHIEVEMENT_*_DESCRIPTION from the game, not the wiki's looser paraphrase
  // ("Kill an Overloading Worm.") — the game also scopes it to playing Commando.
  await expect(page.getByText("Rolling Thunder")).toBeVisible();
  await expect(
    page.getByText("As Commando, land the killing blow on an Overloading Worm."),
  ).toBeVisible();

  // Unverified procs must say so, never show a number.
  await expect(page.getByText("proc unverified").first()).toBeVisible();

  // DLC survivors join too — this silently rendered nothing while their names
  // carried a "(SotV)" suffix that never matched survivors.json.
  await page.goto("/survivors/railgunner");
  await expect(page.getByRole("heading", { name: "Railgunner" })).toBeVisible();
  await expect(page.getByText(/Marksman|Cryocharge/).first()).toBeVisible();

  // Unknown ids don't crash.
  await page.goto("/survivors/not-a-survivor");
  await expect(page.getByText(/No survivor called/)).toBeVisible();
});

test("Heretic shows her real item-granted kit, not the placeholder", async ({ page }) => {
  await page.goto("/survivors/heretic");
  await expect(page.getByRole("heading", { name: "Heretic" })).toBeVisible();

  // Real kit from the four Heresy lunar items — never the "Nevermore" placeholder.
  await expect(page.getByText("Hungering Gaze")).toBeVisible();
  await expect(page.getByText("Ruin", { exact: true })).toBeVisible();
  await expect(page.getByText("Visions of Heresy")).toBeVisible();
  await expect(page.getByText(/no fixed kit/)).toBeVisible();
  await expect(page.getByText("Nevermore")).toHaveCount(0);

  // Negative regen growth renders "-1.2/s", not "+-1.2/s".
  await expect(page.getByText("+-", { exact: false })).toHaveCount(0);
});

test("bazaar dreams table is generated from game text, not the 13-row wiki subset", async ({ page }) => {
  await page.goto("/reference");
  await page.getByRole("button", { name: "Bazaar Dreams" }).click();

  // Dreams that only exist in the game's BAZAAR_SEER_* tokens (absent from the
  // wiki-transcribed table this replaced).
  await expect(page.getByText("You dream of clarity.")).toBeVisible();
  await expect(page.getByText("You dream of worms.")).toBeVisible();
  await expect(page.getByRole("row", { name: /Helminth Hatchery/ })).toBeVisible();

  // Verbatim transcription includes the game's own typo — we quote, not correct.
  await expect(page.getByText("You dream of cavernouse depths.")).toBeVisible();
});

test("artifacts reference shows each artifact's icon alongside its code", async ({ page }) => {
  await page.goto("/reference");
  // Artifacts is the default tab. Cards pair the emblem with the Ambry code.
  const commandCard = page.locator("div", { has: page.getByRole("heading", { name: "Artifact of Command" }) }).first();
  await expect(commandCard).toBeVisible();
  const icon = page.locator('img[src*="artifacts/artifact-of-command.png"]');
  await expect(icon).toBeVisible();
});

test("breakpoints tab shows computed, code-verified milestones", async ({ page }) => {
  await page.goto("/reference");
  await page.getByRole("button", { name: "Breakpoints" }).click();

  // Crit reaches exactly 100% at 10 Lens-Maker's Glasses.
  const crit = page.locator("tr", { hasText: "Crit chance" });
  await expect(crit).toContainText("100%");
  await expect(crit).toContainText("11%"); // 1 glass

  // Tougher Times block is the code-verified ConvertAmp curve: 13% @1, 60% @10.
  const tt = page.locator("tr", { hasText: "Tougher Times" });
  await expect(tt).toContainText("13%");
  await expect(tt).toContainText("60%");
  await expect(tt).toContainText("code-verified");

  // Old Guillotine is ~11.5% @1, NOT the 13% tooltip.
  await expect(page.locator("tr", { hasText: "Old Guillotine" })).toContainText("11.5%");
});

test("breakpoints tab shows computed, verified milestone values", async ({ page }) => {
  await page.goto("/reference");
  await page.getByRole("button", { name: "Breakpoints" }).click();

  // Crit: 10 Lens-Maker's Glasses = exactly 100% (the cap).
  const crit = page.locator("tr", { hasText: "Crit chance" });
  await expect(crit).toContainText("100%");

  // Tougher Times block at 10 stacks = 60% (code-verified ConvertAmp(150)).
  const tt = page.locator("tr", { hasText: "Tougher Times" });
  await expect(tt).toContainText("13%"); // 1 stack
  await expect(tt).toContainText("60%"); // 10 stacks
  await expect(tt).toContainText("code-verified");

  // Old Guillotine: 11.5% at one stack, not the 13% tooltip.
  const og = page.locator("tr", { hasText: "Old Guillotine" });
  await expect(og).toContainText("11.5%");
});

test("items are deep-linkable and shareable via /items/<id>", async ({ page }) => {
  // Direct URL opens the drawer for that item (the shareable case).
  await page.goto("/items/crowbar");
  const drawer = page.getByRole("dialog", { name: "Crowbar" });
  await expect(drawer).toBeVisible();

  // Clicking a card puts the item in the URL.
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/items$/);
  await page.getByRole("button", { name: /Tri-Tip Dagger/ }).click();
  await expect(page).toHaveURL(/\/items\/tri-tip-dagger$/);

  // Filter state survives opening an item (list stays mounted under the drawer).
  await page.goto("/items");
  await page.getByRole("searchbox", { name: "Search items" }).fill("bleed");
  await page.getByRole("button", { name: /Tri-Tip Dagger/ }).click();
  await expect(page.getByRole("dialog", { name: "Tri-Tip Dagger" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  // Back on the list, the "bleed" filter is still applied (Crowbar absent).
  await expect(page.getByRole("searchbox", { name: "Search items" })).toHaveValue("bleed");
  await expect(page.getByRole("button", { name: /^Crowbar/ })).toHaveCount(0);
});

test("trailing-slash item URL opens the drawer (production Pages serves /items/<id>/)", async ({ page }) => {
  await page.goto("/items/crowbar/");
  await expect(page.getByRole("dialog", { name: "Crowbar" })).toBeVisible();
});

test("locked items show how to unlock and can be filtered", async ({ page }) => {
  // Detail drawer surfaces the challenge name + the verbatim in-game requirement.
  await page.goto("/items/fuel-cell");
  const drawer = page.getByRole("dialog", { name: "Fuel Cell" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("How to unlock")).toBeVisible();
  await expect(drawer.getByText("Experimenting")).toBeVisible();
  await expect(drawer.getByText("Pick up 5 different types of Equipment.")).toBeVisible();

  // The card carries a lock indicator (accessible label names the challenge).
  await page.goto("/items");
  await expect(
    page.getByLabel(/Locked behind challenge: Experimenting/).first(),
  ).toBeVisible();

  // "Locked only" narrows the grid to challenge-locked items (Crowbar is not one).
  await page.getByRole("checkbox", { name: "Locked only" }).check();
  await expect(page.getByRole("button", { name: /Fuel Cell/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Crowbar/ })).toHaveCount(0);
});

test("run plans are shareable and loadable via URL", async ({ page }) => {
  // Opening a shared link loads that plan into the rail...
  await page.goto("/planner?t=crowbar&a=tri-tip-dagger");
  const rail = page.getByRole("complementary");
  await expect(rail.getByText("Crowbar")).toBeVisible();
  await expect(rail.getByText("Tri-Tip Dagger")).toBeVisible();

  // ...and the query is stripped so a refresh keeps the now-persisted plan.
  await expect(page).toHaveURL(/\/planner$/);
  await page.reload();
  await expect(page.getByRole("complementary").getByText("Crowbar")).toBeVisible();

  // The "Copy link" affordance is enabled once the plan is non-empty.
  await expect(page.getByRole("button", { name: /Copy link/ })).toBeEnabled();

  // Unknown ids in a stale link are dropped rather than showing phantom rows.
  await page.goto("/planner?t=crowbar,not-a-real-item");
  await expect(page.getByRole("complementary").getByText("Crowbar")).toBeVisible();
  await expect(page.getByRole("complementary").getByText("not-a-real-item")).toHaveCount(0);
});
