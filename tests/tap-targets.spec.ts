import { test, expect, devices } from "@playwright/test";
import { representativeItems } from "./item-states";

/**
 * §3j.153 — WCAG 2.5.8 Target Size (Minimum), 24x24 CSS px, at a touch width.
 *
 * §3j.149 counted 31 targets under 24x24 and deliberately did not act, because the raw count is
 * not the criterion. 2.5.8 has exceptions, and a naive sweep reports every one of them:
 *
 *   - SPACING: an undersized target passes if a 24px-diameter circle centred on it does not
 *     intersect another target's box or another undersized target's circle. This is the big one
 *     — a small button with clearance around it is compliant.
 *   - INLINE: a link inside a sentence, sized by the line-height of the text around it.
 *   - USER AGENT: sizing the author did not modify.
 *   - EQUIVALENT: the same function reachable from a larger control on the same page.
 *
 * It also has to measure the RIGHT BOX. A checkbox inside a <label> is clicked by clicking the
 * label, so the target is their union, not the 14x14 input. And a range input's target is the
 * thumb, which is why §3j.149 saw `418x6` — the track.
 */
const PANELS: Array<{ path: string; tabs?: string[] }> = [
  { path: "/" },
  { path: "/items" },
  { path: "/items/crowbar" },
  { path: "/planner" },
  { path: "/stats" },
  { path: "/reference", tabs: ["Artifacts", "Bazaar Dreams", "Shrines", "Loadout Unlocks", "Breakpoints"] },
  { path: "/survivors" },
  { path: "/survivors/commando" },
  ...representativeItems().map((id) => ({ path: `/items/${id}` })),
];

test.use({ viewport: { width: 360, height: 780 } });

test("every tap target meets WCAG 2.5.8, or a stated exception", async ({ page }) => {
  const failures: string[] = [];
  const exempt: Record<string, number> = {};
  let panels = 0;
  let targets = 0;

  for (const { path, tabs = [] } of PANELS) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    for (const tab of tabs.length ? tabs : [null]) {
      if (tab) await page.getByRole("button", { name: tab, exact: true }).click();
      panels++;
      const where = `${path}${tab ? ` [${tab}]` : ""}`;

      const r = await page.evaluate(() => {
        const SEL = "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])";
        const els = Array.from(document.querySelectorAll<HTMLElement>(SEL)).filter(
          (e) => e.checkVisibility?.() && !(e as HTMLButtonElement).disabled,
        );

        /** The box a finger actually has to hit. */
        const targetBox = (el: HTMLElement): DOMRect => {
          const own = el.getBoundingClientRect();
          // A form control inside a <label> is activated by the label too.
          const lab = el.closest("label");
          if (lab && (el.tagName === "INPUT" || el.tagName === "SELECT")) {
            const l = lab.getBoundingClientRect();
            const x = Math.min(own.left, l.left), y = Math.min(own.top, l.top);
            return new DOMRect(x, y, Math.max(own.right, l.right) - x, Math.max(own.bottom, l.bottom) - y);
          }
          return own;
        };

        const boxes = els.map((el) => ({ el, box: targetBox(el) }));
        const out = { total: boxes.length, fail: [] as string[], exempt: {} as Record<string, number> };
        const note = (k: string) => (out.exempt[k] = (out.exempt[k] ?? 0) + 1);

        for (const { el, box } of boxes) {
          if (box.width >= 24 && box.height >= 24) continue;

          // USER AGENT: a range input's target is the thumb, which the author has not resized.
          if (el.matches('input[type="range"]')) { note("range thumb (user agent)"); continue; }

          // INLINE: inside a paragraph or a sentence of non-target text.
          const p = el.closest("p, li, td");
          if (p && (p.textContent ?? "").trim().length > (el.textContent ?? "").trim().length + 20) {
            note("inline in text"); continue;
          }

          // SPACING: a 24px circle centred on this target must not reach another target.
          const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
          const clash = boxes.some(({ el: other, box: b }) => {
            if (other === el) return false;
            // closest point on the other box to this centre
            const dx = Math.max(b.left - cx, 0, cx - b.right);
            const dy = Math.max(b.top - cy, 0, cy - b.bottom);
            return Math.hypot(dx, dy) < 12; // 24px diameter => 12px radius
          });
          if (!clash) { note("spacing exception (24px clearance)"); continue; }

          out.fail.push(
            `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(/\s+/).slice(0, 2).join(".")}`.slice(0, 46) +
              ` ${Math.round(box.width)}x${Math.round(box.height)} "${(el.getAttribute("aria-label") || el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 26)}"`,
          );
        }
        return out;
      });

      targets += r.total;
      for (const [k, v] of Object.entries(r.exempt)) exempt[k] = (exempt[k] ?? 0) + v;
      for (const f of r.fail) failures.push(`${where} :: ${f}`);
    }
  }

  console.log(`\nPANELS: ${panels}   TARGETS MEASURED: ${targets}`);
  console.log("EXEMPT (counted, not ignored):");
  for (const [k, v] of Object.entries(exempt).sort((a, b) => b[1] - a[1])) console.log(`   ${String(v).padStart(4)}  ${k}`);
  // Group by CONTROL (class + size), not by label — the label carries the item name, so
  // deduping on it counted one repeated button as 211 distinct ones.
  const byControl = new Map<string, { n: number; where: Set<string>; sample: string }>();
  for (const f of failures) {
    const [where, detail] = f.split(" :: ");
    const key = detail.replace(/"[^"]*"/, "").trim();
    const e = byControl.get(key);
    if (e) {
      e.n++;
      e.where.add(where.split(" [")[0]);
    } else byControl.set(key, { n: 1, where: new Set([where.split(" [")[0]]), sample: detail });
  }
  console.log(`\nGENUINE FAILURES: ${failures.length} instances, ${byControl.size} DISTINCT CONTROLS`);
  for (const [k, v] of [...byControl].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`   x${String(v.n).padEnd(4)} ${k}`);
    console.log(`          on: ${[...v.where].join(", ")}`);
    console.log(`          e.g. ${v.sample}`);
  }

  // Denominators asserted, not merely printed. 31 raw undersized targets became 4 real controls
  // once the standard's own exceptions were applied, so the exception counts are part of the
  // result and a sweep that stops applying them must fail rather than quietly pass.
  expect(panels, "panel count changed — a route or tab label moved").toBe(16);
  expect(targets, `only ${targets} targets measured; the sweep is not seeing the pages`).toBeGreaterThan(1800);
  expect(
    Object.values(exempt).reduce((a, b) => a + b, 0),
    "no exceptions applied at all — the spacing rule stopped working",
  ).toBeGreaterThan(20);

  expect(
    [...byControl.keys()],
    `controls below 24x24 with no applicable exception: ${[...byControl.keys()].join(" | ")}`,
  ).toEqual([]);
});

/**
 * The other half of the same defect, which a size sweep structurally cannot see.
 *
 * The planner's Details button was `opacity-0` until `group-hover`. A phone has no hover, so it
 * was an INVISIBLE but fully tappable 22x22 target sitting on a card that does something else —
 * tapping near the corner silently opened the drawer instead of cycling the plan state. Measured
 * on an emulated Pixel 5 rather than inferred from the class list.
 */
test("controls revealed on hover are visible where there is no hover", async ({ browser }) => {
  const ctx = await browser.newContext({ ...devices["Pixel 5"] });
  const page = await ctx.newPage();
  await page.goto("/planner");
  await page.waitForLoadState("networkidle");

  const r = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label^="Details for"]') as HTMLElement | null;
    if (!btn) return null;
    const cs = getComputedStyle(btn);
    const b = btn.getBoundingClientRect();
    return {
      opacity: Number(cs.opacity),
      hoverCapable: matchMedia("(hover: hover)").matches,
      w: Math.round(b.width),
      h: Math.round(b.height),
    };
  });
  expect(r, "no Details button found on the planner").not.toBeNull();
  expect(r!.hoverCapable, "this context is not emulating a touch device, so it proves nothing").toBe(false);
  expect(r!.opacity, "a hover-revealed control is invisible on touch").toBeGreaterThan(0);
  expect(Math.min(r!.w, r!.h), "the touch target is under 24px").toBeGreaterThanOrEqual(24);
  await ctx.close();
});
