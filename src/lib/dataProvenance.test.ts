import { describe, expect, it } from "vitest";
import { dataVerifiedAgainst } from "./dataProvenance";

describe("dataVerifiedAgainst", () => {
  const base = {
    contentVersion: "Alloyed Collective",
    buildId: "21587608",
    verifiedOn: "2026-07-19",
  };

  it("falls back to DLC + build when the patch number is unknown (the honest default)", () => {
    const s = dataVerifiedAgainst({ ...base, patchVersion: null });
    expect(s).toBe(
      "Data verified against Alloyed Collective (Steam build 21587608) on 2026-07-19.",
    );
    // Never fabricates a patch number.
    expect(s).not.toMatch(/patch/i);
  });

  it("includes the patch number once it's recorded", () => {
    const s = dataVerifiedAgainst({ ...base, patchVersion: "1.4.3" });
    expect(s).toBe(
      "Data verified against patch 1.4.3 (Alloyed Collective, Steam build 21587608) on 2026-07-19.",
    );
  });
});
