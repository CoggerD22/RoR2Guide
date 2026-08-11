import { test, expect } from "@playwright/test";

/**
 * §3j.142 — the heading outline, on every route and every tab panel.
 *
 * Heading navigation is how a screen-reader user skims a page. The drawer fix in §3j.141 only
 * helped someone already inside a dialog; this is the level above it. A broken outline is
 * invisible on screen and complete nonsense to a screen reader, which is exactly the class of
 * defect that survives visual review forever.
 *
 * `/reference` is TABBED — one of five panels renders at a time — so visiting the route once
 * inspects a fifth of it. The first version of this audit did exactly that: it reported 106
 * headings and 1 problem. Walking every panel found 146 headings and 4. The denominator was
 * wrong before the finding was.
 */
const ROUTES: Array<[string, string, string[]]> = [
  ["/", "index", []],
  ["/items", "codex", []],
  ["/items/crowbar", "codex + item drawer", []],
  ["/planner", "run planner", []],
  ["/stats", "stat lab", []],
  [
    "/reference",
    "reference",
    ["Artifacts", "Bazaar Dreams", "Shrines", "Loadout Unlocks", "Breakpoints"],
  ],
  ["/survivors", "survivors", []],
  ["/survivors/commando", "survivor detail", []],
];

test("every page has exactly one h1 and never skips a heading level", async ({ page }) => {
  const problems: string[] = [];
  let panelsChecked = 0;
  let headingsInspected = 0;

  for (const [path, label, tabs] of ROUTES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    for (const tab of tabs.length ? tabs : [null]) {
      if (tab) await page.getByRole("button", { name: tab, exact: true }).click();
      const where = `${label}${tab ? ` [${tab}]` : ""}`;

      const heads = await page.evaluate(() =>
        Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
          .filter(
            (h) =>
              h.closest("[aria-hidden='true']") === null &&
              // sr-only headings are positioned, so they still have an offsetParent and
              // still belong to the outline — which is the point of using it here.
              (h as HTMLElement).offsetParent !== null,
          )
          .map((h) => ({ level: Number(h.tagName.slice(1)), text: (h.textContent ?? "").trim().slice(0, 40) })),
      );

      panelsChecked++;
      headingsInspected += heads.length;

      const h1s = heads.filter((h) => h.level === 1);
      if (h1s.length !== 1) {
        problems.push(`${where}: expected exactly one h1, found ${h1s.length}`);
      }
      for (let i = 1; i < heads.length; i++) {
        if (heads[i].level - heads[i - 1].level > 1) {
          problems.push(
            `${where}: outline skips h${heads[i - 1].level} -> h${heads[i].level} at "${heads[i].text}"`,
          );
        }
      }
    }
  }

  // Denominator, per the standing rule: a run that inspected nothing must not look like a pass.
  expect(panelsChecked, "panels visited").toBeGreaterThanOrEqual(12);
  expect(headingsInspected, "headings inspected").toBeGreaterThanOrEqual(140);
  expect(problems, problems.join("\n  ")).toEqual([]);
});

/**
 * The reference tabs are plain buttons, not the ARIA tabs pattern — deliberately, since
 * role="tab" promises arrow-key navigation this control does not implement. What they must
 * do is announce which one is active, exactly as the codex filter Chips already do.
 */
test("the reference tabs announce which panel is showing", async ({ page }) => {
  await page.goto("/reference");
  const tabs = ["Artifacts", "Bazaar Dreams", "Shrines", "Loadout Unlocks", "Breakpoints"];
  let checked = 0;

  for (const name of tabs) {
    await page.getByRole("button", { name, exact: true }).click();
    for (const other of tabs) {
      const btn = page.getByRole("button", { name: other, exact: true });
      await expect(btn).toHaveAttribute("aria-pressed", other === name ? "true" : "false");
      checked++;
    }
  }
  expect(checked, "tab states asserted").toBe(tabs.length * tabs.length);
});
