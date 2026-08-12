import { test, expect } from "@playwright/test";

/**
 * §3j.144 — WCAG AA contrast for every text/background pair the site actually paints.
 *
 * Nothing in this project had ever measured a colour. The dark theme was designed by eye on a
 * good monitor, which is precisely the condition under which a low-contrast pair looks fine.
 *
 * Computed styles, not source classes: the theme is CSS variables through Tailwind, so the only
 * honest way to know what a user sees is to ask the browser what it painted. Two instrument
 * bugs had to be fixed before any result from this was worth reading (see `parse` below) — the
 * first version reported a clean pass while silently discarding a third of the page.
 *
 * WHAT THIS DOES NOT COVER, so the name is not read as broader than the check:
 *   - hover/focus states. Elements are measured at rest. `group-hover:text-muted-foreground/60`
 *     in the planner failed AA and this sweep could not see it; a static guard in
 *     `src/data/stacking.test.ts` covers that class instead.
 *   - text over a gradient or image, which has no single background colour. Counted and
 *     printed, currently 0.
 *   - non-text contrast (icon glyphs, focus rings, chart strokes) — WCAG 1.4.11, not 1.4.3.
 */

/**
 * `setup` exists because a route visited at rest is not the same as a route a user reaches.
 * The codex EMPTY state (`TierGrid`'s "No items match…") carried a failing colour and never
 * appeared in this sweep, because a default visit always has results. A deliberately-broken
 * colour placed there passed the whole suite — the mutation was not too weak, the sweep was
 * too narrow. Any future state worth a user's eyes belongs in this list.
 */
type Panel = {
  path: string;
  tabs?: string[];
  state?: string;
  setup?: (page: import("@playwright/test").Page) => Promise<void>;
};

const ROUTES: Panel[] = [
  { path: "/" },
  { path: "/items" },
  { path: "/items/crowbar" },
  {
    path: "/items",
    state: "no results",
    setup: async (page) => {
      await page.getByLabel("Search items").fill("zzzzzzqqqqq");
      await page.getByText("No items match").waitFor();
    },
  },
  { path: "/planner" },
  { path: "/stats" },
  {
    path: "/reference",
    tabs: ["Artifacts", "Bazaar Dreams", "Shrines", "Loadout Unlocks", "Breakpoints"],
  },
  { path: "/survivors" },
  { path: "/survivors/commando" },
];

test("every text/background pair meets WCAG AA", async ({ page }) => {
  const all: Array<Record<string, unknown>> = [];
  const totals = { elements: 0, withText: 0, compared: 0, hidden: 0, image: 0, noColor: 0 };
  const narrowest: Array<Record<string, unknown>> = [];
  let panels = 0;

  for (const { path, tabs = [], state, setup } of ROUTES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    if (setup) await setup(page);
    const where = `${path}${state ? ` (${state})` : ""}`;

    for (const tab of tabs.length ? tabs : [null]) {
      if (tab) await page.getByRole("button", { name: tab, exact: true }).click();
      panels++;

      const found = await page.evaluate(() => {
        // Normalise through a canvas rather than a regex.
        //
        // The first version matched /rgba?\(...\)/ and returned null for anything else. Tailwind
        // v4 emits OKLCH, and Chromium reports colours through `color-mix`/`oklch` as
        // `oklab(...)`: on /items alone that is 590 text colours and 263 backgrounds. The text
        // ones were skipped and at least counted; the BACKGROUND ones were silently treated as
        // absent, so the walk continued past a real opaque layer and compared against a
        // hardcoded fallback. The report was measuring a page that does not exist.
        const cv = document.createElement("canvas");
        cv.width = cv.height = 1;
        const ctx = cv.getContext("2d", { willReadFrequently: true })!;
        const parse = (c: string): [number, number, number, number] | null => {
          if (!c || c === "transparent") return [0, 0, 0, 0];
          // Reject invalid values by SENTINEL, not by hoping. An unparseable string leaves
          // fillStyle at whatever it was, so black stays black and the caller gets a confident
          // wrong ratio instead of a skip — "not-a-color" read as rgb(0,0,0) in the first cut.
          ctx.fillStyle = "#000";
          ctx.fillStyle = c;
          const asBlack = ctx.fillStyle;
          ctx.fillStyle = "#fff";
          ctx.fillStyle = c;
          if (ctx.fillStyle !== asBlack) return null; // retained both sentinels => invalid
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          // getImageData already returns UN-premultiplied channels. Dividing by alpha here
          // "corrects" a correction: rgba(255,0,0,0.5) came back as 508 in the first cut.
          return [d[0], d[1], d[2], d[3] / 255];
        };
        const lin = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        const lum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        const ratio = (a: number[], b: number[]) => {
          const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
          return (x + 0.05) / (y + 0.05);
        };
        // Composite a possibly-translucent colour over what is behind it.
        const over = (fg: number[], bg: number[]) =>
          fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3]));

        // The painted background is a STACK: collect every translucent layer from the element
        // upward until an opaque one, then composite bottom-up. Compositing top-down (the
        // obvious way to write it while walking up) applies the layers in reverse and produces
        // a colour that is never on screen.
        const effectiveBg = (el: Element): number[] | null => {
          const layers: number[][] = [];
          let node: Element | null = el;
          while (node) {
            const s = getComputedStyle(node);
            if (s.backgroundImage && s.backgroundImage !== "none") return null; // gradient/image
            const c = parse(s.backgroundColor);
            if (c && c[3] > 0) {
              layers.push(c);
              if (c[3] === 1) break;
            }
            node = node.parentElement;
          }
          // Bottom of the stack: an opaque layer if we found one, else the document canvas.
          let base =
            layers.length && layers[layers.length - 1][3] === 1
              ? layers.pop()!.slice(0, 3)
              : parse(getComputedStyle(document.documentElement).backgroundColor)?.slice(0, 3) ?? [
                  11, 18, 32,
                ];
          for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
          return base;
        };

        const out: Array<Record<string, unknown>> = [];
        // Denominators. "0 failing" and "0 compared" must never print the same (§3j.126).
        const tally = { elements: 0, withText: 0, compared: 0, hidden: 0, image: 0, noColor: 0 };
        let worst = { r: 99, text: "", color: "", bg: "" };
        for (const el of Array.from(document.querySelectorAll("*"))) {
          tally.elements++;
          // `offsetParent === null` is WRONG here: it is also null for position:fixed, which
          // would silently drop the header and any overlay. checkVisibility asks the question
          // actually meant — is this painted?
          if (!(el as HTMLElement).checkVisibility?.({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) {
            tally.hidden++;
            continue;
          }
          if (el.closest("[aria-hidden='true']")) {
            tally.hidden++;
            continue;
          }
          // Only elements with their OWN visible text.
          const text = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => (n.textContent ?? "").trim())
            .join(" ")
            .trim();
          if (!text) continue;
          tally.withText++;

          const s = getComputedStyle(el);
          const fg = parse(s.color);
          const bg = effectiveBg(el);
          if (!fg) {
            tally.noColor++;
            continue;
          }
          if (!bg) {
            tally.image++; // text over a gradient/image has no single background colour
            continue;
          }
          tally.compared++;
          const painted = fg[3] < 1 ? over(fg, bg) : fg.slice(0, 3);

          const size = parseFloat(s.fontSize);
          const weight = Number(s.fontWeight) || 400;
          const large = size >= 24 || (size >= 18.66 && weight >= 700);
          const need = large ? 3 : 4.5;
          const r = ratio(painted, bg);
          // Track the closest-to-failing PASS too: a suite that only reports failures cannot
          // distinguish "comfortably fine" from "one token tweak away".
          if (r / need < worst.r) {
            worst = { r: r / need, text: text.slice(0, 40), color: s.color, bg: `rgb(${bg.map(Math.round).join(",")})` };
          }
          if (r < need) {
            out.push({
              text: text.slice(0, 44),
              ratio: Math.round(r * 100) / 100,
              need,
              size: Math.round(size * 10) / 10,
              weight,
              color: s.color,
              bg: `rgb(${bg.map((v) => Math.round(v)).join(",")})`,
              cls: (el.className || "").toString().slice(0, 60),
            });
          }
        }
        return { out, tally, worst };
      });

      totals.elements += found.tally.elements;
      totals.withText += found.tally.withText;
      totals.compared += found.tally.compared;
      totals.hidden += found.tally.hidden;
      totals.image += found.tally.image;
      totals.noColor += found.tally.noColor;
      narrowest.push({ ...found.worst, where: `${where}${tab ? ` [${tab}]` : ""}` });
      for (const f of found.out) all.push({ ...f, where: `${where}${tab ? ` [${tab}]` : ""}` });
    }
  }

  // Collapse identical colour pairs — one styling decision, not N instances.
  const byPair = new Map<string, { n: number; sample: Record<string, unknown> }>();
  for (const f of all) {
    const k = `${f.color}|${f.bg}|${f.need}`;
    const e = byPair.get(k);
    if (e) e.n++;
    else byPair.set(k, { n: 1, sample: f });
  }

  console.log(`\nPANELS MEASURED: ${panels}`);
  console.log(`  elements walked:      ${totals.elements}`);
  console.log(`  with own text:        ${totals.withText}`);
  console.log(`  PAIRS COMPARED:       ${totals.compared}`);
  console.log(`  skipped, not painted: ${totals.hidden}`);
  console.log(`  skipped, image/grad:  ${totals.image}`);
  console.log(`  skipped, no colour:   ${totals.noColor}`);
  console.log(`FAILING TEXT NODES: ${all.length}`);
  console.log(`DISTINCT COLOUR PAIRS BELOW AA: ${byPair.size}\n`);
  console.log("NARROWEST PASSING MARGIN PER PANEL (ratio/required):");
  for (const w of [...narrowest].sort((a, b) => Number(a.r) - Number(b.r)).slice(0, 8)) {
    console.log(`  ${(Number(w.r) * 100).toFixed(0)}% of required  ${w.color} on ${w.bg}  "${w.text}"  [${w.where}]`);
  }
  console.log("");
  for (const [, { n, sample }] of [...byPair.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(
      `  x${String(n).padEnd(4)} ratio ${String(sample.ratio).padEnd(5)} need ${sample.need}  ` +
        `${sample.color} on ${sample.bg}  ${sample.size}px/${sample.weight}\n` +
        `        "${sample.text}"  [${sample.where}]\n        .${sample.cls}`,
    );
  }

  // The denominator is ASSERTED, not just printed. A selector change, a route rename or a tab
  // label edit could quietly reduce this sweep to nothing, and "0 failures over 0 pairs" is the
  // exact output this method exists to make impossible (§3j.126).
  expect(panels, "panel count changed — a route, tab label or state moved").toBe(13);
  expect(
    totals.compared,
    `only ${totals.compared} pairs compared; the sweep has stopped seeing the page`,
  ).toBeGreaterThan(2500);

  // Every element with its own text must yield a comparison. A skip here means a CSS colour
  // format the parser cannot read — which is how 590 oklab colours went missing on the first
  // run while the report still said "0 failing".
  expect(
    totals.noColor,
    `${totals.noColor} elements had an unreadable colour; the parser is dropping a CSS colour format`,
  ).toBe(0);

  expect(
    all.map((f) => `${f.where} ${f.ratio}:1 (need ${f.need}) .${f.cls}`),
    `${all.length} text nodes below WCAG AA across ${byPair.size} colour pairs`,
  ).toEqual([]);
});
