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

  console.log(`prerender-og: ${n} item pages + ${s} survivor pages + home OG written to dist/`);
}

main();
