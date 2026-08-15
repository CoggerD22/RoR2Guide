import { test, expect } from "@playwright/test";

/**
 * §3j.146 — the failure paths, in a real browser.
 *
 * Every check before this one exercised the success path. These ask the opposite question:
 * what does a user SEE when something is wrong? A bad URL, a stale link, a plan blob left over
 * from another build or hand-edited in dev tools.
 *
 * These live in Playwright rather than vitest on purpose. The store's sanitiser was already
 * correct and already unit-tested; the bug was that zustand never called it, because `migrate`
 * only runs on a version MISMATCH. Only a test that goes through real persist wiring with real
 * localStorage could have caught that, and the pure-function suite had instead "proved" the v2
 * path by calling `migrate(data, 2)` directly — a call the library never makes.
 */

const KEY = "ror2-run-plan";
const v2 = (plan: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ state: { plan, ...extra }, version: 2 });

test.describe("a corrupted plan never reaches the screen", () => {
  /**
   * The value that actually rendered: localStorage holding a goal of 1e20 put
   * "×100000000000000000000" in the rail — the exact number MIN_GOAL/MAX_GOAL exist to stop,
   * arriving by the one route nothing validated.
   */
  test("an out-of-range goal from storage is not rendered", async ({ page }) => {
    await page.addInitScript(
      ([k, v]) => localStorage.setItem(k, v),
      [KEY, v2({ crowbar: { state: "targeted", priority: "high", goal: 1e20 } })] as const,
    );
    await page.goto("/planner");
    await expect(page.getByRole("button", { name: /Click to cycle target/ }).first()).toBeVisible();

    await expect(page.getByRole("button", { name: /^Goal: / })).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toContain("100000000000000000000");
  });

  test("an unknown priority still renders a real priority label", async ({ page }) => {
    // "ULTRA" is absent from PRIORITY_LABEL, so the rail showed a targeted item with no
    // priority at all — which reads as a broken app rather than bad stored data.
    await page.addInitScript(
      ([k, v]) => localStorage.setItem(k, v),
      [KEY, v2({ crowbar: { state: "targeted", priority: "ULTRA" } })] as const,
    );
    await page.goto("/planner");
    const rail = page.locator("aside").first();
    await expect(rail).toContainText("Crowbar");
    await expect(rail, "no priority label rendered for a corrupted priority").toContainText(
      /High|Medium|Low/,
    );
  });

  for (const [label, blob] of [
    ["an entry that is a bare number", v2({ crowbar: 42 })],
    ["an entry that is null", v2({ crowbar: null })],
    ["a plan that is an array", v2([1, 2, 3])],
    ["a plan that is a string", v2("hello")],
    ["a railMode outside the two it can render", v2({}, { railMode: "wat" })],
    ["a top-level blob that is not JSON", "{{{ not json at all"],
    ["a top-level value that is not an object", '"just a string"'],
  ] as const) {
    test(`the planner still loads with ${label}`, async ({ page }) => {
      const thrown: string[] = [];
      page.on("pageerror", (e) => thrown.push(String(e).split("\n")[0]));
      await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, blob] as const);
      await page.goto("/planner");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Run Planner/);
      expect(thrown, `threw: ${thrown[0]}`).toEqual([]);
    });
  }

  test("a legacy v1 plan still migrates", async ({ page }) => {
    // The fix must not break the path that already worked.
    await page.addInitScript(
      ([k, v]) => localStorage.setItem(k, v),
      [KEY, JSON.stringify({ state: { plan: { crowbar: "targeted" } }, version: 1 })] as const,
    );
    await page.goto("/planner");
    await expect(page.locator("aside").first()).toContainText("Crowbar");
  });
});

test.describe("a bad URL says so", () => {
  for (const path of ["/nonsense", "/reference/nope", "/planner/extra"]) {
    test(`${path} renders a real 404`, async ({ page }) => {
      await page.goto(path);
      // Was the bare string "Not Found" — TanStack's built-in default, with no heading, no
      // styling and no way back.
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1, `${path} has no h1`).toHaveCount(1);
      await expect(h1).toHaveText(/not found/i);
      await expect(
        page.getByRole("link", { name: /Back to the item codex/ }),
        "a 404 with no way out",
      ).toBeVisible();
      // The shell must survive, or "go somewhere else" is not actually offered.
      await expect(page.getByRole("navigation").first()).toBeVisible();
    });
  }

  test("an unknown item id says so instead of showing the whole codex", async ({ page }) => {
    await page.goto("/items/not-a-real-item");
    // Rendered byte-for-byte like /items before: ItemDetail returns null with no item, so a
    // stale link told the user their item did not exist by showing 217 that were not it.
    const panel = page.getByRole("dialog", { name: "Item not found" });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("not-a-real-item");
    await page.getByRole("button", { name: "Back to the codex" }).click();
    await expect(page).toHaveURL(/\/items$/);
  });

  test("a real item id still opens the drawer", async ({ page }) => {
    await page.goto("/items/crowbar");
    await expect(page.getByRole("dialog", { name: "Crowbar" })).toBeVisible();
  });
});

/**
 * Icons are static files on a CDN path; `data:audit` proves all 237 exist in the repo, which
 * says nothing about whether they arrive. 10 <img> elements across 8 components: two use
 * alt={item.name} (the grid cards, where the icon IS the identification) and eight use alt=""
 * with the name adjacent in text. That should degrade cleanly — this checks it does rather
 * than assuming it from the markup.
 */
test("every item is still identifiable when no icon loads", async ({ page }) => {
  let blocked = 0;
  await page.route("**/icons/*.png", (route) => {
    blocked++;
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto("/items");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Item Codex/);
  expect(blocked, "no icon requests were intercepted — the test proved nothing").toBeGreaterThan(20);

  // The grid still names every card it shows, so a reader can tell the items apart.
  const named = await page.locator("img[alt]:not([alt=''])").count();
  expect(named, "grid icons carry no alt text, so a failed icon leaves an unlabelled card").toBeGreaterThan(20);
  await expect(page.getByText("Crowbar").first()).toBeVisible();
});

test.describe("a mangled share link degrades quietly", () => {
  for (const q of [
    "?p=%%%broken%%%",
    "?p=" + "A".repeat(3000),
    "?t=crowbar*99999999999999999999",
    "?p=" + encodeURIComponent('{"a":1}'),
    "?t=",
  ]) {
    test(`/planner${q.slice(0, 28)} still renders`, async ({ page }) => {
      const thrown: string[] = [];
      page.on("pageerror", (e) => thrown.push(String(e).split("\n")[0]));
      await page.goto(`/planner${q}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Run Planner/);
      expect(thrown, `threw: ${thrown[0]}`).toEqual([]);
      expect(await page.locator("body").innerText()).not.toContain("99999999999999999999");
    });
  }
});

/**
 * §3j.158 — the display store had the same defect the planner store did.
 *
 * `sanitize` was wired to `migrate`, which zustand calls only on a version MISMATCH, and this
 * store has been version 1 throughout — so it never ran. §3j.146 found exactly this in
 * `planner.ts`, fixed that instance, and left the sibling.
 *
 * The consequence is specific: `DENSITY_GRID[density]` is `undefined` for an unrecognised
 * value, so the codex rendered as a bare `grid` with no column classes — 217 items in one
 * column, no error thrown, nothing on screen to explain it.
 */
test.describe("a corrupt display preference does not collapse the codex", () => {
  const KEY = "ror2-display";
  for (const [label, state] of [
    ["an unknown density", { density: "ENORMOUS", showDescriptions: false, showNames: true }],
    ["a null density", { density: null, showDescriptions: false, showNames: true }],
    ["non-boolean toggles", { density: "compact", showDescriptions: "yes", showNames: 42 }],
  ] as const) {
    test(`the grid keeps its columns with ${label}`, async ({ page }) => {
      const thrown: string[] = [];
      page.on("pageerror", (e) => thrown.push(String(e).slice(0, 90)));
      await page.addInitScript(
        ([k, v]) => localStorage.setItem(k, v),
        [KEY, JSON.stringify({ state, version: 1 })] as const,
      );
      await page.goto("/items");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Item Codex/);

      const cols = await page.evaluate(() => {
        const grid = Array.from(document.querySelectorAll("div")).find((d) =>
          /(^|\s)grid(\s|$)/.test(d.className.toString()),
        );
        return (grid?.className ?? "").toString();
      });
      expect(cols, `the grid lost its column classes: "${cols}"`).toMatch(/grid-cols-\d/);
      expect(thrown, `threw: ${thrown[0]}`).toEqual([]);
    });
  }
});
