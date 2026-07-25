/**
 * Rewrite the generated blocks of src/data/reference.ts from game-derived data
 * (PLAN §5.0). Run `python scripts/extract-reference.py` first.
 *
 * Regenerates:
 *   - rawArtifacts   descriptions replaced with verbatim ARTIFACT_*_DESCRIPTION text
 *                    (Ambry codes + dlc are preserved — they aren't in the language files)
 *   - BAZAAR_DREAMS  fully regenerated from BAZAAR_SEER_* + SceneDef stageOrder
 *   - LOADOUT_UNLOCKS requirement strings filled from achievement descriptions
 *
 * Records only present in the language files but NOT registered as live content
 * (e.g. Artifact of Spirit) are deliberately excluded — see PLAN §5.0.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const refPath = resolve(root, "src/data/reference.ts");
const data = JSON.parse(readFileSync(resolve(root, ".gamedata/reference.json"), "utf8"));
let src = readFileSync(refPath, "utf8");

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

// ---- 1. Artifact descriptions (verbatim), keeping our codes + dlc -------------
const gameDesc = new Map(data.artifacts.map((a) => [a.name, a.description]));
let descUpdated = 0;
src = src.replace(
  /\{ name: "(Artifact of [^"]+)", effect: "([^"]*)"/g,
  (whole, name, oldEffect) => {
    const next = gameDesc.get(name);
    if (!next || next === oldEffect) return whole;
    descUpdated++;
    return `{ name: "${name}", effect: "${esc(next)}"`;
  },
);

// ---- 2. Bazaar dreams — fully regenerated ------------------------------------
const dreamRows = data.dreams
  .map(
    (d) =>
      `  { dream: "${esc(d.dream)}", stage: "${esc(d.stage)}", stageNumber: "${esc(d.stageNumber)}" },`,
  )
  .join("\n");
const dreamsBlock = `export const BAZAAR_DREAMS: DreamRef[] = [\n${dreamRows}\n];`;
src = src.replace(/export const BAZAAR_DREAMS: DreamRef\[\] = \[[\s\S]*?\n\];/, dreamsBlock);

// ---- 3. Loadout requirements -------------------------------------------------
// challenges is keyed "<Survivor>|<Skill>"; walk each survivor block in order.
let reqFilled = 0;
let reqCorrected = 0;
// NOTE: `\[\n` is deliberate. Survivors with an inline empty list (`skills: [],` —
// Void Fiend, Drifter) must NOT match, otherwise the lazy body runs past them and
// swallows the *next* survivor's rows, silently skipping that survivor.
src = src.replace(
  /survivor: "([^"]+)",\s*\n(\s*)skills: \[\n([\s\S]*?)\n\2\],/g,
  (whole, survivor, indent, body) => {
    const nextBody = body.replace(
      /\{ skill: "([^"]+)", slot: "([^"]+)", challenge: "([^"]+)", requirement: "([^"]*)" \}/g,
      (row, skill, slot, challenge, req) => {
        const hit = data.challenges[`${survivor}|${skill}`];
        if (!hit || hit.requirement === req) return row;
        if (req === "") reqFilled++;
        else reqCorrected++;
        return `{ skill: "${skill}", slot: "${slot}", challenge: "${challenge}", requirement: "${esc(hit.requirement)}" }`;
      },
    );
    return whole.replace(body, nextBody);
  },
);

writeFileSync(refPath, src);
console.log(
  `reference.ts updated — ${descUpdated} artifact description(s) replaced with game text, ` +
    `${data.dreams.length} dreams regenerated, ${reqFilled} requirement(s) filled, ` +
    `${reqCorrected} corrected.`,
);
