import { createHash } from "node:crypto";
import { test, expect } from "vitest";
import { ARTIFACTS } from "./reference";
import HASHES from "./ambry-hashes.json" with { type: "json" };

/**
 * Every published Ambry code must hash to one the game actually validates against.
 *
 * The codes were the last data on the site sourced only from the community wiki, because
 * `PortalDialerController` never stores them — it stores SHA-256 digests and hashes the
 * dialled sequence to compare:
 *
 *     Sha256Hash result = GetResult(sequence);            // SHA-256 over byte[9]
 *     if (result.Equals(reference.hashAsset.value)) ...   // stored Sha256HashAsset
 *
 * That makes them unreadable, not unknowable: the dialer prefab has 9 buttons and there are
 * exactly five `ArtifactCompoundDef`s, so the space is 5^9 = 1,953,125.
 * `scripts/crack-ambry-codes.py` recovers all 19 and this test re-derives each published
 * code's digest and requires a hit — so a single wrong glyph fails the build, with no game
 * install needed (the 19 digests are committed; they are derived values, not game content).
 *
 * The button permutation is load-bearing, not cosmetic. `sequenceServer[i]` is indexed by
 * position in the prefab's `buttons` array, and that array is scrambled relative to the
 * buttons' own names — index [0..8] holds buttons 3,6,9,2,8,5,1,4,7, while their transforms
 * show the names run row-major. Codes are written in name order, so the sequence has to be
 * un-permuted before hashing. Getting this wrong initially made 17 of 19 codes look wrong.
 */

/** ArtifactCompoundDef.value for each glyph. */
const GLYPH_VALUE: Record<string, number> = { "●": 1, "▲": 3, "♦": 5, "■": 7, "·": 11 };
/** Button name (1..9, row-major) -> index in the prefab's `buttons` array. */
const NAME_TO_INDEX = [6, 3, 0, 7, 5, 1, 8, 4, 2];

const digests = new Set(Object.values(HASHES as Record<string, string>));

test("the committed digest set is the game's 19 dialer hashes", () => {
  expect(digests.size).toBe(19);
});

test("every published Ambry code is one the game accepts", () => {
  const failures: string[] = [];
  let checked = 0;

  for (const a of ARTIFACTS) {
    if (!a.code) continue; // Artifact of Rebirth has no dialer action.
    const glyphs = [...a.code.replace(/\s+/g, "")];
    if (glyphs.length !== 9) {
      failures.push(`${a.name}: ${glyphs.length} glyphs, expected 9`);
      continue;
    }
    const seq = new Uint8Array(9);
    let ok = true;
    glyphs.forEach((g, nameIdx) => {
      const v = GLYPH_VALUE[g];
      if (v === undefined) { failures.push(`${a.name}: unknown glyph "${g}"`); ok = false; return; }
      seq[NAME_TO_INDEX[nameIdx]] = v;
    });
    if (!ok) continue;

    checked++;
    const digest = createHash("sha256").update(seq).digest("hex");
    if (!digests.has(digest)) {
      failures.push(`${a.name}: "${a.code}" -> ${digest.slice(0, 16)}… is not a sequence the game accepts`);
    }
  }

  expect(checked, "expected 19 artifacts to carry a code").toBe(19);
  expect(failures, failures.join("\n")).toEqual([]);
});
