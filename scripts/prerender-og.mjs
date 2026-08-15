/**
 * Post-build OpenGraph prerender (PLAN §4.4). GitHub Pages is static and crawlers
 * (Discord, Twitter, Slack) don't run JS, so a shared link only unfurls into a card
 * if the SERVED HTML already contains the meta tags. This writes one static HTML file
 * per item at dist/items/<id>/index.html — same SPA shell (so the app still boots and
 * opens the item), plus item-specific <title>/description/OpenGraph tags.
 *
 * Runs after `vite build` (see package.json build script), so both local builds and
 * the Pages deploy produce these files. Fully static — no server.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

// The deployed origin + base path. One place to change if a custom domain is added.
const SITE = "https://coggerd22.github.io/RoR2Guide";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Build the OG/Twitter/title/description head fragment for one page. Image is
 * optional — survivors have no portrait asset, so they get a text-only summary card
 * rather than a misleading item icon. */
function head({ title, description, image, url }) {
  const t = esc(title), d = esc(description), u = esc(url);
  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="RoR2 Companion">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:url" content="${u}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
  ];
  if (image) {
    const i = esc(image);
    tags.splice(4, 0, `<meta property="og:image" content="${i}">`);
    tags.push(`<meta name="twitter:image" content="${i}">`);
  }
  return tags.join("\n    ");
}

/** Swap <title>/description and inject the OG fragment into a copy of the shell. */
function render(template, { title, description, image, url }) {
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/?>/, `<meta name="description" content="${esc(description)}" />`)
    .replace("</head>", `    ${head({ title, description, image, url })}\n  </head>`);
}

/**
 * §3j.150 — re-read every page this script just wrote and check it, rather than assuming the
 * write was what was intended.
 *
 * §3j.147 proved these files EXIST. "Present" and "correct" is the distinction that pass turned
 * on, and nothing had asked the second question of the metadata. The check lives here, in the
 * writer, so `pnpm build` fails on a bad page — no separate command to remember and no ordering
 * problem with a test suite that runs before the build.
 *
 * The description round-trip is the load-bearing one: it compares the rendered page against
 * `items.json` verbatim, which is also the only thing exercising `esc()`. Today **0 of 217**
 * descriptions contain `<`, `>`, `&` or `"`, so the escaping path is untested by the data as it
 * stands — one DLC item with an ampersand would be the first, and this comparison is what would
 * catch it going wrong.
 */
function verify({ items, survivors, sections }) {
  const unesc = (s) =>
    s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  const metaOf = (html, prop) => {
    const m =
      html.match(new RegExp(`<meta property="${prop}" content="([^"]*)">`)) ??
      html.match(new RegExp(`<meta name="${prop}" content="([^"]*)"\\s*/?>`));
    return m ? unesc(m[1]) : null;
  };
  const titleOf = (html) => {
    const m = html.match(/<title>([\s\S]*?)<\/title>/);
    return m ? unesc(m[1]) : null;
  };

  const assets = fs.readdirSync(path.join(dist, "assets"));
  const problems = [];
  let checked = 0;

  /*
    The deploy path is written in TWO places — `SITE` here and `base` in vite.config.ts — and
    nothing kept them in sync. Change the base without changing SITE and every og:url and
    og:image silently points at an origin that does not serve this site, while the pages
    themselves still load and every other check passes. Exactly the drift shape that put the
    wiki in PLAN.md's ground-truth list for months (§3j.140).
  */
  const viteConfig = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");
  const baseMatch = viteConfig.match(/base:\s*mode === "production" \? "([^"]+)"/);
  if (!baseMatch) {
    problems.push("vite.config.ts: could not read the production `base` — this check is blind");
  } else {
    const base = baseMatch[1].replace(/\/$/, "");
    if (!SITE.endsWith(base)) {
      problems.push(`SITE (${SITE}) does not end with vite's production base (${base})`);
    }
  }

  const common = (rel, html) => {
    checked++;
    const nTitle = (html.match(/<title>/g) || []).length;
    const nDesc = (html.match(/<meta name="description"/g) || []).length;
    if (nTitle !== 1) problems.push(`${rel}: ${nTitle} <title> tags`);
    if (nDesc !== 1) problems.push(`${rel}: ${nDesc} description metas`);

    // A stale template would cite an asset hash this build never produced.
    for (const m of html.matchAll(/\/RoR2Guide\/assets\/([^"]+)"/g)) {
      if (!assets.includes(m[1])) problems.push(`${rel}: references missing asset ${m[1]}`);
    }
    // Relative paths resolve against the page's own folder and 404 two levels down.
    for (const m of html.matchAll(/(src|href)="(?!https?:|\/|#)([^"]+)"/g)) {
      problems.push(`${rel}: relative asset path ${m[2]} breaks in a subdirectory`);
    }

    const d = metaOf(html, "og:description");
    const t = metaOf(html, "og:title");
    if (!d || !d.trim()) problems.push(`${rel}: empty og:description`);
    if (!t || !t.trim()) problems.push(`${rel}: empty og:title`);
    if (d && /[\r\n]/.test(d)) problems.push(`${rel}: og:description contains a newline`);
    if (t !== titleOf(html)) problems.push(`${rel}: og:title != <title>`);
    if (metaOf(html, "twitter:title") !== t) problems.push(`${rel}: twitter:title != og:title`);
    if (metaOf(html, "twitter:description") !== d) problems.push(`${rel}: twitter:description != og:description`);
    if (metaOf(html, "description") !== d) problems.push(`${rel}: meta description != og:description`);

    const img = metaOf(html, "og:image");
    if (img) {
      if (!img.startsWith(SITE)) problems.push(`${rel}: og:image is not on the deploy origin`);
      else if (!fs.existsSync(path.join(dist, img.slice(SITE.length)))) {
        problems.push(`${rel}: og:image 404s (${img})`);
      }
    }
    return { d, t };
  };

  const read = (...p) => {
    const f = path.join(dist, ...p);
    return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
  };

  for (const item of items) {
    const rel = `items/${item.id}`;
    const html = read("items", item.id, "index.html");
    if (!html) { problems.push(`${rel}: MISSING`); continue; }
    const { d, t } = common(rel, html);
    if (t !== `${item.name} · Risk of Rain 2`) problems.push(`${rel}: title is "${t}"`);
    if (d !== item.description) problems.push(`${rel}: description does not match items.json`);
    if (metaOf(html, "og:url") !== `${SITE}/items/${item.id}`) problems.push(`${rel}: wrong og:url`);
    if (metaOf(html, "og:image") !== `${SITE}${item.icon}`) problems.push(`${rel}: wrong og:image`);
  }

  for (const s of survivors) {
    const rel = `survivors/${s.id}`;
    const html = read("survivors", s.id, "index.html");
    if (!html) { problems.push(`${rel}: MISSING`); continue; }
    const { d, t } = common(rel, html);
    if (t !== `${s.name} · Risk of Rain 2`) problems.push(`${rel}: title is "${t}"`);
    if (metaOf(html, "og:url") !== `${SITE}/survivors/${s.id}`) problems.push(`${rel}: wrong og:url`);
    // The description is built from verified base stats — check they are THIS survivor's.
    for (const want of [s.health.base, s.damage.base, s.moveSpeed]) {
      if (!String(d).includes(String(want))) problems.push(`${rel}: description omits ${want}`);
    }
  }

  for (const id of sections) {
    const html = read(id, "index.html");
    if (!html) { problems.push(`${id}: MISSING`); continue; }
    common(id, html);
    if (metaOf(html, "og:url") !== `${SITE}/${id}`) problems.push(`${id}: wrong og:url`);
  }
  for (const rel of ["404.html", "index.html"]) {
    const html = read(rel);
    if (!html) { problems.push(`${rel}: MISSING`); continue; }
    common(rel, html);
  }

  const expected = items.length + survivors.length + sections.length + 2;
  if (checked !== expected) {
    problems.push(`checked ${checked} pages, expected ${expected} — the sweep missed some`);
  }
  console.log(`prerender-og: verified ${checked} pages (${problems.length} problem(s))`);
  if (problems.length) {
    for (const p of problems.slice(0, 25)) console.error(`  - ${p}`);
    if (problems.length > 25) console.error(`  … ${problems.length - 25} more`);
    // "problem(s)", not "bad page(s)": the base/SITE drift check is not about a page, and a
    // summary that misdescribes what it found is the failure this project keeps correcting.
    console.error(`\n✗ prerender-og: ${problems.length} problem(s) in the generated output.`);
    process.exit(1);
  }
}

function main() {
  const indexPath = path.join(dist, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error("prerender-og: dist/index.html missing — run `vite build` first.");
    process.exit(1);
  }
  const template = fs.readFileSync(indexPath, "utf8");
  const items = JSON.parse(fs.readFileSync(path.join(root, "src/data/items.json"), "utf8"));
  const survivors = JSON.parse(fs.readFileSync(path.join(root, "src/data/survivors.json"), "utf8"));

  // 1) Home page: give the root URL a sensible default card (edit index.html in place).
  fs.writeFileSync(
    indexPath,
    render(template, {
      title: "RoR2 Companion",
      description:
        "A fan-made Risk of Rain 2 companion: a verified item codex, run planner, survivor stat lab, and reference — every number checked against the game itself.",
      image: `${SITE}/icons/crowbar.png`,
      url: `${SITE}/`,
    }),
  );

  // 2) One page per item at /items/<id>/index.html.
  let n = 0;
  for (const item of items) {
    const dir = path.join(dist, "items", item.id);
    fs.mkdirSync(dir, { recursive: true });
    const html = render(template, {
      title: `${item.name} · Risk of Rain 2`,
      description: item.description,
      image: `${SITE}${item.icon}`,
      url: `${SITE}/items/${item.id}`,
    });
    fs.writeFileSync(path.join(dir, "index.html"), html);
    n++;
  }

  // 3) One page per survivor at /survivors/<id>/index.html. No portrait asset exists,
  // so these are text-only cards; the description is built only from verified base
  // stats (never invented prose — CLAUDE.md rule #1).
  const DLC_LABEL = {
    base: "Base game",
    sotv: "Survivors of the Void",
    sots: "Seekers of the Storm",
    ac: "Alloyed Collective",
  };
  let s = 0;
  for (const surv of survivors) {
    const dir = path.join(dist, "survivors", surv.id);
    fs.mkdirSync(dir, { recursive: true });
    const origin = DLC_LABEL[surv.dlc] ?? "Risk of Rain 2";
    const description =
      `${origin} survivor · ${surv.health.base} HP · ${surv.damage.base} base damage · ` +
      `${surv.moveSpeed} m/s. Verified base stats, skills, proc coefficients, and unlock challenge.`;
    const html = render(template, {
      title: `${surv.name} · Risk of Rain 2`,
      description,
      image: undefined, // text-only summary card (no portrait asset)
      url: `${SITE}/survivors/${surv.id}`,
    });
    fs.writeFileSync(path.join(dir, "index.html"), html);
    s++;
  }

  /*
    4) The SECTION routes, and a catch-all. §3j.147.

    These are the reason the site was broken in production, not a nicety. GitHub Pages serves
    static files: it resolves `/planner` by looking for `dist/planner/index.html` and, finding
    nothing, serves its own 404. The SPA fallback this repo carries is `public/_redirects`,
    which is a Netlify/Cloudflare convention that Pages ignores entirely — and the deploy
    workflow publishes to Pages.

    So `/` worked (its redirect to /items is client-side, no server request), and every
    `/items/<id>` and `/survivors/<id>` worked because the loop above happens to write them —
    while `/items`, `/planner`, `/stats`, `/reference` and `/survivors` 404'd on refresh or on
    any shared link. The planner's own "Copy link" button produced URLs that did not load.

    Descriptions mirror each page's on-screen intro rather than inventing new copy.
  */
  const SECTIONS = [
    ["items", "Item Codex", `${items.length} items across every tier and DLC, each traced to the game's own code or serialized assets.`],
    ["planner", "Run Planner", "Mark what you want to target or avoid at printers and scrappers this run. The plan is grouped by tier and saved locally."],
    ["stats", "Stat Lab", "Pick a survivor and level, stack stat items, and watch the derived numbers update. Every formula and base stat is checked against the game's own files."],
    ["reference", "Reference", "The answers the game itself makes hard to find — artifact codes, what each Bazaar dream seeds, and shrine mechanics."],
    ["survivors", "Survivors", "Base stats read from the game's own body prefabs, every loadout skill with its proc coefficient, and the challenge that unlocks each alternate skill."],
  ];
  let sec = 0;
  for (const [id, title, description] of SECTIONS) {
    const dir = path.join(dist, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "index.html"),
      render(template, {
        title: `${title} · Risk of Rain 2`,
        description,
        image: `${SITE}/icons/crowbar.png`,
        url: `${SITE}/${id}`,
      }),
    );
    sec++;
  }

  // The catch-all. Pages serves /404.html for any path with no file, so this is what makes an
  // unknown or mistyped deep link boot the app at all — and the app's own 404 (§3j.146) is
  // what the reader then sees, instead of GitHub's.
  fs.writeFileSync(
    path.join(dist, "404.html"),
    render(template, {
      title: "Page not found · RoR2 Companion",
      description: "That page doesn’t exist. Browse the verified Risk of Rain 2 item codex instead.",
      url: `${SITE}/`,
    }),
  );

  console.log(
    `prerender-og: ${n} item pages + ${s} survivor pages + ${sec} section pages + 404.html + home OG written to dist/`,
  );

  verify({ items, survivors, sections: SECTIONS.map(([id]) => id) });
}

main();
