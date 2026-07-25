/**
 * Download each artifact's emblem from riskofrain2.wiki.gg into
 * /public/icons/artifacts/<id>.png (PLAN §2.7 / §4.8). This is the same source and
 * usage basis as the item icons: Gearbox art, shown under the site's standing
 * non-affiliation/attribution disclaimer. Idempotent — skips files already present
 * unless --force is passed.
 *
 * File titles on the wiki match the artifact names exactly ("Artifact of Command"),
 * resolved to a direct image URL via the MediaWiki imageinfo API — no hardcoded,
 * hash-versioned URLs.
 *
 * Usage: pnpm tsx scripts/fetch-artifact-icons.ts [--force]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ARTIFACTS } from "../src/data/reference.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const outDir = resolve(root, "public/icons/artifacts");
const API = "https://riskofrain2.wiki.gg/api.php";
const force = process.argv.includes("--force");

// wiki.gg asks scripts to send a descriptive User-Agent and pace their requests.
const UA = "RoR2CompanionSite/1.0 (non-commercial fan project; artifact icon fetch; https://github.com/CoggerD22/RoR2Guide)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with the courtesy UA, retrying on 429 with backoff. */
async function politeFetch(url: string, attempt = 0): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 429 && attempt < 5) {
    const wait = 3000 * (attempt + 1);
    console.log(`  … rate-limited, waiting ${wait / 1000}s`);
    await sleep(wait);
    return politeFetch(url, attempt + 1);
  }
  return res;
}

async function imageUrl(name: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    titles: `File:${name}.png`,
    prop: "imageinfo",
    iiprop: "url",
    format: "json",
  });
  const res = await politeFetch(`${API}?${params}`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { missing?: string; imageinfo?: { url: string }[] }> };
  };
  const pages = data.query?.pages ?? {};
  for (const page of Object.values(pages)) {
    if (page.missing !== undefined) return null;
    if (page.imageinfo?.[0]?.url) return page.imageinfo[0].url;
  }
  return null;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  let downloaded = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const art of ARTIFACTS) {
    const dest = resolve(outDir, `${art.id}.png`);
    if (existsSync(dest) && !force) {
      skipped++;
      continue;
    }
    try {
      const url = await imageUrl(art.name);
      if (!url) {
        failures.push(`${art.name}: no image on wiki`);
        continue;
      }
      const img = await politeFetch(url);
      if (!img.ok) {
        failures.push(`${art.name}: download HTTP ${img.status}`);
        continue;
      }
      writeFileSync(dest, Buffer.from(await img.arrayBuffer()));
      downloaded++;
      console.log(`  ✓ ${art.id}.png`);
    } catch (e) {
      failures.push(`${art.name}: ${(e as Error).message}`);
    }
    await sleep(1200); // be a courteous API consumer
  }

  console.log(`\nartifact icons: ${downloaded} downloaded, ${skipped} already present, ${failures.length} failed`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  if (failures.length) process.exit(1);
}

main();
