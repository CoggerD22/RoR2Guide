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

/** Build the OG/Twitter/title/description head fragment for one page. */
function head({ title, description, image, url }) {
  const t = esc(title), d = esc(description), i = esc(image), u = esc(url);
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="RoR2 Companion">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:image" content="${i}">`,
    `<meta property="og:url" content="${u}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="${i}">`,
  ].join("\n    ");
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
  console.log(`prerender-og: ${n} item pages + home OG written to dist/items/*/index.html`);
}

main();
