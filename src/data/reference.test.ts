import { test, expect } from "vitest";
import { ARTIFACTS } from "./reference";

/**
 * §9: the mechanic layer existed on 7 of 20 artifacts, and the doc comment claimed the
 * other 13 were omitted because the code "adds nothing". Reading each implementation
 * showed that was false for all 13 — Honor only ever rolls four elite types, Command
 * deletes multishops and scrappers from the stage, Delusion's wrong answer deletes one of
 * your own items. This fails if an artifact is ever added without one.
 */
test("every artifact carries a verified mechanic, not just the game's blurb", () => {
  const missing = ARTIFACTS.filter((a) => !a.mechanic).map((a) => a.name);
  expect(missing, missing.join(", ")).toEqual([]);
});

test("no artifact mechanic merely restates its description", () => {
  const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const lazy: string[] = [];
  for (const a of ARTIFACTS) {
    const e = words(a.effect);
    const m = words(a.mechanic!);
    // A mechanic that adds nothing beyond the description's own vocabulary is a
    // paraphrase, and a paraphrase in a field labelled "from game code" is a lie.
    const added = [...m].filter((w) => !e.has(w)).length;
    if (added < 10) lazy.push(`${a.name}: only ${added} new terms`);
  }
  expect(lazy, lazy.join("\n")).toEqual([]);
});

test("Ambry codes: exactly one artifact is not code-unlocked", () => {
  // 19 PortalDialerCode entries were recovered from the game; Rebirth has none, and is
  // unlocked at a Shrine of Rebirth instead (ShrineRebirthController grants
  // "Artifacts.Rebirth"). The null is a verified absence, not a gap in our data.
  const without = ARTIFACTS.filter((a) => a.code === null).map((a) => a.name);
  expect(without).toEqual(["Artifact of Rebirth"]);
  expect(ARTIFACTS.filter((a) => a.code !== null)).toHaveLength(19);
});
