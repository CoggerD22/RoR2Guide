import { test, expect } from "@playwright/test";

/**
 * §3j.145 — keyboard operability of the planner and the Stat Lab.
 *
 * §3j.141 gave the item drawer a focus contract and did not generalise it. These are the two
 * surfaces with real interaction state, and the question here is the second half of the one
 * that pass answered: not just "can it be reached", but "does operating it leave the keyboard
 * user somewhere sensible".
 *
 * Reachability turned out to be sound and is asserted with denominators so it stays that way.
 * The defects were both in what happens AFTER a control is used: two different mechanisms for
 * dropping focus on the floor, neither visible to anyone using a mouse.
 */

const active = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "BODY";
    return `${el.tagName.toLowerCase()}|${(el.getAttribute("aria-label") || el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40)}`;
  });

/** The planner rail only renders per-item controls for items already in the plan. */
async function planOneItem(page: import("@playwright/test").Page) {
  await page.goto("/planner");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Click to cycle target/ }).first().click();
  await expect(page.getByRole("button", { name: /Set a goal count for/ })).toHaveCount(1);
}

test.describe("focus survives operating a control", () => {
  /**
   * Enter and Escape both unmount the input. The browser then has nowhere to put focus and
   * hands it to <body> — on a page with 445 tab stops, setting one goal ejected the user to
   * the top of the document.
   *
   * The first fix for this LOOKED right and was not: restoring focus synchronously inside the
   * keydown handed the rest of the keystroke to the button it had just focused, and Enter on a
   * focused button activates it. The editor committed, closed and instantly reopened. Hence the
   * assertions on the editor being CLOSED — checking only where focus landed would have passed.
   */
  test("committing a goal with Enter returns focus to the button that opened it", async ({ page }) => {
    await planOneItem(page);
    await page.getByRole("button", { name: /Set a goal count for/ }).first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('input[aria-label^="Goal stack count"]')).toHaveCount(1);

    await page.keyboard.type("3");
    await page.keyboard.press("Enter");

    await expect(
      page.locator('input[aria-label^="Goal stack count"]'),
      "the editor reopened — the restored focus swallowed its own keystroke",
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Goal: 3/ })).toHaveCount(1);
    expect(await active(page), "focus was dropped after committing a goal").toBe("button|Goal: 3. Edit.");
  });

  test("cancelling with Escape discards the value and returns focus", async ({ page }) => {
    await planOneItem(page);
    await page.getByRole("button", { name: /Set a goal count for/ }).first().focus();
    await page.keyboard.press("Enter");
    await page.keyboard.type("7");
    await page.keyboard.press("Escape");

    await expect(page.locator('input[aria-label^="Goal stack count"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Goal: 7/ }), "Escape saved the value").toHaveCount(0);
    expect(await active(page), "focus was dropped after cancelling").toBe(
      "button|Set a goal count for Crowbar",
    );
  });

  /**
   * `disabled` on a FOCUSED element hands focus to <body>. Stepping an item down to 0 is an
   * ordinary thing to do, and it ejected the user. The button now uses aria-disabled, which
   * announces the same state without removing it from the tab order.
   */
  test("stepping an item down to zero keeps focus on the button", async ({ page }) => {
    await page.goto("/stats");
    await page.waitForLoadState("networkidle");

    const plus = page.getByRole("button", { name: /^Add one / }).first();
    await plus.focus();
    await page.keyboard.press("Enter");

    const minus = page.getByRole("button", { name: /^Remove one / }).first();
    const label = (await minus.getAttribute("aria-label")) ?? "";
    await minus.focus();
    await page.keyboard.press("Enter"); // -> 0, the button becomes unavailable
    expect(await active(page), "focus was dropped when the stepper hit zero").toBe(`button|${label}`);
    await expect(minus).toHaveAttribute("aria-disabled", "true");

    // And pressing it again at zero is a no-op that still does not move focus.
    await page.keyboard.press("Enter");
    expect(await active(page)).toBe(`button|${label}`);
  });
});

/**
 * Reachability, asserted with denominators.
 *
 * Every visible, enabled control must be exactly one tab stop — no more, no fewer. Both
 * counts are derived independently: one by querying the DOM, one by actually pressing Tab.
 */
for (const path of ["/planner", "/stats"]) {
  test(`every control on ${path} is reachable by Tab, in DOM order, with a visible ring`, async ({
    page,
  }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const SEL = 'a[href], button, input, select, textarea, [tabindex], summary';
    const enabled = await page.evaluate((sel) => {
      return Array.from(document.querySelectorAll(sel))
        .filter((el) => (el as HTMLElement).checkVisibility?.() && !(el as HTMLButtonElement).disabled)
        .map((el) =>
          (el.getAttribute("aria-label") || (el as HTMLElement).innerText || `<${el.tagName}>`)
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 40),
        );
    }, SEL);
    expect(enabled.length, `${path} exposed no controls — the selector or the page changed`).toBeGreaterThan(20);

    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    const reached: string[] = [];
    const seen = new Set<string>();
    // Cap derived from the page, never a constant: a hardcoded 250 made every stop past it on
    // the 445-control planner look like an unreachable control.
    for (let i = 0; i < enabled.length + 25; i++) {
      await page.keyboard.press("Tab");
      const cur = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute("aria-label") || (el as HTMLElement).innerText || `<${el.tagName}>`)
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 40);
        return { name, key: `${el.tagName}|${name}|${Math.round(r.top + window.scrollY)}|${Math.round(r.left)}` };
      });
      if (!cur || seen.has(cur.key)) break;
      seen.add(cur.key);
      reached.push(cur.name);
    }

    expect(
      reached.length,
      `${path}: ${enabled.length} enabled controls but Tab reached ${reached.length}`,
    ).toBe(enabled.length);

    // Focus order must follow DOM order. Comparing vertical POSITION instead reported ~100
    // false "backward jumps" on the planner, every one a grid artifact: within a card the
    // cycle button sits above its Details link, so moving to the next card in the same row
    // always reads as a jump upward. That is correct reading order.
    const inversions = await page.evaluate(
      ({ names, sel }) => {
        const all = Array.from(document.querySelectorAll(sel)).filter(
          (el) => (el as HTMLElement).checkVisibility?.() && !(el as HTMLButtonElement).disabled,
        );
        const idx = new Map<Element, number>(all.map((el, i) => [el, i]));
        const pos: number[] = [];
        for (const n of names) {
          const hit = all.find(
            (el) =>
              (el.getAttribute("aria-label") || (el as HTMLElement).innerText || `<${el.tagName}>`)
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 40) === n,
          );
          if (hit) pos.push(idx.get(hit)!);
        }
        let n = 0;
        for (let i = 1; i < pos.length; i++) if (pos[i] < pos[i - 1]) n++;
        return { n, compared: pos.length };
      },
      { names: reached, sel: SEL },
    );
    expect(inversions.compared, "focus order compared against nothing").toBeGreaterThan(20);
    expect(inversions.n, `${path}: focus order departs from DOM order`).toBe(0);

    // Invisible focus. Checking `outline` alone is not enough — Tailwind rings are box-shadow
    // and `.tier-card` swaps the outline for a border colour and a glow, so the honest test is
    // whether ANY of the properties a focus indicator could use changes.
    const invisible = await page.evaluate((sel) => {
      const props = ["outline", "boxShadow", "borderColor", "backgroundColor", "color", "transform"];
      const snap = (el: Element) => {
        const cs = getComputedStyle(el) as unknown as Record<string, string>;
        return props.map((p) => cs[p]).join("|");
      };
      const out: string[] = [];
      const all = Array.from(document.querySelectorAll(sel)).filter(
        (el) => (el as HTMLElement).checkVisibility?.() && !(el as HTMLButtonElement).disabled,
      );
      for (const el of all) {
        (document.activeElement as HTMLElement)?.blur();
        const before = snap(el);
        (el as HTMLElement).focus();
        if (document.activeElement !== el) continue;
        if (before === snap(el)) {
          out.push(
            `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || (el as HTMLElement).innerText || "").slice(0, 30)}"`,
          );
        }
      }
      (document.activeElement as HTMLElement)?.blur();
      return { out, checked: all.length };
    }, SEL);
    expect(invisible.checked, "focus visibility checked nothing").toBeGreaterThan(20);
    expect(invisible.out, `${path}: focusable with no visible focus indicator`).toEqual([]);
  });
}
