import { describe, expect, it } from "vitest";
import { coverageSummary, dataVerifiedAgainst } from "./dataProvenance";

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

describe("coverageSummary", () => {
  it("counts only code/asset as verified — langfile is transcription, not truth", () => {
    const c = coverageSummary([
      { confidence: "code" },
      { confidence: "asset" },
      { confidence: "langfile" },
      { confidence: "wiki" },
      {},
    ]);
    expect(c.verified).toBe(2);
    expect(c.total).toBe(5);
    expect(c.percent).toBe(40);
    expect(c.sentence).toContain("2 of 5 items (40%)");
    expect(c.sentence).toMatch(/labelled\s+as unverified/);
  });

  it("does not claim completeness when nothing is verified", () => {
    const c = coverageSummary([{ confidence: "langfile" }, { confidence: "langfile" }]);
    expect(c.percent).toBe(0);
    expect(c.sentence).toContain("0 of 2");
  });
});
