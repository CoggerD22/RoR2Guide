import { test, expect, devices } from "@playwright/test";
import { representativeItems } from "./item-states";

/**
 * §3j.155 — on a touch device, nothing interactive may be invisible.
 *
 * Three separate passes found the same defect by accident:
 *   §3j.145  the planner's "+goal" button — `opacity-0` until hover, so invisible on a phone
 *            AND invisible when a keyboard user focused it.
 *   §3j.149  the item tooltip — `opacity-0` but still in layout, so 256px of invisible box
 *            pushed the document sideways at 360px.
 *   §3j.153  the planner's "Details" button — `opacity-0` until hover, `pointer-events: auto`,
 *            sitting on a card whose own tap does something else. An invisible mis-tap trap.
 *
 * Nothing sweeps for the class. `(hover: hover)` is false on a phone, so any affordance whose
 * visibility is spelled `group-hover:` or `hover:` simply does not exist there — and every
 * check this project has runs in a hover-capable context by default, which is exactly why all
 * three survived until someone looked directly at them.
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
    /*
      The planner WITH something in it. Without this the sweep cannot reach the control that
      motivated the whole check: `GoalField` renders only for items already in the plan, so on
      an empty planner the "+goal" button does not exist. Reverting §3j.145's fix produced 0
      findings until this state was added — the check was sound and the sweep was too narrow,
      which is §3j.151's lesson arriving for the third time.
    */
    path: "/planner",
    state: "with a plan",
    setup: async (p) => {
      await p.getByRole("button", { name: /Click to cycle target/ }).first().click();
      await p.getByRole("button", { name: /Set a goal count for/ }).first().waitFor();
    },
  },
  { path: "/stats" },
  { path: "/reference", tabs: ["Artifacts", "Bazaar Dreams", "Shrines", "Loadout Unlocks", "Breakpoints"] },
  { path: "/survivors" },
  { path: "/survivors/commando" },
  ...representativeItems().map((id) => ({ path: `/items/${id}` })),
];

test("no interactive control is invisible on a touch device", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["Pixel 5"] });
  const page = await ctx.newPage();

  const findings: string[] = [];
  const decorative: string[] = [];
  let panels = 0;
  let interactive = 0;

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
        const out = { hoverCapable: matchMedia("(hover: hover)").matches, n: 0, bad: [] as string[], dec: [] as string[] };
        const SEL = "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])";

        /** Effective opacity: the product of this element's and every ancestor's. */
        const effOpacity = (el: Element) => {
          let o = 1;
          let n: Element | null = el;
          while (n) {
            o *= Number(getComputedStyle(n).opacity);
            n = n.parentElement;
          }
          return o;
        };

        for (const el of Array.from(document.querySelectorAll<HTMLElement>(SEL))) {
          if ((el as HTMLButtonElement).disabled) continue;
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) continue; // display:none / not laid out
          out.n++;
          const cs = getComputedStyle(el);
          const o = effOpacity(el);

          /*
            TWO mechanisms, one class — checking only the first missed a real historical
            defect. §3j.153's Details button was `opacity-0`; §3j.145's "+goal" button was
            `text-muted-foreground/0`, which leaves the ELEMENT fully opaque and makes only its
            TEXT transparent. Reverting that fix produced 0 findings from the opacity check
            alone, so "invisible" has to mean "renders nothing a user can see".

            An element is only judged invisible-by-text when it has text and nothing else to
            look at: no visible background, and no child element of its own (an icon-only
            button has no text, so its colour is irrelevant).
          */
          // Alpha via canvas, not a regex. `text-muted-foreground/0` computes to
          // `oklab(… / 0)`, and an /rgba?\(/ pattern reads that as opaque — the exact mistake
          // §3j.144 already made once, where a colour regex silently dropped 36% of the page.
          const alpha = (c: string) => {
            if (!c || c === "transparent") return 0;
            const cv = document.createElement("canvas");
            cv.width = cv.height = 1;
            const cx = cv.getContext("2d", { willReadFrequently: true })!;
            cx.clearRect(0, 0, 1, 1);
            cx.fillStyle = c;
            cx.fillRect(0, 0, 1, 1);
            return cx.getImageData(0, 0, 1, 1).data[3] / 255;
          };
          const hasText = (el.textContent ?? "").trim().length > 0;
          const bgVisible = alpha(cs.backgroundColor) > 0.05;
          const textInvisible = hasText && alpha(cs.color) <= 0.05 && !bgVisible && el.children.length === 0;

          if (o > 0.05 && !textInvisible) continue;
          const why = o <= 0.05 ? `opacity=${o}` : `text alpha=${alpha(cs.color)}`;
          const label = `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 32)}"`;
          // pointer-events:none means it cannot be tapped — invisible AND inert is decorative.
          if (getComputedStyle(el).pointerEvents === "none") out.dec.push(label);
          else out.bad.push(`${label} ${Math.round(b.width)}x${Math.round(b.height)} ${why}`);
        }
        return out;
      });

      if (r.hoverCapable) throw new Error("context is hover-capable — this proves nothing about touch");
      interactive += r.n;
      for (const b of new Set(r.bad)) findings.push(`${where} :: ${b}`);
      for (const d of new Set(r.dec)) decorative.push(`${where} :: ${d}`);
    }
  }

  console.log(`\nPANELS: ${panels}   INTERACTIVE ELEMENTS: ${interactive}`);
  console.log(`INVISIBLE BUT TAPPABLE: ${findings.length}`);
  for (const f of findings.slice(0, 20)) console.log(`   ${f}`);
  console.log(`\ninvisible and inert (pointer-events:none — decorative, fine): ${decorative.length}`);
  for (const d of [...new Set(decorative.map((x) => x.split(" :: ")[1]))].slice(0, 8)) console.log(`   ${d}`);
  await ctx.close();

  // Denominators asserted. The planner-with-a-plan state is the one that matters: without it
  // this sweep saw 2249 controls and none of the three it was built to find.
  expect(panels, "panel count changed — a route, tab or state moved").toBe(17);
  expect(interactive, `only ${interactive} controls seen; the sweep stopped reaching the pages`).toBeGreaterThan(2400);

  expect(
    findings,
    `interactive controls invisible on a phone but still tappable: ${findings.join(" | ")}`,
  ).toEqual([]);
});
