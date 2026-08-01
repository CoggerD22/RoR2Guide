import { describe, expect, it, test } from "vitest";
// The Zod-validated export, not the raw JSON — so these assertions run against the
// same typed data the app consumes.
import { items } from "./items";
import { perStackMeaning, hyperbolicCurve } from "@/lib/stacking";

/**
 * Regression tests for stacking values that were WRONG when derived from the game's
 * description text and are now code-verified (PLAN §6A). Each asserts the value the
 * decompiled C# actually produces, so a future re-import from description prose
 * cannot silently reintroduce the error.
 */
const byId = new Map(items.map((i) => [i.id, i]));

describe("code-verified stacking values", () => {
  it("Bandolier is 20.4% at one stack, not the description's 18%", () => {
    const b = byId.get("bandolier")!;
    // GlobalEventManager: LocalCheckRoll((1f - 1f / Mathf.Pow(n + 1, 0.33f)) * 100f, …)
    const chance = (n: number) => (1 - 1 / Math.pow(n + 1, 0.33)) * 100;
    expect(chance(1)).toBeCloseTo(20.4, 1);
    expect(b.stacking[0].base).toBeCloseTo(20.4, 1);
    expect(b.confidence).toBe("code");
    // The game's own description still says 18% — we quote it, and flag the difference.
    expect(b.description).toContain("18%");
    expect(b.stacking[0].formula).toMatch(/description says 18%/i);
  });

  it("Tougher Times is the hyperbolic ConvertAmp curve, not linear 15%/stack", () => {
    const t = byId.get("tougher-times")!;
    // HealthComponent: Util.ConvertAmplificationPercentageIntoReductionPercentage(15f * n)
    const block = (n: number) => (1 - 100 / (100 + 15 * n)) * 100;
    expect(block(1)).toBeCloseTo(13.04, 1);
    expect(block(10)).toBeCloseTo(60, 1);
    expect(t.stacking[0].type).toBe("hyperbolic");
    expect(t.confidence).toBe("code");
  });

  it("Crowbar is linear +75%/stack, gated above 90% health", () => {
    const c = byId.get("crowbar")!;
    // HealthComponent: num4 *= 1f + 0.75f * n, inside `if (num >= fullCombinedHealth * 0.9f)`
    expect(c.stacking[0].type).toBe("linear");
    expect(c.stacking[0].base).toBe(75);
    expect(c.stacking[0].perStack).toBe(75);
    expect(c.confidence).toBe("code");
  });

  it("Fuel Cell stacks linearly for charges and exponentially for cooldown", () => {
    const f = byId.get("fuel-cell")!;
    // Inventory: charges = 1 + n ; cooldownScale = Mathf.Pow(0.85f, n)
    expect(f.stacking.find((s) => s.type === "linear")?.perStack).toBe(1);
    expect(f.stacking.find((s) => s.type === "exponential")?.perStack).toBe(15);
    expect(Math.pow(0.85, 2)).toBeCloseTo(0.7225, 4);
    expect(f.confidence).toBe("code");
  });

  it("Alien Head is ×0.75 cooldown per stack", () => {
    const a = byId.get("alien-head")!;
    // CharacterBody.RecalculateStats: for (i < count) cooldown *= 0.75f
    expect(a.stacking[0].type).toBe("exponential");
    expect(a.stacking[0].perStack).toBe(25);
    expect(a.confidence).toBe("code");
  });
});

describe("code-verified corrections where the game's own description is wrong", () => {
  const byId2 = new Map(items.map((i) => [i.id, i]));

  it("Stone Flux Pauldron slows by 66.7% at one stack, not the described 50%", () => {
    const s = byId2.get("stone-flux-pauldron")!;
    // RecalculateStats adds the item count to the speed DIVISOR twice — verified at IL
    // level (two `ldloc 46; add` into the divisor; local 46 is stored only twice, a
    // zero-init and the item count, so it is not a reused slot).
    const speed = (n: number) => 1 / (1 + 2 * n);
    expect((1 - speed(1)) * 100).toBeCloseTo(66.7, 1);
    expect((1 - speed(2)) * 100).toBeCloseTo(80, 1);

    const entry = s.stacking.find((e) => e.type === "reciprocal")!;
    expect(entry.base).toBeCloseTo(66.7, 1);
    expect(s.confidence).toBe("code");
    // The game still says 50% — we quote it and flag the difference.
    expect(s.description).toContain("50%");
    expect(entry.formula).toMatch(/description says 50%/i);
  });

  it("Hiker's Boots' ceiling scales with stacks, so it carries no fixed capStacks", () => {
    const h = byId2.get("hikers-boots")!;
    const entry = h.stacking[0];
    // GlobalEventManager: num = 10 * itemCountEffective — +10% at 1 stack, +20% at 2.
    expect(entry.cap).toMatch(/10 x item count/i);
    expect(entry.capStacks).toBeUndefined();
    expect(h.confidence).toBe("code");
  });

  it("items with a fixed ceiling do carry capStacks, so the planner can warn", () => {
    expect(byId2.get("focused-convergence")!.stacking.every((e) => e.capStacks === 3)).toBe(true);
    expect(
      byId2.get("lens-makers-glasses")!.stacking.some((e) => e.capStacks === 10),
    ).toBe(true);
  });
});

describe("luck — the shared mechanic behind 57 Leaf Clover and Purity", () => {
  const byId3 = new Map(items.map((i) => [i.id, i]));

  // Util.CheckRoll: rolls 1 + ceil(|luck|) times, keeping Mathf.Min (best) when luck
  // is positive and Mathf.Max (worst) when negative.
  const effective = (p: number, luck: number) =>
    luck >= 0 ? 1 - Math.pow(1 - p, 1 + luck) : Math.pow(p, 1 - luck);

  it("positive luck is best-of-N: a 10% proc becomes 19% at one Clover", () => {
    expect(effective(0.1, 0) * 100).toBeCloseTo(10, 5);
    expect(effective(0.1, 1) * 100).toBeCloseTo(19, 5);
    expect(effective(0.1, 2) * 100).toBeCloseTo(27.1, 5);
  });

  it("negative luck is worst-of-N: Purity drops a 10% proc to ~1%", () => {
    expect(effective(0.1, -1) * 100).toBeCloseTo(1, 5);
  });

  it("both items are code-verified and document the shared luck formula", () => {
    const clover = byId3.get("57-leaf-clover")!;
    const purity = byId3.get("purity")!;
    expect(clover.confidence).toBe("code");
    expect(purity.confidence).toBe("code");
    for (const it of [clover, purity]) {
      expect(it.stacking.some((s) => /Util\.CheckRoll/.test(s.formula ?? ""))).toBe(true);
    }
  });

  it("Purity records its luck PENALTY, not just its cooldown reduction", () => {
    // The description states both effects; the dataset originally carried only the
    // cooldown one, so the downside was invisible on a Lunar item that is all downside.
    const purity = byId3.get("purity")!;
    expect(purity.stacking).toHaveLength(2);
    expect(purity.stacking.some((s) => /luck/i.test(s.stat))).toBe(true);
  });
});

describe("Elusive Antlers — three separate errors in one item", () => {
  const antlers = items.find((i) => i.id === "elusive-antlers")!;

  it("spawn interval is hyperbolic, not -10% per stack", () => {
    // ElusiveAntlersBehavior: spawnTimer = 10f - (1f - 3f/(3f + n - 1f)) * 8f
    const interval = (n: number) => 10 - (1 - 3 / (n + 2)) * 8;
    expect(interval(1)).toBeCloseTo(10, 5);
    expect(interval(2)).toBeCloseTo(8, 5); // the old "-10%/stack" model said 9s
    expect(interval(3)).toBeCloseTo(6.8, 5);
    expect(interval(1000)).toBeGreaterThan(2); // asymptotic, never reaches 2s

    const entry = antlers.stacking.find((s) => /interval/i.test(s.stat))!;
    expect(entry.formula).toMatch(/10 - \(1 - 3\/\(n\+2\)\) x 8/);
  });

  it("records the barrier effect the in-game description omits entirely", () => {
    // ElusiveAntlersPickup prefab: baseBarrierAmount 10, +7 per additional stack.
    const barrier = antlers.stacking.find((s) => /barrier/i.test(s.stat));
    expect(barrier, "barrier effect must be recorded").toBeDefined();
    expect(barrier!.base).toBe(10);
    expect(barrier!.perStack).toBe(7);
    expect(antlers.description).not.toMatch(/barrier/i); // the game never mentions it
  });

  it("max orbs is 3 per stack and speed per orb is flat 12%", () => {
    // GetElusiveAntlersCurrentMaxStack: 3 + 3(n-1); RecalculateStats: 0.12f * buffCount
    const orbs = antlers.stacking.find((s) => /orbs/i.test(s.stat) && s.type === "linear")!;
    expect(orbs.base).toBe(3);
    expect(orbs.perStack).toBe(3);
    const speed = antlers.stacking.find((s) => s.type === "none")!;
    expect(speed.base).toBe(12);
    expect(speed.formula).toMatch(/7s/); // prefab says the buff lasts 7s, not the described 12s
  });
});

describe("linear coefficients confirmed against code", () => {
  const byId4 = new Map(items.map((i) => [i.id, i]));

  it("Brilliant Behemoth adds 2.5m per stack, not the described 1.5m", () => {
    // GlobalEventManager: radius = (1.5f + 2.5f * count) * damageInfo.procCoefficient
    const radius = (n: number, proc = 1) => (1.5 + 2.5 * n) * proc;
    expect(radius(1)).toBe(4); // matches the description's 4m at one stack…
    expect(radius(2)).toBe(6.5); // …but +1.5/stack would predict 5.5m
    expect(radius(1, 0.5)).toBe(2); // and proc coefficient scales it

    const bb = byId4.get("brilliant-behemoth")!;
    expect(bb.stacking[0].base).toBe(4);
    expect(bb.stacking[0].perStack).toBe(2.5);
    expect(bb.confidence).toBe("code");
    expect(bb.stacking[0].formula).toMatch(/procCoefficient/);
  });

  it("spot-checks linear items whose coefficient was traced to code", () => {
    const expected: Record<string, [number, number]> = {
      "armor-piercing-rounds": [20, 20], // num4 *= 1f + 0.2f * n
      "atg-missile-mk-1": [300, 300], // damageCoefficient = 3f * n
      brainstalks: [4, 4], // AddTimedBuff(NoCooldowns, n * 4f)
      "ceremonial-dagger": [150, 150], // 1.5f * n
      "charged-perforator": [500, 500], // 5f * n
      "bundle-of-fireworks": [8, 4], // 4 + n * 4
    };
    for (const [id, [base, perStack]] of Object.entries(expected)) {
      const it = byId4.get(id)!;
      expect(it, `${id} should exist`).toBeDefined();
      expect(it.stacking[0].base, `${id} base`).toBe(base);
      expect(it.stacking[0].perStack, `${id} perStack`).toBe(perStack);
      expect(it.confidence, `${id} confidence`).toBe("code");
    }
  });
});

/**
 * §9: "N base, +M per stack" is a sentence that is only true for linear rows.
 * These lock the presentation of the 28 non-linear rows to something the reader can
 * act on, and pin the hyperbolic curve to the game's universal formula.
 */
test("every non-linear stacking type says what its per-stack number means", () => {
  expect(perStackMeaning("linear")).toBeNull();
  for (const t of ["hyperbolic", "exponential", "reciprocal", "special"] as const) {
    expect(perStackMeaning(t), t).toBeTruthy();
  }
});

test("no non-linear row is left presenting a bare additive per-stack number", () => {
  const bare: string[] = [];
  for (const item of items) {
    for (const e of item.stacking) {
      if (e.type === "linear" || e.perStack === 0) continue;
      if (!perStackMeaning(e.type)) bare.push(`${item.name}: ${e.stat} (${e.type})`);
    }
  }
  expect(bare, bare.join("\n")).toEqual([]);
});

test("hyperbolic rows resolve to the game's curve, not to base x stacks", () => {
  const tougher = items.find((i) => i.id === "tougher-times")!;
  const row = tougher.stacking.find((s) => s.type === "hyperbolic")!;
  const curve = hyperbolicCurve(row)!;
  expect(curve.find((p) => p.n === 1)!.v).toBeCloseTo(13.043, 3); // NOT 15
  expect(curve.find((p) => p.n === 2)!.v).toBeCloseTo(23.077, 3); // NOT 30
  expect(curve.find((p) => p.n === 10)!.v).toBeCloseTo(60, 5);
});

test("Unstable Transmitter is hyperbolic in a different shape and draws no curve", () => {
  // perStack is 0 there: the stack term lives inside its own formula, so a generic
  // curve would be an invention.
  const ut = items.find((i) => i.id === "unstable-transmitter")!;
  const row = ut.stacking.find((s) => s.type === "hyperbolic")!;
  expect(hyperbolicCurve(row)).toBeNull();
});

/**
 * §9: the last standing data:audit warning ("Fuel Array has a 60s cooldown but the
 * description never states it") was pointing at a real defect, not a game quirk. Fuel
 * Array has no fire handler in EquipmentSlot at all — the behaviour is a state machine on
 * the body — so there was nothing for a cooldown to gate.
 */
test("Fuel Array is passive, and carries the numbers its description omits", () => {
  const fa = items.find((i) => i.id === "fuel-array")!;
  expect(fa.cooldown).toBeUndefined();
  expect(fa.activated).toBe(false);
  expect(fa.confidence).toBe("code");

  const by = (re: RegExp) => fa.stacking.find((s) => re.test(s.stat));
  expect(by(/threshold/i)?.base).toBe(50); // healthFractionDetonationThreshold = 0.5f
  expect(by(/Fuse/i)?.base).toBe(3); // CountDown.duration
  expect(by(/radius/i)?.base).toBe(30); // CountDown.explosionRadius
  expect(by(/Damage/i)?.base).toBe(300); // fullCombinedHealth * 3f

  // The two facts a player actually needs and the game never states.
  expect(by(/radius/i)?.formula).toMatch(/falloffModel = None/);
  expect(fa.descriptionNote).toMatch(/regardless of whether you heal back up/);
});

/**
 * §6A tail: equipment traced from EquipmentSlot's handler down to the prefab components
 * that actually hold the numbers. These pin the facts the in-game text does not carry —
 * each one is the reason the item stopped being langfile-only.
 */
test("Radar Scanner sweeps once, not for ten seconds", () => {
  const x = items.find((i) => i.id === "radar-scanner")!;
  expect(x.confidence).toBe("code");
  expect(x.stacking.find((s) => /radius/i.test(s.stat))?.base).toBe(500);
  // DestroyOnTimer 5s against a pulseInterval of 10s leaves room for exactly one pulse.
  expect(x.stacking.find((s) => /Pulses/i.test(s.stat))?.base).toBe(1);
  expect(x.descriptionNote).toMatch(/snapshot|sweeps once/i);
});

test("Executive Card's real floor is the 0.5s subcooldown, not the 0.1s cooldown", () => {
  const x = items.find((i) => i.id === "executive-card")!;
  expect(x.cooldown).toBeCloseTo(0.1, 4);
  expect(x.stacking.find((s) => /gap between uses/i.test(s.stat))?.base).toBe(0.5);
});

test("Glowing Meteorite's '20' is a wave count, not seconds", () => {
  const x = items.find((i) => i.id === "glowing-meteorite")!;
  expect(x.stacking.find((s) => /^Waves$/.test(s.stat))?.base).toBe(20);
  expect(x.stacking.find((s) => /Damage per blast/.test(s.stat))?.base).toBe(600);
  expect(x.descriptionNote).toMatch(/20 WAVES/);
});

test("Forgive Me Please only ticks while the doll is stuck", () => {
  const x = items.find((i) => i.id === "forgive-me-please")!;
  expect(x.stacking.find((s) => /On-kill triggers/.test(s.stat))?.base).toBe(8);
  expect(x.descriptionNote).toMatch(/STUCK/);
});

/**
 * Milky Chrysalis is the honest half-result: duration and boost are code-verified, and the
 * description's flat "+20% movement speed" is nowhere in JetpackController or
 * RecalculateStats. It stays langfile because a partly-traced item is not a traced one.
 */
test("Milky Chrysalis records what was traced and does not claim the rest", () => {
  const x = items.find((i) => i.id === "milky-chrysalis")!;
  expect(x.confidence).toBe("langfile");
  expect(x.stacking.find((s) => /Flight duration/.test(s.stat))?.base).toBe(15);
  expect(x.descriptionNote).toMatch(/NOT verified/);
});

/**
 * Ghor's Tome's payout was recorded as untraceable in an earlier pass — BonusMoneyPack
 * carries no `goldReward`. It carries a MoneyPickup with `baseGoldReward`, and the item's
 * OWN bundle name is what distinguishes its 25 from the identical 25 on a DLC3 drone pack
 * and from VoidCoinBarrel's — the same name-collision that has misattributed data here
 * three times before.
 */
test("Ghor's Tome: chance and payout are both traced, from different places", () => {
  const x = items.find((i) => i.id === "ghors-tome")!;
  expect(x.confidence).toBe("code");
  const chance = x.stacking.find((s) => /Chance on kill/i.test(s.stat))!;
  expect(chance.base).toBe(4);
  expect(chance.perStack).toBe(4);
  expect(chance.type).toBe("linear"); // NOT the usual hyperbolic on-hit curve
  const gold = x.stacking.find((s) => /Treasure value/i.test(s.stat))!;
  expect(gold.base).toBe(25);
  expect(gold.formula).toMatch(/bonusgoldpackonkill/);
});

test("Box of Dynamite scales off the drone's damage, not yours", () => {
  const x = items.find((i) => i.id === "box-of-dynamite")!;
  expect(x.confidence).toBe("code");
  const dmg = x.stacking.find((s) => /Dynamite damage/i.test(s.stat))!;
  expect(dmg.base).toBe(240);
  expect(dmg.perStack).toBe(85);
  // The recharge is flat: extra copies buy damage, never rate.
  expect(x.stacking.find((s) => /Recharge/i.test(s.stat))?.perStack).toBe(0);
  expect(x.descriptionNote).toMatch(/DRONE's damage, not yours/);
});
