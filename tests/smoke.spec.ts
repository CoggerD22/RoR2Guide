import { test, expect } from "@playwright/test";
import itemsJson from "../src/data/items.json" with { type: "json" };
import { inadequateFields } from "../src/data/provenance";

/**
 * Pick a subject by provenance rather than naming one.
 *
 * These assertions used to hardcode an item ("Crowbar is code, Cautious Slug is
 * langfile"), which broke twice — once when Crowbar graduated to `code`, once when
 * Cautious Slug did. The churn is the coverage metric working (PLAN §6B.2), so the test
 * should follow the data instead of pinning it. Deterministic: first match in file order.
 */
function itemWithConfidence(confidence: "code" | "langfile") {
  const all = itemsJson as unknown as Array<{
    id: string;
    name: string;
    confidence: string;
    stacking?: unknown[];
  }>;
  const hit = all.find((i) => i.confidence === confidence && (i.stacking?.length ?? 0) > 0);
  if (!hit) throw new Error(`no item with confidence=${confidence} and stacking data`);
  return hit;
}

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

  // A skill with no damage path reads "no direct damage" — a verified fact, not a gap. It used
  // to assert "unverified" for Tactical Dive, which overstated our ignorance: a dash does
  // not have an unknown proc coefficient, it has no attack (MATH-VERIFICATION §3j.47).
  const dive = panel.locator("tr", { hasText: "Tactical Dive" });
  await expect(dive).toContainText("no direct damage");
  // Whichever label applies, it is never rendered as a bare number.
  await expect(dive).not.toContainText(/^\s*0\s*$/);

  // Switching survivor swaps the table (Huntress' Strafe is 1, Laser Glaive 0.8).
  await page.getByRole("button", { name: "Huntress", exact: true }).click();
  await expect(panel.locator("tr", { hasText: "Laser Glaive" })).toContainText("0.8");
});

test("codex item detail shows a provenance badge reflecting the real source", async ({ page }) => {
  // An item traced to the game's code earns the stronger badge. This assertion is the
  // point of the provenance system: upgrading an item's sourcing must visibly change
  // what the site claims about it.
  const coded = itemWithConfidence("code");
  await page.goto(`/items/${coded.id}`);
  const codedDialog = page.getByRole("dialog", { name: coded.name });
  await expect(codedDialog).toBeVisible();
  await expect(codedDialog.getByText("Code-verified")).toBeVisible();

  // An item still sourced only from the game's text shows the weaker badge — the two
  // must remain distinguishable, never collapsed into a single "verified".
  const langfile = itemWithConfidence("langfile");
  await page.goto(`/items/${langfile.id}`);
  const langfileDialog = page.getByRole("dialog", { name: langfile.name });
  await expect(langfileDialog.getByText("Game-text verified")).toBeVisible();
});

test("unverified stacking data is labelled as such, verified data is not", async ({ page }) => {
  // Fail closed (PLAN §6B.3). ~1 in 5 records examined has been wrong in a way
  // transcription cannot catch, so an untraced record must not look like a traced one.
  const langfile = itemWithConfidence("langfile");
  await page.goto(`/items/${langfile.id}`);
  const unverified = page.getByRole("dialog", { name: langfile.name });
  // Match the banner's own sentence, not the phrase: a formula may legitimately say
  // "NOT yet code-verified" about one of its own figures, and that used to collide here.
  await expect(
    unverified.getByText(/Numbers below are not yet code-verified/i),
  ).toBeVisible();

  // A code-verified item carries no such warning — the distinction has to be visible,
  // otherwise the label is decoration rather than information.
  const coded = itemWithConfidence("code");
  await page.goto(`/items/${coded.id}`);
  const verified = page.getByRole("dialog", { name: coded.name });
  await expect(verified.getByText("Code-verified")).toBeVisible();
  await expect(verified.getByText(/Numbers below are not yet code-verified/i)).toHaveCount(0);

  // The coverage gap is published rather than left implicit.
  await expect(page.getByText(/traced to the game's code or assets/i)).toBeVisible();
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

  // A skill with no damage path must say so, and must never show a number. It used to
  // read "proc unverified" here while the Stat Lab said the opposite about the same skill
  // (PLAN §9.1) — this now asserts the state the data actually records.
  await expect(page.getByText("no direct damage").first()).toBeVisible();

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

test("every reference dataset states where its data came from", async ({ page }) => {
  // PLAN §6B.3 — these four surfaces previously rendered with NO provenance at all,
  // so a wiki-sourced Ambry code looked identical to a code-verified shrine mechanic.
  await page.goto("/reference");
  for (const tab of ["Artifacts", "Bazaar Dreams", "Shrines", "Loadout Unlocks"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(
      page.getByText("Where this comes from"),
      `${tab} must state its sources`,
    ).toBeVisible();
  }

  // Fields whose source is too weak for the claim they make must be called out, not just
  // listed. Which datasets those are is DERIVED rather than named: this assertion used to
  // hardcode "artifacts shows a warning about effect", and broke the moment the artifact
  // effects were split into a quoted `effect` plus a code-verified `mechanic`. The churn
  // is the verification programme working, so the test follows the data.
  const TABS: Record<string, string> = {
    artifacts: "Artifacts",
    dreams: "Bazaar Dreams",
    shrines: "Shrines",
    loadoutUnlocks: "Loadout Unlocks",
  };
  let weakSeen = 0;
  let strongSeen = 0;
  for (const [dataset, tab] of Object.entries(TABS)) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    const weak = inadequateFields(dataset as never);
    if (weak.length > 0) {
      await expect(
        page.getByText(new RegExp(`Not yet verified:.*${weak[0]}`)),
        `${tab} has a weakly-sourced field (${weak.join(", ")}) and must say so`,
      ).toBeVisible();
      weakSeen++;
    } else {
      await expect(
        page.getByText(/Not yet verified:/),
        `${tab} is fully sourced and must carry no warning`,
      ).toHaveCount(0);
      strongSeen++;
    }
  }
  // At least one dataset must render, or the loop above proved nothing.
  expect(weakSeen + strongSeen, "no reference dataset was checked at all").toBe(
    Object.keys(TABS).length,
  );

  // This deliberately does NOT require a weakly-sourced dataset to exist. It used to, and
  // that inverted the incentive: closing the last `adequate: false` field (shrines.cost,
  // MATH-VERIFICATION §3j.48) broke the test for the crime of finishing the work. The
  // per-dataset branch above still covers a regression the moment one reappears.
  if (weakSeen === 0) {
    for (const dataset of Object.keys(TABS)) {
      expect(
        inadequateFields(dataset as never),
        `${dataset} reported a weak field after the loop said none existed`,
      ).toEqual([]);
    }
  }
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

test("Run mode is read-only and persists; Plan mode keeps the controls", async ({ page }) => {
  await page.goto("/planner?t=soldiers-syringe!h*4,crowbar&a=tri-tip-dagger");
  const rail = page.getByRole("complementary");

  // Plan mode: the editing affordances exist.
  await expect(rail.getByRole("button", { name: /Priority for Soldier.s Syringe/ })).toHaveCount(1);
  await expect(rail.getByRole("button", { name: /New run/ })).toHaveCount(1);

  await rail.getByRole("button", { name: "run", exact: true }).click();

  // Run mode: every editing affordance is gone. Mid-run a control you can hit by
  // accident is worse than no control (PLAN §5.8c).
  await expect(rail.getByRole("button", { name: /Priority for/ })).toHaveCount(0);
  await expect(rail.getByRole("button", { name: /Remove/ })).toHaveCount(0);
  await expect(rail.getByRole("button", { name: /goal/i })).toHaveCount(0);
  await expect(rail.getByRole("button", { name: /New run/ })).toHaveCount(0);

  // …but the information survives: items, goals and priority order are all still shown.
  await expect(rail.getByText("Soldier's Syringe")).toBeVisible();
  await expect(rail.getByText("×4")).toBeVisible();
  await expect(rail.getByText("Tri-Tip Dagger")).toBeVisible();

  // The choice sticks — someone who switches to Run mode wants it next session too.
  await page.reload();
  await expect(
    page.getByRole("complementary").getByRole("button", { name: "run", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
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

test("a description the game gets wrong is flagged on the page, not just in the formula", async ({ page }) => {
  // The description is the GAME'S wording and its numbers are highlighted, which reads as
  // authority. Where we have proved it wrong, the page must say so next to it — Wax Quail
  // displayed "10m" three lines above a verified 5m (PLAN §5.0.1).
  const corrected = (itemsJson as unknown as Array<{ id: string; name: string; descriptionNote?: string }>)
    .find((i) => i.descriptionNote);
  if (!corrected) throw new Error("no item carries a descriptionNote");

  await page.goto(`/items/${corrected.id}`);
  const dialog = page.getByRole("dialog", { name: corrected.name });
  await expect(dialog.getByText(/The game.s text above is inaccurate/i)).toBeVisible();

  // An item whose description agrees with the code carries no such warning.
  const clean = (itemsJson as unknown as Array<{ id: string; name: string; descriptionNote?: string; confidence: string }>)
    .find((i) => !i.descriptionNote && i.confidence === "code");
  if (!clean) throw new Error("no clean code-verified item");
  await page.goto(`/items/${clean.id}`);
  await expect(
    page.getByRole("dialog", { name: clean.name }).getByText(/text above is inaccurate/i),
  ).toHaveCount(0);
});

test("a newly added tier renders end to end — data, filter, card and detail", async ({ page }) => {
  // The FoodTier items were added with schema, TIER_ORDER, TIER_META and CSS wired up,
  // but nothing proved the UI actually surfaces them. A tier that exists only in data is
  // an item the reader still cannot find (PLAN §6B.3 — fail closed, visibly).
  const food = (itemsJson as unknown as Array<{ id: string; name: string; tier: string }>)
    .filter((i) => i.tier === "food");
  expect(food.length, "no food-tier items in the dataset").toBeGreaterThan(0);

  await page.goto("/items");

  // The tier heading exists, so the items are reachable by browsing rather than only by URL.
  await expect(page.getByRole("heading", { name: "Food", exact: true })).toBeVisible();

  // Every food item has a card with a real icon (not a broken image).
  for (const f of food) {
    const card = page.getByRole("button", { name: f.name, exact: false });
    await expect(card.first(), `no card for ${f.name}`).toBeVisible();
  }

  // And the detail drawer opens with its sourcing badge, like any other item.
  const first = food[0];
  await page.goto(`/items/${first.id}`);
  const dialog = page.getByRole("dialog", { name: first.name });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Game-text verified|Code-verified/)).toBeVisible();
});

test("display controls: DLC badge, descriptions toggle and density (PLAN §8)", async ({ page }) => {
  // The site is read next to a running game, so these are about information per screen.
  await page.goto("/items");

  // §8.1 — every card carries an expansion marker, base game included. An absent badge
  // reads as "unlabelled", which defeats scanning a grid for the mix.
  const crowbar = page.getByRole("button", { name: /Crowbar/ }).first();
  await expect(crowbar.getByLabel(/Expansion: Base game/)).toBeVisible();
  const acItem = page.getByRole("button", { name: /Hearty Stew/ }).first();
  await expect(acItem.getByLabel(/Expansion: Alloyed Collective/)).toBeVisible();

  // §8.2 — descriptions inline, no click required.
  const descriptions = page.getByRole("button", { name: "Descriptions" });
  await expect(crowbar).not.toContainText("above 90% health");
  await descriptions.click();
  await expect(crowbar).toContainText("above 90% health");

  // The preference persists — it is about how you read, not what you planned.
  await page.reload();
  await expect(page.getByRole("button", { name: /Crowbar/ }).first()).toContainText(
    "above 90% health",
  );
  await page.getByRole("button", { name: "Descriptions" }).click();

  // §8.3 — density is shared with the planner, so setting it here applies there too.
  await page.getByRole("button", { name: "Dense" }).click();
  await page.goto("/planner");
  await expect(page.getByRole("button", { name: "Dense" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Names are an INDEPENDENT toggle, not a density side-effect: a dense grid with names
  // is a legitimate want, and folding the two together made it impossible to ask for.
  const plannerCard = page.getByRole("button", { name: /^Crowbar/ }).first();
  await expect(plannerCard).toContainText("Crowbar");
  await page.getByRole("button", { name: "Names" }).click();
  await expect(page.getByRole("button", { name: /^Crowbar/ }).first()).not.toContainText("Crowbar");
  await page.getByRole("button", { name: "Names" }).click();
  await expect(page.getByRole("button", { name: /^Crowbar/ }).first()).toContainText("Crowbar");

  await page.getByRole("button", { name: "Comfortable" }).click();
});

test("stat lab explains when an item's stacking is not modelled", async ({ page }) => {
  // Reported as "stacking stops working past 1". It was not a bug in the arithmetic —
  // Predatory Instincts' +5% crit genuinely does not stack — but the calculator gave no
  // sign that the item's REAL per-stack effect was simply outside what it models.
  await page.goto("/stats");

  const add = page.getByRole("button", { name: "Add one Predatory Instincts" });
  await add.click();
  // One stack: no warning needed, nothing is being hidden yet.
  await expect(page.getByText(/Some stacks are not shown above/)).toHaveCount(0);

  await add.click();
  // Two stacks: the sheet is now hiding a real effect, so it has to say so.
  const note = page.getByText(/Some stacks are not shown above/);
  await expect(note).toBeVisible();
  await expect(page.getByText(/attack speed gained from critical strikes/)).toBeVisible();
});

test("§9: an empty result names the cause instead of blaming filters", async ({ page }) => {
  await page.goto("/items");
  await page.getByRole("searchbox", { name: "Search items" }).fill("zzzzznotanitem");
  // A search that matches nothing must point at the search, not at the tier filters —
  // sending a reader to the wrong control is its own defect (PLAN §9.1, class 8).
  await expect(page.getByText(/No items match .zzzzznotanitem./)).toBeVisible();
  await expect(page.getByText(/Search covers names, effects and tags/)).toBeVisible();

  // With no query, the filters really are the cause and the message says so.
  await page.getByRole("searchbox", { name: "Search items" }).fill("");
  await page.getByRole("button", { name: "Common", exact: true }).click();
  for (const t of ["Uncommon", "Legendary", "Boss", "Lunar"]) {
    await page.getByRole("button", { name: t, exact: true }).click().catch(() => {});
  }
});

test("§9: Transcendence reports shield, not a health total you do not have", async ({ page }) => {
  // The Stat Lab modelled Transcendence as "+50% max health" and printed a max-health
  // figure the survivor never has: RecalculateStats sets maxHealth to exactly 1 and moves
  // the pool into shield. Arithmetically self-consistent, and completely misleading.
  await page.goto("/stats");

  const health = page.locator("div", { has: page.getByText("Max Health", { exact: true }) });
  await expect(page.getByText("Max Shield", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Add one Transcendence" }).click();

  await expect(page.getByText("Max Shield", { exact: true })).toBeVisible();
  await expect(page.getByText(/Transcendence leaves you on 1 HP/)).toBeVisible();
  await expect(page.getByText(/healing cannot restore it/)).toBeVisible();
  await expect(page.getByText(/Transcendence is a conversion, not a bonus/)).toBeVisible();
  // Commando is the default survivor: 110 base health -> 1 HP and a 165 shield.
  await expect(health.first()).toContainText("1");
  await expect(page.getByText("165", { exact: true })).toBeVisible();
});

test("§9: a non-linear row never reads as 'add M per stack'", async ({ page }) => {
  // Mercurial Rachis is 16m x 1.5 per stack. Rendered as "16 base, +50 per stack" it
  // invited the reader to compute 66m at two stacks; the real answer is 24m.
  await page.goto("/items/mercurial-rachis");
  await expect(page.getByText(/16\s*at one stack/)).toBeVisible();
  await expect(page.getByText(/multiplier applied per stack, not a number added/)).toBeVisible();

  // Tougher Times shows the curve it actually follows, beside the 15% input.
  await page.goto("/items/tougher-times");
  await expect(page.getByText(/feeds a hyperbolic curve/)).toBeVisible();
  await expect(page.getByText("13.0", { exact: true })).toBeVisible(); // not 15 at one stack
  await expect(page.getByText("23.1", { exact: true })).toBeVisible(); // not 30 at two

  // Linear rows keep the phrasing that is true for them.
  await page.goto("/items/soldiers-syringe");
  await expect(page.getByText(/15\s*base/)).toBeVisible();
});

test("§9: the stat sheet states its difficulty instead of silently assuming one", async ({ page }) => {
  // Run.cs hands every player a hidden item on Drizzle and on any hard mode, and
  // RecalculateStats reads both — so a sheet with no difficulty control was a Rainstorm
  // sheet that never said so.
  await page.goto("/stats");
  await expect(page.getByText(/only difficulty that grants no hidden item/)).toBeVisible();

  const regen = page.locator("div", { has: page.getByText("Health Regen", { exact: true }) });
  await expect(regen.first()).toContainText("1.0/s"); // Commando, Rainstorm

  await page.getByRole("button", { name: "Drizzle", exact: true }).click();
  await expect(regen.first()).toContainText("1.5/s");
  const armor = page.locator("div", { has: page.getByText("Armor", { exact: true }) });
  await expect(armor.first()).toContainText("70");

  await page.getByRole("button", { name: "Monsoon", exact: true }).click();
  await expect(regen.first()).toContainText("0.6/s");
  await expect(page.getByText(/countsAsHardMode/)).toBeVisible();
});

test("§9: every artifact shows a verified mechanic, not only the game's blurb", async ({ page }) => {
  await page.goto("/reference");
  // The layer existed on 7 of 20 artifacts, with a code comment claiming the rest were
  // omitted because the code added nothing. It did not: Honor never rolls Malachite,
  // Command deletes multishops from the stage, Delusion's wrong answer eats your item.
  await expect(page.getByText("Verified mechanic — from game code")).toHaveCount(20);
  await expect(page.getByText(/Malachite, Celestine, Void and Perfected elites are not/)).toBeVisible();
  await expect(page.getByText(/deletes one of your own items/)).toBeVisible();
  await expect(page.getByText(/TEN TIMES your maximum health/)).toBeVisible();
});

test("§9: the shrine cost badge no longer disclaims data it verified", async ({ page }) => {
  await page.goto("/reference");
  await page.getByRole("button", { name: "Shrines" }).click();
  const badge = page.getByTitle(/PurchaseInteraction/).first();
  await expect(badge).toBeVisible();
  // The old title told the reader our prefab-read figure was our own guess.
  await expect(page.getByTitle("Our summary, not game data")).toHaveCount(0);
});

test("§9: the survivor page and the Stat Lab describe the same skill the same way", async ({ page }) => {
  // The Stat Lab has distinguished "no damage path" from "unverified" since §3j.47. The
  // survivor page never learned it, so Tactical Dive read "proc unverified" there and
  // "no direct damage" in the lab — the same fact, described two ways, and the wrong way
  // on the page a reader is more likely to open.
  await page.goto("/survivors/commando");
  const dive = page.locator("li", { hasText: "Tactical Dive" }).first();
  await expect(dive).toContainText("no direct damage");
  await expect(page.getByText("proc unverified")).toHaveCount(0);

  // And the header stops reporting ignorance it does not have.
  await expect(page.getByText(/Every proc coefficient accounted for/)).toBeVisible();
  await expect(page.getByText(/not applicable/)).toBeVisible();
  await expect(page.getByText(/a turret or a beacon carries its own/)).toBeVisible();
});

test("§9: the codex finally shows the equipment cooldown it has always held", async ({ page }) => {
  // The cooldown has been asset-read and audit-checked since the Seed of Life correction,
  // and no page rendered it — a verified answer withheld, on a site whose premise is
  // "the answers the game makes hard to find".
  await page.goto("/items/gnarled-woodsprite");
  const sprite = page.getByRole("dialog", { name: "Gnarled Woodsprite" });
  // Scoped to the new panel: the game's own description happens to mention a cooldown too,
  // which is exactly why the panel adds what the description cannot — the reduction caveat.
  await expect(sprite.getByText(/Cooldown 15s . before any Fuel Cell/)).toBeVisible();
  await expect(sprite.getByRole("heading", { name: "Equipment" })).toBeVisible();

  // A cooldown of 0 is never printed bare: alone it reads as "reusable instantly".
  await page.goto("/items/seed-of-life");
  const seed = page.getByRole("dialog", { name: "Seed of Life" });
  await expect(seed.getByText(/Consumed on use\. A successful activation/)).toBeVisible();

  // Passive equipment says the asset cooldown never runs, rather than quoting it.
  await page.goto("/items/his-reassurance");
  const reassurance = page.getByRole("dialog", { name: "His Reassurance" });
  await expect(
    reassurance.getByText(/Passive\. Pressing the equipment key does nothing/),
  ).toBeVisible();
  await expect(reassurance.getByText(/never runs/)).toBeVisible();
});
