import { test, expect } from "@playwright/test";

/**
 * §3j.149 — nothing overflows a 360px viewport.
 *
 * 360px is the narrowest width in common use, and it is the actual context for a companion
 * site: someone checking an item on a phone with the game running. Nothing had ever measured
 * the layout at any width.
 *
 * Two checks, both about the same failure from different sides:
 *   1. the DOCUMENT scrolls sideways — the whole page shifts under the reader's thumb
 *   2. an element sits past the viewport with no scrollable ancestor — content you cannot reach
 *
 * Deliberately NOT checked here, having produced only false positives:
 *   - "content wider than an overflow-hidden box" flagged `truncate` (188 > 186), `sr-only`
 *     (59 > 1) and a 2px border on a segmented control. Every one is the utility working as
 *     designed. A check that can only cry wolf is worse than no check (§3j.129).
 *   - tap-target size, which is a real question and a different one — see AUDIT-BACKLOG.
 */
type Panel = {
  path: string;
  tabs?: string[];
  state?: string;
  setup?: (p: import("@playwright/test").Page) => Promise<void>;
};

const PANELS: Panel[] = [
  { path: "/" },
  { path: "/items" },
  { path: "/items/crowbar" },
  { path: "/planner" },
  {
    path: "/planner",
    state: "with a plan",
    setup: async (p) => {
      await p.getByRole("button", { name: /Click to cycle target/ }).first().click();
    },
  },
  { path: "/stats" },
  {
    path: "/reference",
    tabs: ["Artifacts", "Bazaar Dreams", "Shrines", "Loadout Unlocks", "Breakpoints"],
  },
  { path: "/survivors" },
  { path: "/survivors/commando" },
];

test.use({ viewport: { width: 360, height: 780 } });

test("nothing overflows a 360px viewport", async ({ page }) => {
  const overflow: string[] = [];
  const escaping: string[] = [];
  let panels = 0;
  let nodes = 0;

  for (const { path, tabs = [], state, setup } of PANELS) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    if (setup) await setup(page);
    const base = `${path}${state ? ` (${state})` : ""}`;

    for (const tab of tabs.length ? tabs : [null]) {
      if (tab) await page.getByRole("button", { name: tab, exact: true }).click();
      panels++;
      const where = `${base}${tab ? ` [${tab}]` : ""}`;

      const r = await page.evaluate(() => {
        const W = document.documentElement.clientWidth;
        const out = { docW: document.documentElement.scrollWidth, W, walked: 0, past: [] as string[] };

        // An element inside an overflow-x:auto ancestor is FINE — that is a deliberate
        // scroller, and the skill-proc table is one on purpose.
        const scrollableX = (el: Element) => {
          let n: Element | null = el.parentElement;
          while (n) {
            const s = getComputedStyle(n);
            if (/(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1) return true;
            n = n.parentElement;
          }
          return false;
        };

        for (const el of Array.from(document.querySelectorAll("body *"))) {
          if (!(el as HTMLElement).checkVisibility?.()) continue;
          out.walked++;
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) continue;
          if (b.right > W + 1 && !scrollableX(el)) {
            out.past.push(
              `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(/\s+/).slice(0, 3).join(".")}`.slice(0, 54) +
                ` right=${Math.round(b.right)}`,
            );
          }
        }
        return out;
      });

      nodes += r.walked;
      if (r.docW > r.W + 1) overflow.push(`${where}: document is ${r.docW}px in a ${r.W}px viewport`);
      // One line per panel keeps the failure readable; the count is what matters.
      if (r.past.length) escaping.push(`${where}: ${r.past.length} element(s), e.g. ${r.past[0]}`);
    }
  }

  // Denominators asserted, not just printed: a routing or selector change could reduce this
  // sweep to nothing, and "0 overflow over 0 nodes" is the output this method forbids.
  expect(panels, "panel count changed — a route or tab label moved").toBe(13);
  expect(nodes, `only ${nodes} nodes walked; the sweep stopped seeing the page`).toBeGreaterThan(8000);

  expect(overflow, `pages that scroll sideways at 360px:\n${overflow.join("\n")}`).toEqual([]);
  expect(escaping, `elements past the viewport with no scroller:\n${escaping.join("\n")}`).toEqual([]);
});
