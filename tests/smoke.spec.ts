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

test("codex item detail shows a provenance badge reflecting the real source", async ({ page }) => {
  // Crowbar's stacking is traced to HealthComponent (1f + 0.75f * n), so it earns the
  // stronger badge. This assertion is the point of the provenance system: upgrading an
  // item's sourcing must visibly change what the site claims about it.
  await page.goto("/items/crowbar");
  const crowbar = page.getByRole("dialog", { name: "Crowbar" });
  await expect(crowbar).toBeVisible();
  await expect(crowbar.getByText("Code-verified")).toBeVisible();

  // An item still sourced only from the game's text shows the weaker badge — the two
  // must remain distinguishable, never collapsed into a single "verified".
  await page.goto("/items/tri-tip-dagger");
  const triTip = page.getByRole("dialog", { name: "Tri-Tip Dagger" });
  await expect(triTip.getByText("Game-text verified")).toBeVisible();
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

test("Drifter's alternate skills are listed, not falsely reported as a fixed kit", async ({ page }) => {
  await page.goto("/reference");
  await page.getByRole("button", { name: "Loadout Unlocks" }).click();

  // Drifter has 3 alternates in the game's SkillFamily data; the table previously
  // showed "Fixed kit" for him, which was a false positive claim.
  const drifter = page.locator("section", { has: page.getByRole("heading", { name: "Drifter" }) });
  await expect(drifter.getByText("Junk Cube")).toBeVisible();
  await expect(drifter.getByText("Tornado Slam")).toBeVisible();
  await expect(drifter.getByText("Tinker")).toBeVisible();
  await expect(drifter.getByText("Drifter: Trash Compactor")).toBeVisible();
  await expect(drifter.getByText("As Drifter, carry 20 temporary items at once.")).toBeVisible();
  await expect(drifter.getByText(/Fixed kit/)).toHaveCount(0);

  // Void Fiend genuinely has none — "fixed kit" must still be sayable when it's true.
  const voidFiend = page.locator("section", {
    has: page.getByRole("heading", { name: "Void Fiend" }),
  });
  await expect(voidFiend.getByText(/Fixed kit/)).toBeVisible();
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

  // Crowbar IS challenge-locked ("The Basics" — discover 10 unique white items),
  // verified via ItemDef.unlockableDef -> [RegisterAchievement] -> ACHIEVEMENT_*.
  // It was previously shown as freely available.
  await page.goto("/items/crowbar");
  const cb = page.getByRole("dialog", { name: "Crowbar" });
  await expect(cb.getByText("The Basics")).toBeVisible();
  await expect(cb.getByText("Discover 10 unique white items.")).toBeVisible();

  // "Locked only" keeps locked items and drops unlocked ones (Bison Steak is free).
  await page.goto("/items");
  await page.getByRole("checkbox", { name: "Challenge-locked only" }).check();
  await expect(page.getByRole("button", { name: /Fuel Cell/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Bison Steak/ })).toHaveCount(0);
});

test("every challenge-locked item renders a lock, across all tiers", async ({ page }) => {
  await page.goto("/items");
  // Reported missing in real use. Both are code-verified as gated, and they sit in
  // tiers (lunar / legendary) whose card styling differs from the commons — so this
  // pins that the lock isn't lost for a subset of tiers.
  for (const { name, challenge } of [
    { name: "Gesture of the Drowned", challenge: "The Demons And The Crabs" },
    { name: "N'kuhana's Opinion", challenge: "Her Concepts" },
    { name: "Crowbar", challenge: "The Basics" },
  ]) {
    await expect(
      page.getByLabel(`Locked behind challenge: ${challenge}`),
      `${name} should show a lock badge`,
    ).toHaveCount(1);
  }

  // Count check: the number of lock badges equals the number of locked items shown.
  const locks = await page.getByLabel(/^Locked behind challenge:/).count();
  expect(locks).toBeGreaterThan(30);
});

test("planner lock badge sits INSIDE its card, not in the grid gap", async ({ page }) => {
  // Regression: the badge was `bottom`-anchored and the grid cell stretches to the
  // tallest card in the row, so it rendered ~8px BELOW the card — present in the DOM,
  // counted by every existing assertion, and invisible as a marker. Only geometry
  // catches this class of bug.
  await page.goto("/planner");
  const card = page.getByRole("button", { name: /^Crowbar/ }).first();
  await card.scrollIntoViewIfNeeded();
  const cardBox = (await card.boundingBox())!;
  const badgeBox = (await page
    .getByLabel(/Locked behind challenge: The Basics/)
    .first()
    .boundingBox())!;

  expect(badgeBox.y).toBeGreaterThanOrEqual(cardBox.y);
  expect(badgeBox.y + badgeBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height);
  expect(badgeBox.x).toBeGreaterThanOrEqual(cardBox.x);
  expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
});

test("locked items surface their unlock in the planner and on hover", async ({ page }) => {
  // The planner shows locks too — planning around an item you can't obtain is wasted.
  await page.goto("/planner");
  await expect(
    page.getByLabel(/Locked behind challenge: The Basics/).first(),
  ).toBeVisible();

  // Hovering a locked card surfaces the challenge + requirement in the tooltip.
  await page.goto("/items");
  await page.getByRole("button", { name: /^Crowbar/ }).first().hover();
  await expect(page.getByText("Discover 10 unique white items.").first()).toBeVisible();
});

test("planner: priority and goal are settable and ranked within tier", async ({ page }) => {
  await page.goto("/planner");
  const rail = page.getByRole("complementary");

  // Target two whites; the rail lists them under their tier.
  await page.getByRole("button", { name: /^Soldier's Syringe: neutral/ }).click();
  await page.getByRole("button", { name: /^Crowbar: neutral/ }).click();
  await expect(rail.getByText("Soldier's Syringe")).toBeVisible();

  // Rank Soldier's Syringe High and give it a goal — the real printer question is
  // "which white do I want most?", so ranking is per tier.
  // Priority is one cycling button (high → medium → low) starting at medium, so two
  // clicks reach high. The goal is inline click-to-edit, not a permanent input.
  const prio = rail.getByRole("button", { name: /Priority for Soldier.s Syringe/ });
  await prio.click();
  await prio.click();
  await expect(prio).toHaveAccessibleName(/: High\./);
  await rail.getByRole("button", { name: /Set a goal count for Soldier.s Syringe/ }).click();
  const goalInput = rail.getByLabel("Goal stack count for Soldier's Syringe");
  await goalInput.fill("4");
  await goalInput.press("Enter");
  await expect(rail.getByText("×4")).toBeVisible();

  // High-priority item sorts above the medium-priority one inside the tier.
  const names = await rail.locator("li span.truncate").allTextContents();
  expect(names.indexOf("Soldier's Syringe")).toBeLessThan(names.indexOf("Crowbar"));

  // Survives a reload (persisted).
  await page.reload();
  const rail2 = page.getByRole("complementary");
  await expect(rail2.getByText("×4")).toBeVisible();
  await expect(
    rail2.getByRole("button", { name: /Priority for Soldier.s Syringe/ }),
  ).toHaveAccessibleName(/: High\./);
});

test("planner states hard caps as fact, and flags a goal that exceeds one", async ({ page }) => {
  // Focused Convergence is code-verified capped at 3 (HoldoutZoneController cap = 3).
  await page.goto("/planner?t=focused-convergence");
  const rail = page.getByRole("complementary");
  // The cap now surfaces only when it changes a decision — i.e. when a goal exceeds it —
  // rather than sitting on every capped row as permanent noise.
  await rail.getByRole("button", { name: /Set a goal count for Focused Convergence/ }).click();
  const capGoal = rail.getByLabel("Goal stack count for Focused Convergence");
  await capGoal.fill("5");
  await capGoal.press("Enter");
  await expect(rail.getByText("caps at 3")).toBeVisible();

  // An item whose cap SCALES with stacks must show no fixed number: Hiker's Boots
  // caps its buff at 10 × item count, so claiming a single ceiling would be false.
  await page.goto("/planner?t=hikers-boots");
  const rail2 = page.getByRole("complementary");
  await expect(rail2.getByText("Hiker's Boots")).toBeVisible();
  await expect(rail2.getByText(/^cap \d/)).toHaveCount(0);
});

test("a long run plan stays reachable — the rail scrolls instead of overflowing", async ({
  page,
}) => {
  // Regression (PLAN §5.8c): the rail is sticky, so once it grew taller than the
  // viewport its bottom became unreachable — page scroll ends, rail doesn't scroll.
  // 26 targeted items measured 1541px in a 900px viewport. Count assertions passed
  // the whole time; only geometry catches it.
  // Enough items to overflow. The count went UP when the rail was redesigned: rows
  // dropped from 51px to 28px (PLAN §5.8b Part 1 revision), so 18 items no longer
  // overflow at all — which is the improvement working, not the test being wrong.
  await page.setViewportSize({ width: 1280, height: 900 });
  const ids = [
    "crowbar", "soldiers-syringe", "lens-makers-glasses", "tougher-times", "bison-steak",
    "pauls-goat-hoof", "monster-tooth", "gasoline", "medkit", "sticky-bomb",
    "stun-grenade", "topaz-brooch", "tri-tip-dagger", "roll-of-pennies", "power-elixir",
    "personal-shield-generator", "repulsion-armor-plate", "backup-magazine",
    "armor-piercing-rounds", "bundle-of-fireworks", "cautious-slug", "energy-drink",
    "focus-crystal", "warbanner", "paul-s-goat-hoof", "delicate-watch", "rusted-key",
    "atg-missile-mk-1", "ukulele", "will-o-the-wisp", "infusion", "harvesters-scythe",
    "predatory-instincts", "leeching-seed", "red-whip", "fuel-cell", "hopoo-feather",
    "berzerkers-pauldron", "old-guillotine", "war-horn", "brainstalks", "wax-quail",
  ];
  await page.goto(`/planner?t=${ids.join(",")}`);
  const rail = page.getByRole("complementary");
  await expect(rail).toBeVisible();

  const fitsViewport = await rail.evaluate(
    (el) => el.getBoundingClientRect().height <= window.innerHeight,
  );
  expect(fitsViewport, "rail must not exceed the viewport height").toBe(true);

  // And its content is reachable by scrolling the rail itself.
  const scrolled = await rail.evaluate((el) => {
    const overflows = el.scrollHeight > el.clientHeight;
    el.scrollTop = el.scrollHeight;
    return { overflows, scrollTop: el.scrollTop };
  });
  expect(scrolled.overflows, "this plan should overflow the rail").toBe(true);
  expect(scrolled.scrollTop, "rail must scroll internally").toBeGreaterThan(0);
});

test("shared links carry priority and goal, and old links still work", async ({ page }) => {
  // New-format link.
  await page.goto("/planner?t=soldiers-syringe!h*4,crowbar!l");
  const rail = page.getByRole("complementary");
  await expect(rail.getByText("×4")).toBeVisible();
  await expect(
    rail.getByRole("button", { name: /Priority for Soldier.s Syringe/ }),
  ).toHaveAccessibleName(/: High\./);

  // Old-format link (bare ids) must still load — shared plans predate this feature.
  await page.goto("/planner?t=crowbar&a=tri-tip-dagger");
  const rail2 = page.getByRole("complementary");
  await expect(rail2.getByText("Crowbar")).toBeVisible();
  await expect(rail2.getByText("Tri-Tip Dagger")).toBeVisible();
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
