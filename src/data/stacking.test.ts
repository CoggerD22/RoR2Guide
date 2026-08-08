import { describe, expect, it, test } from "vitest";
// The Zod-validated export, not the raw JSON — so these assertions run against the
// same typed data the app consumes.
import { items } from "./items";
import { perStackMeaning, hyperbolicCurve } from "@/lib/stacking";
import { ARTIFACTS, SHRINES } from "./reference";
import skills from "./skills.json";
import { procProvenance } from "./skills";

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

// (Removed: a test asserting FireVendingMachine's 0.5s subcooldown belonged to Executive
// Card. It belongs to Remote Caffeinator — see the pair of tests at the end of this file.
// The test passed for two passes because it was checking our own mistake against itself.)

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
/**
 * An earlier pass recorded that the +20% "appears nowhere in JetpackController and is not in
 * RecalculateStats". The second half was wrong: it is there, keyed on Buffs.BugWings, whose
 * name resembles neither the item nor the controller. The claim is now split — effect and
 * magnitude verified, application site still open.
 */
test("Milky Chrysalis: nothing applies the buff its +20% depends on", () => {
  const x = items.find((i) => i.id === "milky-chrysalis")!;
  expect(x.confidence).toBe("langfile");
  expect(x.stacking.find((s) => /Flight duration/.test(s.stat))?.base).toBe(15);

  const ms = x.stacking.find((s) => /Movement speed/.test(s.stat))!;
  expect(ms.base).toBe(20);
  expect(ms.formula).toMatch(/BugWings/);

  // The claim is now a CLOSED negative, so what it must carry is the SCOPE of the search.
  // A "nothing applies it" that does not say where it looked is the §3j.80 failure again.
  // Both places a reference could live: every managed assembly, and every bundle.
  expect(ms.formula).toMatch(/143 managed assemblies/);
  expect(ms.formula).toMatch(/Assembly-CSharp/); // the second assembly, decompiled and checked
  expect(ms.formula).toMatch(/externals table/); // the cross-bundle reverse scan
  expect(ms.formula).toMatch(/NOTHING APPLIES IT/);
  // And it must not quietly rewrite the game's own number on the strength of a negative.
  expect(ms.formula).toMatch(/Left as the game states it/);
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

/**
 * OverlapAttack composes a fire cadence with a reset cadence, and the RESET is what caps
 * how often one enemy can be hit — `Fire()` skips anything already in the ignore list.
 * Reading that pair is what resolved three items left ambiguous a pass earlier, and it
 * turns two "hit rates" into "once, ever".
 */
test("Volcanic Egg: the ram hits once per enemy and refunds the whole duration", () => {
  const x = items.find((i) => i.id === "volcanic-egg")!;
  expect(x.confidence).toBe("code");
  expect(x.stacking.find((s) => /Ram damage/.test(s.stat))?.base).toBe(500);
  expect(x.stacking.find((s) => /Detonation/.test(s.stat))?.base).toBe(800);
  // duration is 5 and the refund per hit is also 5 — a floor, not a cap.
  expect(x.stacking.find((s) => /refunded/.test(s.stat))?.base).toBe(5);
  expect(x.descriptionNote).toMatch(/floor, not a cap/);
});

test("Sawmerang cannot hit the same enemy twice, whatever the text says", () => {
  const x = items.find((i) => i.id === "sawmerang")!;
  expect(x.stacking.find((s) => /Saws thrown/.test(s.stat))?.base).toBe(3);
  expect(x.stacking.find((s) => /Damage per saw/.test(s.stat))?.base).toBe(400);
  // resetInterval = -1 disables the reset; BoomerangProjectile never calls it manually.
  expect(x.descriptionNote).toMatch(/resetInterval = -1/);
  expect(x.descriptionNote).toMatch(/Cleaver/); // the item that DOES implement return hits
  expect(x.confidence).toBe("langfile"); // bleed clause still untraced
});

/**
 * Settled by resolving both hops of the child chain in-bundle — cluster -> 6 bomblets ->
 * puddle, childrenDamageCoefficient 1 at each step, and ProjectileExplosion passes children
 * `projectileDamage.damage * childrenDamageCoefficient`. So base damage survives intact and
 * the puddle's `damageCoefficient = 1` at `fireFrequency = 1` is 100%/s, half what the
 * description claims. Same method as the Encrusted Key drop table.
 */
test("Molotov: 500% is impact plus burn total, and the puddle is 100%/s not 200%", () => {
  const x = items.find((i) => i.id === "molotov-6-pack")!;
  expect(x.confidence).toBe("code");
  expect(x.stacking.find((s) => /Bomblets/.test(s.stat))?.base).toBe(6);
  expect(x.stacking.find((s) => /Impact damage/.test(s.stat))?.base).toBe(250);
  expect(x.stacking.find((s) => /Burn total/.test(s.stat))?.base).toBe(250);
  const puddle = x.stacking.find((s) => /puddle damage/i.test(s.stat))!;
  expect(puddle.base).toBe(100); // the game's text says 200
  expect(puddle.formula).toMatch(/nothing here is\s+inferred|nothing here is inferred/);
  expect(x.descriptionNote).toMatch(/twice what the game does/);
});

/**
 * Sawmerang is the counter-example held one step short: the contact rate is computed from
 * verified fields, but which clause of the description it answers is not established, so it
 * is NOT published as a correction. What IS published is a clean negative — the prefab's
 * damageType is entirely empty, so the item applies no bleed at all.
 */
test("Sawmerang applies no bleed, and its contact rate stays unattributed", () => {
  const x = items.find((i) => i.id === "sawmerang")!;
  expect(x.confidence).toBe("langfile");
  const bleed = x.stacking.find((s) => /Bleed applied/.test(s.stat))!;
  expect(bleed.base).toBe(0);
  expect(bleed.formula).toMatch(/damageType/);
  expect(x.stacking.find((s) => /Blade contact/.test(s.stat))?.formula).toMatch(
    /not comparable without a contact duration/,
  );
});

/**
 * Sale Star's formula field previously surrendered: "the stated 5%-per-stack chance is not
 * in that path". It was in a different file — InteractionDriver only decides which
 * interactables glow; PurchaseInteraction holds the whole mechanic.
 */
test("Sale Star: the whole stack is consumed, and the 5% is hyperbolic from 3 up", () => {
  const x = items.find((i) => i.id === "sale-star")!;
  expect(x.confidence).toBe("code");
  // dropCount = 2 + num2, and num2 is hardcoded 0 at one star.
  expect(x.stacking.find((s) => /first compatible purchase/i.test(s.stat))?.base).toBe(2);
  const chance = x.stacking.find((s) => /3rd/.test(s.stat))!;
  expect(chance.base).toBe(30);
  expect(chance.type).toBe("hyperbolic"); // not the linear row it used to be
  expect(x.descriptionNote).toMatch(/consumed by the first/);
});

test("Prison Matrix multiplies armor rather than adding to it", () => {
  const x = items.find((i) => i.id === "prison-matrix")!;
  expect(x.confidence).toBe("code");
  expect(x.stacking[0].base).toBe(1.5); // armor *= 1.5f
  // The consequence a reader needs: it does nothing on a 0-armor survivor.
  expect(x.descriptionNote).toMatch(/0 base armor/);
});

test("Sentry Key is additive into the movement pool, and does not stack", () => {
  const x = items.find((i) => i.id === "sentry-key")!;
  expect(x.confidence).toBe("code");
  expect(x.stacking[0].base).toBe(15);
  expect(x.stacking[0].perStack).toBe(0);
  expect(x.stacking[0].formula).toMatch(/Goat Hoof/);
});

/**
 * Defense Nucleus was the item that named the tooling gap: its 300%/300% lives in a
 * CharacterSpawnCard.itemsToGrant array, and extract-component-fields.py read only
 * top-level scalars — so a ScriptableObject whose interesting content is entirely arrays
 * produced an empty field dict and was DISCARDED, not merely thinned. Teaching the
 * extractor to descend one level into lists closed it.
 */
test("Defense Nucleus: the construct's bonus is 30 boost items, not a bare claim", () => {
  const x = items.find((i) => i.id === "defense-nucleus")!;
  expect(x.confidence).toBe("code");
  expect(x.stacking.find((s) => /Max Alpha Constructs/i.test(s.stat))?.perStack).toBe(4);
  const bonus = x.stacking.find((s) => /bonus/i.test(s.stat))!;
  expect(bonus.base).toBe(300);
  // 30 x BoostHp and 30 x BoostDamage, each +10% in RecalculateStats.
  expect(bonus.formula).toMatch(/count 30/);
  // The residual has to stay stated: the ItemDef pointers never resolved.
  expect(bonus.formula).toMatch(/Read: both counts/);
  expect(bonus.formula).toMatch(/Inferred:/);
});

/**
 * Three elite Aspects, traced to CharacterBody / their attachment prefabs. Each carries a
 * mechanic the "Gain the power of a X Elite" blurb cannot express.
 */
test("His Reassurance heals ONE ally per tick, not everyone in range", () => {
  const x = items.find((i) => i.id === "his-reassurance")!;
  expect(x.confidence).toBe("code");
  expect(x.stacking.find((s) => /Allies healed/.test(s.stat))?.base).toBe(1); // maxTargets = 1
  expect(x.stacking.find((s) => /Healing/.test(s.stat))?.base).toBe(120); // 1.2/s of YOUR damage
  expect(x.stacking.find((s) => /radius/i.test(s.stat))?.base).toBe(30);
  expect(x.descriptionNote).toMatch(/one ally at a time/);
});

/**
 * Aurelionite's two projectile prefabs carry blastDamageCoefficients of 0.1 and 1.0, which
 * look nothing like the stated 15% and 150% — until you see they are fired with
 * `damage * aurelioniteAttackDamageCoeff` where that constant is 1.5. Publishing from the
 * prefab alone would have "corrected" two numbers that were right.
 */
test("Aurelionite's Blessing: 1.5x fire-time coefficient reconciles the prefab values", () => {
  const x = items.find((i) => i.id === "aurelionites-blessing")!;
  expect(x.confidence).toBe("code");
  expect(x.stacking.find((s) => /Spike damage/.test(s.stat))?.base).toBe(150);
  expect(x.stacking.find((s) => /Gold per hit/.test(s.stat))?.base).toBe(8);
  // The behaviour's 10-13s timer belongs to the monster path, not to a holder.
  const tel = x.stacking.find((s) => /Telegraph/.test(s.stat))!;
  expect(tel.formula).toMatch(/is NOT yours/);
});

test("N'kuhana's Retort: the orb count scales with your body radius", () => {
  const x = items.find((i) => i.id === "nkuhanas-retort")!;
  expect(x.confidence).toBe("code");
  expect(x.stacking.find((s) => /volleys/.test(s.stat))?.base).toBe(6);
  expect(x.stacking.find((s) => /Orbs per volley/.test(s.stat))?.base).toBe(4); // 3 + (int)radius
  // The healing-disable is proc-scaled, which the description does not say.
  expect(x.stacking.find((s) => /Healing-disabled/.test(s.stat))?.formula).toMatch(/procCoefficient/);
});

/**
 * Of One Mind completes the elite Aspects. Its dome-downtime value is the clearest case
 * this project has for reading PREFABS rather than classes: the C# field initialiser is
 * 10f and the serialized value is 8, and only the 8 agrees with the game's own text.
 */
test("Of One Mind: prefab value wins over the class default, and the 25% does not stack", () => {
  const x = items.find((i) => i.id === "of-one-mind")!;
  expect(x.confidence).toBe("code");
  expect(x.stacking.find((s) => /Dome radius/.test(s.stat))?.base).toBe(30);
  expect(x.stacking.find((s) => /downtime/.test(s.stat))?.base).toBe(8); // not the 10f default
  expect(x.stacking.find((s) => /downtime/.test(s.stat))?.formula).toMatch(/initialiser is 10f/);
  // `if (num75 > 0) num113 *= 0.75f` — a presence check, so overlapping domes do nothing extra.
  expect(x.stacking.find((s) => /cooldown multiplier/.test(s.stat))?.base).toBe(0.75);
  expect(x.descriptionNote).toMatch(/presence check/);
});

test("every elite Aspect is now code-verified", () => {
  const aspects = ["nkuhanas-retort", "his-reassurance", "of-one-mind", "aurelionites-blessing"];
  for (const id of aspects) {
    const x = items.find((i) => i.id === id);
    expect(x, id).toBeTruthy();
    expect(x!.confidence, id).toBe("code");
    expect(x!.stacking.length, id).toBeGreaterThan(0);
  }
});

/**
 * Defensive Microbots was blocked last pass on "only the allies field came back from the
 * prefab scan". The cause was the extractor's own noise filter: `Layer$` under re.I matches
 * the trailing "layer" inside "P|layer", so every serialized field ending in "Player" had
 * been dropped from every query ever run. The fields were there the whole time.
 */
test("Defensive Microbots: the 0.5s is a recharge, and the scan is far faster", () => {
  const x = items.find((i) => i.id === "defensive-microbots")!;
  expect(x.confidence).toBe("code");
  // itemStack is literally the loop bound in DeleteNearbyProjectile.
  expect(x.stacking.find((s) => /Projectiles shot down/.test(s.stat))?.perStack).toBe(1);
  expect(x.stacking.find((s) => /radius/i.test(s.stat))?.base).toBe(20);
  // baseRechargeFrequency 2 x attackSpeed, but minimumFireFrequency 10 governs the search.
  const rate = x.stacking.find((s) => /Volleys per second/.test(s.stat))!;
  expect(rate.base).toBe(2);
  expect(rate.formula).toMatch(/minimumFireFrequency = 10/);
  expect(x.stacking.find((s) => /Granted free to Captain/.test(s.stat))?.base).toBe(1);
});

/**
 * Orphaned Core's numbers were not in a component at all — they are in an
 * EntityStateConfiguration, which is a different extractor's territory. The searches that
 * failed were looking in the right game but the wrong one of the three hiding places.
 *
 * It also corroborates §3j.70: the "(n-1) x 10 BoostDamage" idiom appears here with the item
 * named explicitly in C#, which is the same pattern Defense Nucleus's unresolvable pointers
 * were inferred to be.
 */
test("Orphaned Core: per-stack damage is boost items, not a bigger coefficient", () => {
  const x = items.find((i) => i.id === "orphaned-core")!;
  expect(x.confidence).toBe("code");
  const launch = x.stacking.find((s) => /Launch damage/.test(s.stat))!;
  expect(launch.base).toBe(400); // chargeDamageCoefficient = 4
  expect(launch.perStack).toBe(400);
  expect(launch.formula).toMatch(/\(newStack - 1\) \* 10` BoostDamage/);
  expect(x.stacking.find((s) => /Lock-on/.test(s.stat))?.base).toBe(30);
  expect(x.stacking.find((s) => /Knockback/.test(s.stat))?.base).toBe(1000);
  expect(x.stacking.find((s) => /Curse stacks/.test(s.stat))?.base).toBe(5);
});

test("The Crowdfunder: the fire rate ramps and the cost is keyed to team level", () => {
  const x = items.find((i) => i.id === "the-crowdfunder")!;
  expect(x.confidence).toBe("code");
  expect(x.stacking.find((s) => /Damage per bullet/.test(s.stat))?.base).toBe(100);
  // Lerp(3, 15, t) over a 10s wind-up — the description mentions neither end of it.
  expect(x.stacking.find((s) => /Fire rate/.test(s.stat))?.base).toBe(3);
  expect(x.stacking.find((s) => /Gold per bullet/.test(s.stat))?.formula).toMatch(/GetTeamLevel/);
});

/**
 * Halcyon Seed is a real correction, the same class as Stun Grenade's linear -> hyperbolic:
 * the game's text says "+50% per stack" damage and GoldTitanManager raises the coefficient
 * by `Mathf.Pow(totalItemCount, 0.5f)`. Linear matches only the first stack.
 */
test("Halcyon Seed: Aurelionite's damage is sqrt(stacks), health is linear", () => {
  const x = items.find((i) => i.id === "halcyon-seed")!;
  expect(x.confidence).toBe("code");

  const dmg = x.stacking.find((s) => /damage/i.test(s.stat))!;
  expect(dmg.type).toBe("special"); // was "linear" at +50
  expect(dmg.perStack).toBe(0); // no single per-stack number can express sqrt
  expect(dmg.formula).toMatch(/sqrt\(n\)/);

  const hp = x.stacking.find((s) => /health/i.test(s.stat))!;
  expect(hp.type).toBe("linear"); // this half of the description was right
  expect(hp.perStack).toBe(100);

  // Pooled across players, which the description does not say at all.
  expect(x.descriptionNote).toMatch(/ALL players' seeds/);
});

/**
 * §3j.66 attributed FireVendingMachine's subcooldown and 1000m raycast to EXECUTIVE CARD.
 * Wrong item: EQUIPMENT_VENDINGMACHINE_NAME is "Remote Caffeinator", and Executive Card is
 * EQUIPMENT_MULTISHOPCARD_NAME -> MultiShopCard. The fourth name-collision in this repo, and
 * the first one that reached published data. These pin both records to their real sources.
 */
test("Executive Card is MultiShopCard: triggered by purchases, not by the key", () => {
  const x = items.find((i) => i.id === "executive-card")!;
  expect(x.activated).toBe(false); // no EquipmentSlot handler at all
  expect(x.triggered).toBe(true); // but OnEquipmentExecuted() still spends the charge
  expect(x.stacking.find((s) => /Gold refunded/.test(s.stat))?.base).toBe(10);
  expect(x.stacking.find((s) => /Charges spent/.test(s.stat))?.formula).toMatch(/MultiShopCard/);
  // The 1000m raycast belongs to a different item and must not reappear here.
  expect(x.stacking.some((s) => /Ground search/.test(s.stat))).toBe(false);
});

test("Remote Caffeinator is VendingMachine, and owns the constants that were misfiled", () => {
  const x = items.find((i) => i.id === "remote-caffeinator")!;
  expect(x.confidence).toBe("code");
  expect(x.stacking.find((s) => /Impact damage/.test(s.stat))?.base).toBe(2000);
  expect(x.stacking.find((s) => /Healing per target/.test(s.stat))?.base).toBe(25);
  expect(x.stacking.find((s) => /Ground search/.test(s.stat))?.base).toBe(1000);
  expect(x.stacking.find((s) => /Shortest gap/.test(s.stat))?.base).toBe(0.5);
});

test("triggered implies not activated — the flag exists only for that case", () => {
  for (const it of items) {
    if (it.triggered) expect(it.activated, it.name).toBe(false);
  }
});

/**
 * Electric Boomerang: the trigger is fully verified even though the damage model is not.
 * Splitting those apart is the point — a record can be partly code-verified as long as the
 * unresolved half says so.
 */
test("Electric Boomerang's 15% chance does not scale with stacks", () => {
  const x = items.find((i) => i.id === "electric-boomerang")!;
  const chance = x.stacking.find((s) => /Chance on hit/.test(s.stat))!;
  expect(chance.base).toBe(15);
  expect(chance.perStack).toBe(0); // `LocalCheckRoll(15f * procCoefficient)` — no stack term
  expect(chance.formula).toMatch(/NO stack term/);
  // Still langfile: 0.4 x 3.1 = 1.24 against a stated 1.20, unattributed.
  expect(x.confidence).toBe("langfile");
  expect(x.stacking.find((s) => /Impact damage/.test(s.stat))?.formula).toMatch(/NOT resolved/);
});

/**
 * The two keys are the same extraction producing opposite verdicts, which is why both are
 * worth pinning: Rusted Key's own-bundle drop table reproduces its description exactly, and
 * Encrusted Key's does not. One method, one match, one mismatch — so the mismatch is about
 * that attribution, not about the technique.
 */
test("Rusted Key's 80/20 comes from dtLockbox in its own bundle", () => {
  const x = items.find((i) => i.id === "rusted-key")!;
  expect(x.confidence).toBe("code");
  const drop = x.stacking.find((s) => /Uncommon chance/.test(s.stat))!;
  expect(drop.base).toBe(80); // tier2Weight 4 : tier3Weight 1
  expect(drop.formula).toMatch(/ror2-base-treasurecache/);
});

/**
 * Settled by resolving the cache prefab's own `dropTable` pointer in-bundle: LockboxVoid
 * points at dtVoidLockbox (5:5:2), not at the dtVoidChest (6:3:1) its description's numbers
 * come from. One of the few places the game's own text is demonstrably wrong.
 */
test("Encrusted Key: the description contradicts the table its cache actually reads", () => {
  const x = items.find((i) => i.id === "encrusted-key")!;
  expect(x.confidence).toBe("code");
  const drop = x.stacking.find((s) => /drop split/.test(s.stat))!;
  expect(drop.base).toBeCloseTo(41.7, 1); // 5/12, not the stated 60%
  expect(drop.formula).toMatch(/dtVoidLockbox/);
  expect(drop.formula).toMatch(/dtVoidChest/); // the table the text's numbers belong to
  expect(x.descriptionNote).toMatch(/The game's own text is wrong here/);
});

test("Gnarled Woodsprite: prefab values beat the class initialisers again", () => {
  const x = items.find((i) => i.id === "gnarled-woodsprite")!;
  expect(x.confidence).toBe("code");
  expect(x.stacking.find((s) => /Passive healing/.test(s.stat))?.base).toBe(1.5); // not 1.0
  expect(x.stacking.find((s) => /burst/.test(s.stat))?.base).toBe(10); // not 5
  expect(x.descriptionNote).toMatch(/Aiming at nothing is not a wasted press/);
});

/**
 * §3j.79's lesson, made enforceable: a FALSE NEGATIVE IS A FALSE CLAIM. "This is not in the
 * game" reads as knowledge and is published with the same authority as a traced number, but
 * the verified/langfile split cannot catch it — it lives in prose, not in a value. Milky
 * Chrysalis said the +20% "is not in RecalculateStats" and it was, keyed on a buff whose name
 * (BugWings) matches neither the item nor its controller.
 *
 * So every negative claim has to say how far it looked. Either it is hedged to what we
 * actually did ("we have not found"), or it states its search scope — a file, a call site
 * count, the IL. An unqualified "X is not in the game" is not a permitted sentence.
 */
test("every negative claim in published prose is scoped or hedged", () => {
  const NEGATIVE =
    /(appears nowhere|is not in |are not in |not found|could not|cannot be found|does not appear|nowhere in|never resolve)/i;
  // Either an admission of our own limits, or a stated scope that a reader can re-run.
  // "could not establish" and "that array" are hedges too — the first admits our limit
  // outright, the second names the scope searched. Both were missing and both produced
  // false positives on prose that was already doing the right thing.
  const QUALIFIED =
    /(we have not found|have not traced|could not establish|NOT established|NOT verified|NOT resolved|NOT reconciled|at IL level|in that file|in the whole assembly|sites? in|spawn path|that coefficient|its text|that array|in RoR2\.dll)/i;

  const unscoped: string[] = [];
  // Artifact and shrine `mechanic` strings count too. They are prose we publish with the
  // same authority, and the first sweep over them found an unqualified negative in Artifact
  // of Honor — a guard that only watches items.json has a blind spot the size of the rest
  // of the dataset.
  const records: Array<[string, Array<[string, string]>]> = [
    ...items.map(
      (it): [string, Array<[string, string]>] => [
        it.name,
        [
          ["descriptionNote", it.descriptionNote ?? ""] as [string, string],
          ...it.stacking.map((st): [string, string] => [`stacking:${st.stat}`, st.formula ?? ""]),
        ],
      ],
    ),
    ...ARTIFACTS.map((a): [string, Array<[string, string]>] => [
      a.name,
      [["mechanic", a.mechanic ?? ""]],
    ]),
    ...SHRINES.map((sh): [string, Array<[string, string]>] => [
      sh.name,
      [["mechanic", sh.mechanic ?? ""], ["cost", sh.cost ?? ""]],
    ]),
    // skills.json is 19 SURVIVOR WRAPPERS, each holding a nested `skills` array — the first
    // version of this extension mapped the wrappers and read only `survivor` and `body`,
    // never reaching any of the 125 skills. That is the same failure as the falloff guard,
    // committed inside the fix for it: a guard that runs, passes, and inspects nothing.
    // `procSource` is the field that carries our provenance claims, so it is the one that
    // could ever hold an unscoped negative.
    ...(skills as Array<{ survivor: string; skills: Array<Record<string, unknown>> }>).flatMap(
      (w) =>
        (w.skills ?? []).map((sk): [string, Array<[string, string]>] => [
          `skill:${w.survivor}/${String(sk.name)}`,
          Object.entries(sk)
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]): [string, string] => [k, v as string]),
        ]),
    ),
    // survivors.json is deliberately absent: it carries no free prose at all. Every string
    // field on it is an identifier (id, name, dlc, wiki, confidence, gameName), so there is
    // no claim there to be unscoped. Recorded rather than silently omitted, so the next
    // reader knows this was checked and not overlooked.
  ];
  for (const [owner, parts] of records) {
    const it = { name: owner };
    for (const [where, text] of parts) {
      if (!text || !NEGATIVE.test(text)) continue;
      if (QUALIFIED.test(text)) continue;
      unscoped.push(`${it.name} (${where})`);
    }
  }
  expect(unscoped, unscoped.join(" | ")).toEqual([]);
});

test("Essence of Heresy's only-one-application claim carries its own evidence", () => {
  const x = items.find((i) => i.id === "essence-of-heresy")!;
  const r = x.stacking.find((s) => /Ruin duration/.test(s.stat))!;
  expect(r.base).toBe(10);
  expect(r.perStack).toBe(0);
  // Six IL loads, one application — checkable, not asserted.
  expect(r.formula).toMatch(/six sites/);
  expect(r.formula).toMatch(/exactly ONE/);
});

/**
 * Electric Boomerang turns out to be Sawmerang's twin: a BoomerangProjectile with a
 * ProjectileOverlapAttack whose resetInterval is -1. Both descriptions promise a return-pass
 * hit and neither delivers one — the same disabled reset, in two items shipped years apart.
 */
test("Electric Boomerang cannot strike the same enemy on the way back either", () => {
  const x = items.find((i) => i.id === "electric-boomerang")!;
  const once = x.stacking.find((s) => /Times one enemy can be sliced/.test(s.stat))!;
  expect(once.base).toBe(1);
  expect(once.formula).toMatch(/resetInterval = -1/);
  expect(once.formula).toMatch(/Sawmerang/); // the cross-reference is named, per the audit rule
});

/**
 * The honest limit on the dot-zone model, written into the data rather than only the log:
 * it is independently confirmed only where fireFrequency < resetFrequency. Molotov is that
 * case and was corrected; Sawmerang and Electric Boomerang are the other direction and were
 * not. A model gets to change numbers exactly where it has been tested.
 */
test("dot-zone-derived corrections exist only where the model was confirmed", () => {
  const molotov = items.find((i) => i.id === "molotov-6-pack")!;
  expect(molotov.confidence).toBe("code"); // fire 1 < reset 3 — every fire hits, unambiguous

  for (const id of ["sawmerang", "electric-boomerang"]) {
    const x = items.find((i) => i.id === id)!;
    expect(x.confidence, id).toBe("langfile"); // fire 30 > reset 10 — untested direction
  }
  // The reason changed and is worth pinning, because the first one is now wrong: the model
  // is READ, not inferred, and holds in both regimes. What blocks a correction is that the
  // figure is an instantaneous rate while inside the hitbox, and a projectile in flight does
  // not stay inside anything for a second — so it is not comparable to a "per second" claim.
  for (const id of ["sawmerang", "electric-boomerang"]) {
    const x = items.find((i) => i.id === id)!;
    const dot = x.stacking.find((s) => /contact|over time/i.test(s.stat))!;
    expect(dot.formula, id).toMatch(/read rather than inferred/);
    expect(dot.formula, id).toMatch(/INSIDE THE HITBOX/);
    expect(dot.formula, id).toMatch(/min\(fireFrequency, resetFrequency\)/);
  }
});

/**
 * The same discipline, applied to prose that lives in COMPONENTS rather than datasets.
 *
 * A large amount of what a reader is told about the game is written directly into .tsx —
 * the Stat Lab's Transcendence warning, the difficulty hints, the proc footnotes, the
 * artifact panel. Those are claims about the game published with the same authority as a
 * stacking row, and until now no check had ever read them. Scoped to components/ and data/
 * because infrastructure strings ("Root element not found") are addressed to developers,
 * not to players.
 */
test("component prose obeys the same negative-claim rule as the data", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join, relative } = await import("node:path");

  const roots = ["src/components", "src/data"];
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx|ts)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) files.push(p);
    }
  };
  for (const r of roots) walk(r);
  expect(files.length).toBeGreaterThan(20); // fail loudly if the walk ever finds nothing

  const NEGATIVE =
    /(appears nowhere|is not in |are not in |not found|could not|cannot be found|does not appear|nowhere in|never resolve)/i;
  const QUALIFIED =
    /(we have not found|have not traced|could not establish|NOT established|NOT verified|NOT resolved|NOT reconciled|at IL level|in that file|in the whole assembly|sites? in|spawn path|that coefficient|its text|that array|in RoR2\.dll)/i;

  const unscoped: string[] = [];
  for (const f of files) {
    // Comments are for us; only what ships to a reader is in scope.
    const visible = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ");
    if (NEGATIVE.test(visible) && !QUALIFIED.test(visible)) {
      unscoped.push(relative(".", f).split("\\").join("/"));
    }
  }
  expect(unscoped, unscoped.join(" | ")).toEqual([]);
});

/**
 * A published claim re-examined rather than trusted. "Each saw hits a given enemy once"
 * rested on two conditions; OverlapAttack has THREE escapes from its ignore list, and the
 * third — retriggerTimeout, which expires entries inside Fire() — had not been checked. Had
 * ProjectileOverlapAttack set it, both records would have been wrong.
 *
 * It is assigned in exactly two places in the game, neither of them that component. The same
 * read gave Orphaned Core a mechanic we had missed: its aura DOES set it, so the Solus unit
 * is not one-hit-per-enemy.
 */
test("the hits-once claim is closed on all three OverlapAttack escapes", () => {
  for (const [id, stat] of [
    ["sawmerang", /Damage per saw/],
    ["electric-boomerang", /Times one enemy can be sliced/],
  ] as const) {
    const x = items.find((i) => i.id === id)!;
    const r = x.stacking.find((s) => stat.test(s.stat))!;
    expect(r.formula, id).toMatch(/resetInterval = -1/);
    expect(r.formula, id).toMatch(/ResetOverlapAttack\(\) call/);
    expect(r.formula, id).toMatch(/retriggerTimeout/);
    expect(r.formula, id).toMatch(/exactly TWO places/);
  }
});

test("Orphaned Core's unit CAN re-hit, every 1.5s", () => {
  const x = items.find((i) => i.id === "orphaned-core")!;
  const r = x.stacking.find((s) => /launched into again/.test(s.stat))!;
  expect(r.base).toBe(1.5); // KineticAura: attack.retriggerTimeout = refreshTime
  expect(r.formula).toMatch(/cleanupRetriggerList/);
});

/**
 * §3j.87 found that a shared mechanism had a third escape I had not checked, and that two
 * published claims rested on the incomplete search. The defence proposed there was manual —
 * "go back to everything depending on it" — so here it is as a check instead.
 *
 * OverlapAttack lets a target leave its ignore list three ways: a timed `resetInterval`, a
 * manual `ResetOverlapAttack()` / `ResetIgnoredHealthComponents()` call, and `retriggerTimeout`
 * expiring entries inside Fire(). Any record that reasons about that list in order to claim a
 * HIT COUNT ("once per enemy", "hits once") has to address all three, because addressing two
 * of them is how the Sawmerang and Electric Boomerang records were nearly wrong.
 *
 * Records that merely cite the machinery to explain a RATE are exempt — they are not claiming
 * a count, and the fire/reset cadence is the whole of that story.
 */
test("hit-count claims from OverlapAttack address all three of its escapes", () => {
  const COUNT_CLAIM = /once per enemy|once, ever|hits? a given enemy once|can be sliced|once no matter/i;
  const incomplete: string[] = [];

  for (const it of items) {
    for (const st of it.stacking) {
      const f = st.formula ?? "";
      if (!COUNT_CLAIM.test(st.stat) && !COUNT_CLAIM.test(f)) continue;
      if (!/OverlapAttack|ignore list|resetInterval|ResetIgnored/i.test(f)) continue;
      if (!/retriggerTimeout/.test(f)) incomplete.push(`${it.name} — ${st.stat}`);
    }
  }
  expect(incomplete, incomplete.join(" | ")).toEqual([]);
});

/**
 * §3j.93's term extraction found `levelScale` — my own invention, used in seven records,
 * conflating TWO unrelated multipliers in RecalculateStats:
 *
 *   num85 = 1 + 0.2 x (level - 1)          a real level factor, on ITEM REGEN terms
 *   num79 / num84 = 1 + 0.5 + 0.15(n-1)    the QUICK FIX multiplier, on flat health,
 *                                           percentage health, and the item-regen sum
 *
 * Flat health items carry no level term at all, and seven records said otherwise. statMath.ts
 * had it right throughout — the error was confined to prose, which is exactly where the
 * verified/langfile split cannot see it.
 */
test("flat health items scale with Quick Fix, not with level", () => {
  for (const id of ["bison-steak", "titanic-knurl", "seared-steak"]) {
    const x = items.find((i) => i.id === id)!;
    const hp = x.stacking.find((s) => s.stat === "Maximum health")!;
    expect(hp.formula, id).toMatch(/quickFixMultiplier/);
    expect(hp.formula, id).not.toMatch(/levelScale/);
  }
  // Bison Steak carries the correction explicitly, since the old claim was published.
  expect(
    items.find((i) => i.id === "bison-steak")!.stacking.find((s) => s.stat === "Maximum health")!
      .formula,
  ).toMatch(/CORRECTION/);
});

test("item REGEN scales with both level and Quick Fix", () => {
  const knurl = items.find((i) => i.id === "titanic-knurl")!;
  const regen = knurl.stacking.find((s) => /regen/i.test(s.stat))!;
  expect(regen.formula).toMatch(/levelFactor/);
  expect(regen.formula).toMatch(/quickFixMultiplier/);
  // statMath models the level half; assert the two never merge back into one name.
  expect(regen.formula).not.toMatch(/levelScale/);
});

test("no record uses the invented term levelScale", () => {
  const offenders: string[] = [];
  for (const it of items) {
    for (const st of it.stacking) {
      if (/levelScale/.test(st.formula ?? "")) offenders.push(`${it.name} — ${st.stat}`);
    }
  }
  expect(offenders, offenders.join(" | ")).toEqual([]);
});

/**
 * `damageCoefficient` is the most-cited unit in the dataset (16 records) and the one that
 * caught me twice — Aurelionite's 0.1/1.0 and Electric Boomerang's 3.1 both looked like
 * outright contradictions of the game's text until the FIRED damage turned out to be
 * pre-scaled. A coefficient multiplies whatever value it was handed, which is not always
 * your base damage.
 *
 * So: a record citing `damageCoefficient = X` must publish `base = 100X`, or its formula must
 * say why not. Sweeping all 16 found 13 exact and 3 explained (both Electric Boomerang rows,
 * fired with `damage * 0.4f * n`; Sawmerang's contact row, which is a rate rather than a
 * per-hit figure). No unexplained mismatches — this pins that.
 */
test("a cited damageCoefficient matches the published base, or explains itself", () => {
  // Phrases that reconcile a mismatch: a pre-scaling chain, or an explicit rate/open note.
  const RECONCILED = /fired with|per second|instantaneous rate|NOT resolved|not comparable/i;
  const unexplained: string[] = [];

  for (const it of items) {
    for (const st of it.stacking) {
      const f = st.formula ?? "";
      // The coefficient is rarely called plain `damageCoefficient` in the code we quote:
      // blastDamageCoefficient, overlapDamageCoefficient, secondBombDamageCoefficient,
      // mainBeamDamageCoefficient. A case-sensitive match on the bare name inspected 16 of
      // the 34 rows that name one — see the falloff guard for the same failure, found first.
      const m = COEFF_SELECTOR.exec(f);
      if (!m) continue;
      // Only compare where `base` is a damage percentage. `childrenDamageCoefficient = 1` on
      // Molotov's "Bomblets" row is an inheritance multiplier and its base is a COUNT (6);
      // comparing the two would be arithmetic between unrelated units.
      if (!/damage/i.test(st.stat)) continue;
      const implied = parseFloat(m[1]) * 100;
      if (Math.abs(implied - st.base) < 0.5) continue;
      if (RECONCILED.test(f)) continue;
      unexplained.push(`${it.name} — ${st.stat}: coefficient implies ${implied}%, base is ${st.base}`);
    }
  }
  expect(unexplained, unexplained.join(" | ")).toEqual([]);
});

/**
 * Both selectors below are module-level so the guards and the coverage meta-guard read the
 * SAME pattern. Inlining them is how the falloff rule drifted to inspecting 8 of 29 rows
 * without anything noticing.
 */
const AREA_SELECTOR =
  /blastRadius|BlastAttack|blastAttack|DelayBlast|blast|explosion|explode|burst radius/i;
const COEFF_SELECTOR = /[A-Za-z]*[Dd]amageCoefficient\s*(?:=|of)?\s*([0-9]*\.?[0-9]+)/;

/**
 * A blast radius without its falloff model is half an answer, and five of seven blast
 * records published one without the other. BlastAttack has FIVE models and they are not
 * variations on a theme:
 *
 *   None          full damage anywhere inside the radius
 *   Linear        1 - d/r        -> ZERO at the rim
 *   SweetSpot     1 - (d > r/2 ? 0.75 : 0)  -> a CLIFF: full inside half, 25% beyond
 *   HalfLinear    tapers to 50%
 *   QuarterLinear tapers to 25%
 *
 * "600% in 8m" means something entirely different under None than under Linear, so any
 * record that publishes a blast radius has to say which.
 */
test("every record citing a blast radius states its falloff model", () => {
  const MODELS = /falloffModel is (None|Linear|SweetSpot|HalfLinear|QuarterLinear)|falloffModel = (None|Linear|SweetSpot)|falloff is SweetSpot|blastFalloffModel = None/;
  const silent: string[] = [];
  for (const it of items) {
    for (const st of it.stacking) {
      const f = st.formula ?? "";
      // Detect the MECHANIC, not one spelling of it, and read the STAT NAME as well as the
      // formula. Keying on the literal "blastRadius" in the formula alone let
      // Will-o'-the-wisp publish a SweetSpot blast as though it were uniform: its formula
      // quoted the code's own field name (`component6.radius`) and never said "blast" at
      // all. The stat name said "Explosion radius (m)" the whole time — which is precisely
      // what the reader sees, and the better thing to trust.
      const subject = `${st.stat} ${f}`;
      if (!AREA_SELECTOR.test(subject)) continue;
      if (MODELS.test(f) || /falloff/i.test(f)) continue;
      silent.push(`${it.name} — ${st.stat}`);
    }
  }
  // reference.ts publishes blast claims too — Artifact of Spite's bombs are a 7m DelayBlast.
  // Same claim class, same rule; a guard that stops at the file it was born in is the blind
  // spot §3j.112 was about.
  for (const r of [...ARTIFACTS, ...SHRINES]) {
    const t = `${r.mechanic ?? ""} ${"cost" in r ? (r.cost ?? "") : ""}`;
    if (!AREA_SELECTOR.test(t)) continue;
    if (MODELS.test(t) || /falloff/i.test(t)) continue;
    silent.push(`reference.ts — ${r.name}`);
  }
  expect(silent, silent.join(" | ")).toEqual([]);
});

/**
 * The correction the widened guard produced, pinned so it cannot silently revert.
 *
 * SweetSpot is the model most damaged by being omitted, because it is the one that is NOT a
 * taper: full damage inside HALF the radius, then a flat QUARTER out to the rim. A record
 * that publishes "350% base damage" beside "12m" describes less than a fifth of the sphere's
 * volume — the other four fifths take 87.5%.
 */
test("Will-o'-the-wisp publishes its SweetSpot cliff, not a uniform sphere", () => {
  const x = items.find((i) => i.id === "will-o-the-wisp")!;
  const radius = x.stacking.find((s) => /radius/i.test(s.stat))!;
  const damage = x.stacking.find((s) => /damage/i.test(s.stat))!;

  expect(radius.formula).toMatch(/SweetSpot/);
  // The consequence in numbers, not just the model's name.
  expect(radius.formula).toMatch(/6m/);
  expect(radius.formula).toMatch(/QUARTER/i);
  // The damage row must not read as if the headline number applied everywhere.
  expect(damage.formula).toMatch(/QUARTER|87\.5%/i);
  // And the two facts a reader would otherwise assume from the other item explosions.
  expect(x.descriptionNote).toMatch(/0\.5s|delay/i);
  expect(x.descriptionNote).toMatch(/procCoefficient/);
});

/**
 * The inverse case: an area effect that is NOT a BlastAttack has no falloff to state, and
 * demanding one would invite a fabricated answer. SphereSearch finds every distinct entity
 * inside the radius and treats them identically.
 */
test("Gasoline distinguishes its blast from its search", () => {
  const x = items.find((i) => i.id === "gasoline")!;
  const radius = x.stacking.find((s) => /radius/i.test(s.stat))!;
  const burn = x.stacking.find((s) => /Burn damage/i.test(s.stat))!;
  expect(radius.formula).toMatch(/falloffModel = None/);
  expect(radius.formula).toMatch(/procCoefficient 0f/);
  expect(burn.formula).toMatch(/no falloff concept/);
});

test("Remote Caffeinator's SweetSpot band is recorded, not rounded to one number", () => {
  const x = items.find((i) => i.id === "remote-caffeinator")!;
  const impact = x.stacking.find((s) => /Impact damage/.test(s.stat))!;
  expect(impact.base).toBe(2000);
  expect(impact.formula).toMatch(/SweetSpot/);
  // The consequence, not just the model name: an inner band and an outer quarter.
  expect(impact.formula).toMatch(/within 8m/);
  expect(impact.formula).toMatch(/QUARTER/);
});

/**
 * §9.3 cross-cutting: tooltips are claims too, and two of them had gone stale — describing
 * how the project worked at M1 rather than how it works now. Both were UNREACHABLE, which is
 * exactly why they survived: a dead branch is never read, and never re-read.
 *
 * This pins the vocabulary rather than the wording. "logbook" was the M1 verification source
 * and has not been one since §6A; if it reappears in a user-facing string, something has been
 * copied forward from a model of the project that no longer holds.
 */
test("no user-facing string describes verification by in-game logbook", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join, relative } = await import("node:path");

  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx$/.test(e.name)) files.push(p);
    }
  };
  walk("src/components");
  expect(files.length).toBeGreaterThan(20);

  const offenders: string[] = [];
  for (const f of files) {
    // Only what ships to a reader; the explanatory comments may discuss the old model.
    const visible = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ");
    if (/logbook/i.test(visible)) offenders.push(relative(".", f).split("\\").join("/"));
  }
  expect(offenders, offenders.join(" | ")).toEqual([]);
});

/**
 * CLAUDE.md's Status section is itself a claim, and it had drifted twice: it advertised
 * 78/125 procs verified when the number was 106, and listed a "proc tail" as pending work
 * that had been finished passes earlier. Documentation about verification going stale is a
 * particularly poor failure for this project.
 *
 * These pin the two counts the Status section quotes, so the next drift fails the build
 * rather than quietly misinforming whoever reads it next.
 */
test("CLAUDE.md's quoted verification counts match the data", async () => {
  const { readFileSync } = await import("node:fs");
  const claude = readFileSync("CLAUDE.md", "utf8");

  const skills = JSON.parse(readFileSync("src/data/skills.json", "utf8")) as Array<{
    skills: Array<{ verified: boolean; damaging?: boolean }>;
  }>;
  const all = skills.flatMap((s) => s.skills);
  const verified = all.filter((k) => k.verified).length;
  const noDamage = all.filter((k) => !k.verified && k.damaging === false).length;
  const unknown = all.length - verified - noDamage;

  expect(claude, "proc count in Status").toContain(`${verified}/${all.length}`);
  expect(claude, "no-damage-path count").toContain(`${noDamage} have no damage path`);
  expect(unknown, "Status claims 0 unknown procs").toBe(0);

  const traced = items.filter((i) => i.confidence === "code" || i.confidence === "asset").length;
  expect(claude, "traced-item count in Status").toContain(`${traced}/${items.length}`);
});

/**
 * PLAN.md is declared "the source of truth for scope, schema, and milestones", and four
 * schema fields did not appear in it at all — `capStacks`, `descriptionNote`,
 * `consumedOnUse`, `triggered`. Each carries semantics a contributor cannot infer:
 * `capStacks` means a HARD ceiling and is deliberately absent where the ceiling scales;
 * `descriptionNote` is the one field that openly contradicts the game's own text.
 *
 * A field can be added to schema.ts in one commit and stay undocumented forever, because
 * nothing reads the plan. This fails the build instead.
 */
test("every item/skill schema field is documented in PLAN.md", async () => {
  const { readFileSync } = await import("node:fs");
  const plan = readFileSync("PLAN.md", "utf8");
  const schema = readFileSync("src/data/schema.ts", "utf8");

  const declared = [
    ...new Set([...schema.matchAll(/^ {4}([a-zA-Z][A-Za-z0-9]*)\s*:\s*z\./gm)].map((m) => m[1])),
  ];
  expect(declared.length).toBeGreaterThan(20); // fail loudly if the parse ever breaks

  // Generic names (name, tags, icon…) are described in prose rather than by identifier;
  // the ones that matter are those carrying a rule someone could get wrong.
  const MUST_BE_NAMED = [
    "confidence",
    "capStacks",
    "descriptionNote",
    "cooldown",
    "activated",
    "consumedOnUse",
    "triggered",
    "damaging",
    "perStack",
  ];
  const undocumented = MUST_BE_NAMED.filter(
    (f) => declared.includes(f) && !plan.includes(f),
  );
  expect(undocumented, undocumented.join(" | ")).toEqual([]);
});

/**
 * The deploy workflow is a document with no reader, and it is the one that decides whether
 * any of these guards actually gate anything. A guard removed from CI still passes locally,
 * which is precisely how it would go unnoticed.
 *
 * Note what this does NOT claim: three audit rules (internal-name collisions, coined terms,
 * unlock gating) need `.decompiled`/`.gamedata`, which are Gearbox's data and must never be
 * committed. They report as skipped in CI. That is a permanent limit and CLAUDE.md says so.
 */
test("the deploy workflow still gates publication on every runnable check", async () => {
  const { readFileSync } = await import("node:fs");
  const wf = readFileSync(".github/workflows/deploy.yml", "utf8");

  for (const step of ["pnpm typecheck", "pnpm data:audit", "pnpm data:verify", "pnpm test:unit"]) {
    expect(wf, `${step} must run in deploy.yml`).toContain(step);
  }
  // The Playwright suite runs in ci.yml only — deploy.yml deliberately keeps the publish
  // gate fast. But 46 end-to-end tests silently ceasing to run is the same failure, so
  // the other workflow needs a reader too.
  const ci = readFileSync(".github/workflows/ci.yml", "utf8");
  expect(ci, "Playwright must run somewhere").toContain("pnpm test");
  expect(ci, "unit tests must run in ci.yml too").toContain("pnpm test:unit");
  // And they must precede the build, or a failing check would still publish.
  const buildAt = wf.indexOf("pnpm build");
  expect(buildAt).toBeGreaterThan(-1);
  for (const step of ["pnpm typecheck", "pnpm data:audit", "pnpm test:unit"]) {
    expect(wf.indexOf(step), `${step} must come before the build`).toBeLessThan(buildAt);
  }
});

/**
 * The README is the repository's front door and had said "M0 — Skeleton (current)" through
 * every milestone and the entire verification programme — the most consequential stale
 * document found, because it is the first thing anyone reads.
 *
 * Pinning the two claims that would mislead hardest: the status line, and the scripts table
 * (which omitted data:verify, data:diff and test:unit, and called data:audit "stubbed").
 */
test("the README describes the project as it is", async () => {
  const { readFileSync } = await import("node:fs");
  const readme = readFileSync("README.md", "utf8");
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };

  expect(readme, "must not still advertise M0").not.toMatch(/M0 — Skeleton \(current\)/);
  expect(readme, "must not claim data:audit is stubbed").not.toMatch(/stubbed until M1/);

  // Every verification-facing script a contributor needs must be listed.
  for (const s of ["data:audit", "data:verify", "data:diff", "test:unit"]) {
    expect(pkg.scripts[s], `${s} should exist`).toBeTruthy();
    expect(readme, `${s} must appear in the README`).toContain(s);
  }

  // The traced-item count is quoted; keep it honest the same way CLAUDE.md's is.
  const traced = items.filter((i) => i.confidence === "code" || i.confidence === "asset").length;
  expect(readme).toContain(`${traced} of ${items.length}`);
});

/**
 * §3j.84 named "we need the contact duration" as the blocker on both boomerangs' per-second
 * figures. It is measured now: the hitbox is one box and the projectile travels at 60 m/s,
 * so a straight pass overlaps a target for ~0.03-0.05s — shorter than the 0.1s reset window
 * that gates a re-hit. The instantaneous rate is real; a normal pass never sustains it.
 *
 * This pins the bound, and pins that the remaining gap is still stated rather than closed.
 */
test("both boomerangs bound their contact duration instead of implying a sustained rate", () => {
  for (const [id, re] of [
    ["sawmerang", /Blade contact/],
    ["electric-boomerang", /Damage over time/],
  ] as const) {
    const x = items.find((i) => i.id === id)!;
    const row = x.stacking.find((s) => re.test(s.stat))!;
    expect(row.formula, id).toMatch(/CONTACT DURATION, now measured/);
    expect(row.formula, id).toMatch(/SHORTER THAN ONE 0\.1s reset window/);
    expect(row.formula, id).toMatch(/localScale/); // the actual measurement, not a claim
    // The honest half: measuring the bound did not settle what the text means.
    expect(row.formula, id).toMatch(/Still NOT established/);
    expect(x.confidence, id).toBe("langfile");
  }
});

/**
 * Electric Boomerang's description splits the item into a FLAT slice ("120% base damage") and
 * a SCALING lingering effect ("120% (+120% per stack)"). That split is structurally
 * impossible, and the argument needs no measurement:
 *
 *   damage6 = characterBody.damage * 0.4f * itemCountEffective20;
 *
 * One fired value, linear in n with no constant term, read by BOTH damage components on the
 * prefab. One value cannot be flat for one consumer and scaling for another — so the slice
 * scales too, and nothing about the item has a floor at zero stacks.
 *
 * Worth keeping as a test because it is a conclusion drawn from SHAPE rather than from a
 * number, and shape arguments are the ones a later edit quietly breaks.
 */
test("Electric Boomerang's slice scales with stacks, whatever the text implies", () => {
  const x = items.find((i) => i.id === "electric-boomerang")!;
  const impact = x.stacking.find((s) => /Impact damage/.test(s.stat))!;

  // Not flat: the row now carries a per-stack term, matching the single fired value.
  expect(impact.perStack).toBe(120);
  expect(impact.formula).toMatch(/STRUCTURAL FINDING/);
  expect(impact.formula).toMatch(/NO constant term/);
  expect(x.descriptionNote).toMatch(/both grow together/);

  // The residual gap stays open and stays labelled — 1.24n computed vs 1.20n stated.
  expect(impact.formula).toMatch(/NOT resolved/);
  expect(x.confidence).toBe("langfile");
});

/**
 * The guard-of-guards.
 *
 * §3j.109's finding was not that one record was wrong — it was that a PASSING guard had been
 * inspecting 8 rows out of 29 for its whole life, because it keyed on one spelling of the
 * concept it policed. A green test with a narrow selector and a green test with a wide one
 * look identical from outside. The only difference visible from outside is HOW MANY ROWS THE
 * SELECTOR ADMITS, so that is what gets asserted here.
 *
 * These floors do not encode a desired answer, only a reach: they fail when a selector is
 * narrowed, a dataset stops being read, or a nesting level is skipped. Rows may legitimately
 * be added, so the assertions are floors and not equalities.
 */
describe("guard coverage", () => {
  test("the falloff guard still inspects every area row, not one spelling of them", () => {
    let n = 0;
    for (const it of items)
      for (const st of it.stacking)
        if (AREA_SELECTOR.test(`${st.stat} ${st.formula ?? ""}`)) n++;
    // 20 at the time of writing; it was 8 when the selector read only "blastRadius" in the
    // formula text. A deliberately wider probe (any `radius`, SphereSearch, "explo") matches
    // 29 rows, but the extra 9 are wards, tethers and reveal radii — area effects that are
    // not BlastAttacks and so have no falloff model to state. Demanding one of them would
    // invite a fabricated answer, which is why the selector stops at blast vocabulary.
    expect(n).toBeGreaterThanOrEqual(20);
  });

  test("the damageCoefficient guard still reads prefixed coefficient names", () => {
    let n = 0;
    for (const it of items)
      for (const st of it.stacking)
        if (COEFF_SELECTOR.test(st.formula ?? "") && /damage/i.test(st.stat)) n++;
    // 28 now; 16 when the pattern was case-sensitive on the bare name, which missed
    // blastDamageCoefficient, overlapDamageCoefficient, secondBombDamageCoefficient...
    expect(n).toBeGreaterThanOrEqual(28);
  });

  test("the negative-claim guard still descends into every nested skill", () => {
    const wrappers = skills as Array<{ skills: unknown[] }>;
    // 19 wrappers, 125 skills. Reading the wrappers alone — which the first version of the
    // extension did — inspects 19 records and none of the prose.
    expect(wrappers.length).toBe(19);
    expect(wrappers.reduce((a, w) => a + (w.skills?.length ?? 0), 0)).toBe(125);
  });

  test("the hit-count guard skips no row that makes a hit-count claim", () => {
    const COUNT_CLAIM = /once per enemy|once, ever|hits? a given enemy once|can be sliced|once no matter/i;
    const skipped: string[] = [];
    for (const it of items)
      for (const st of it.stacking) {
        const f = st.formula ?? "";
        if (!COUNT_CLAIM.test(st.stat) && !COUNT_CLAIM.test(f)) continue;
        // A row may only claim a hit count if it also shows the mechanism that bounds it.
        if (!/OverlapAttack|ignore list|resetInterval|ResetIgnored/i.test(f))
          skipped.push(`${it.name} — ${st.stat}`);
      }
    expect(skipped, skipped.join(" | ")).toEqual([]);
  });
});

/**
 * §9 follow-through on the falloff corrections: being RIGHT in the formula is not the same as
 * being READ. ItemDetail renders `formula` as 11px muted mono beneath the row, while the row
 * header shows the headline number at full weight — so a correction that lives only in the
 * formula is true and invisible. `descriptionNote` is the field that renders in the amber
 * callout above the fold.
 *
 * All three SweetSpot items materially overstate themselves without it: a reader sizing up
 * Shatterspleen from "400% + 15% max HP in 16m" is reading the best case for under a fifth of
 * the blast volume.
 */
test("every SweetSpot item warns above the fold, not only in its formula", () => {
  for (const id of ["will-o-the-wisp", "shatterspleen", "voidsent-flame"]) {
    const x = items.find((i) => i.id === id)!;
    expect(x.descriptionNote, `${id} has no above-the-fold warning`).toBeTruthy();
    // The model by name, and the consequence in plain words — a reader should not need to
    // know what "SweetSpot" means to take the point.
    expect(x.descriptionNote).toMatch(/SweetSpot/);
    expect(x.descriptionNote).toMatch(/QUARTER/i);
    expect(x.descriptionNote).toMatch(/HALF|6m|8m/i);
  }
});

/**
 * §3j.113: verifying one coined term in Artifact of Swarms forced a read of its manager and
 * found three unmentioned effects. Sweeping the rest of RoR2.Artifacts the same way found two
 * more records that were incomplete in the same way, and one that was WRONG:
 *
 *   Spite's bomb count is ceil(bestFitRadius x 4 x 0.5) — about two bombs per unit of radius.
 *   The record said "one extra bomb per 4 units of radius", inverting the relationship and
 *   borrowing bombSpawnRadiusCoefficient, which sets the scatter SPHERE and not the count.
 *
 * Pinned because it is the kind of claim that reads plausibly in either direction.
 */
describe("artifact mechanics re-read against their managers", () => {
  const artifact = (n: string) => ARTIFACTS.find((a) => a.name === n)!;

  test("Spite's bomb count scales UP with radius, and states its blast properties", () => {
    const m = artifact("Artifact of Spite").mechanic!;
    expect(m).toMatch(/extraBombPerRadius = 4/);
    expect(m).toMatch(/spite_bomb_coefficient/);
    expect(m).toMatch(/TWO bombs per unit/i);
    // The three blast properties the artifact's own text never gives.
    expect(m).toMatch(/falloffModel is None/);
    expect(m).toMatch(/procCoefficient is 0\.75/);
    expect(m).toMatch(/never critically strike|crit is hard-set to false/);
  });

  test("Sacrifice's drop chance is logarithmic, not the flat 5% it looks like", () => {
    const m = artifact("Artifact of Sacrifice").mechanic!;
    expect(m).toMatch(/5 x log2\(spawnValue \+ 1\)/);
    // The boundary is stated rather than filled in with a plausible per-monster table.
    expect(m).toMatch(/not in the extracted asset set|not established here/);
  });

  test("Swarms and Sacrifice are recorded as sharing an input", () => {
    // spawnValue is halved by one artifact and read by the other's drop chance. Neither
    // description hints at it, and the link is only visible if both managers are read.
    expect(artifact("Artifact of Swarms").mechanic).toMatch(/log2\(spawnValue \+ 1\)/);
    expect(artifact("Artifact of Swarms").mechanic).toMatch(/expReward|goldReward/);
    expect(artifact("Artifact of Evolution").mechanic).toMatch(/first stage/);
  });
});

/**
 * §3j.114: the shrine records were the last place on the site where our own documentation
 * said the numbers were unverified. They said it wrongly — the costs HAD been read from the
 * prefabs, and the doc comment claiming otherwise outlived that by several passes. Re-running
 * the extraction settled it and turned up two real errors in the process.
 *
 * These pin the arithmetic that a plausible-looking edit would quietly undo.
 */
describe("shrine constants", () => {
  const shrine = (n: string) => SHRINES.find((x) => x.name === n)!;

  test("Shrine of Blood truncates to 93%, and charges combined health", () => {
    const b = shrine("Shrine of Blood");
    // 100 * (1 - (1 - 0.75)^2) = 93.75, and Networkcost is an (int) cast. The published
    // figure was 93.75 for as long as the record existed.
    expect(b.cost).toContain("93%");
    expect(b.cost).not.toContain("93.75");
    // fullCombinedHealth is max health PLUS max shield, which changes the answer on any
    // Transcendence build — the record said "max health".
    expect(b.cost).toContain("combined health");
    expect(b.mechanic).toMatch(/fullCombinedHealth/);
    expect(b.mechanic).toMatch(/46\.5%/);
    expect(b.mechanic).toMatch(/NonLethal \| BypassArmor/);
  });

  test("Shrine of Chance escalates per attempt but caps on wins", () => {
    const c = shrine("Shrine of Chance");
    // The distinction the old record collapsed: a failure costs gold and raises the price
    // without consuming one of the two uses.
    expect(c.cost).toContain("per attempt");
    expect(c.mechanic).toMatch(/SUCCESSES only|successfulPurchaseCount is\s+incremented solely/);
    expect(c.mechanic).toMatch(/54\.71%/);
    // The failure chance is derivable from the serialized weights, which is why it is
    // trustworthy rather than merely transcribed.
    expect(c.mechanic).toMatch(/10\.1\/22\.3/);
  });

  test("costs that were hedged are now exact, and the free one is genuinely free", () => {
    expect(shrine("Altar of Gold").cost).toBe("200 gold");
    expect(shrine("Shrine of Shaping").cost).toBe("30 Soul");
    // ShrineBoss carries cost = 20 with costType = None. Reading the integer without the
    // enum would have "corrected" a right answer into a wrong one.
    expect(shrine("Shrine of the Mountain").cost).toBe("Free");
  });

  test("half the shrines now carry a mechanic, and none claims to be unverified", () => {
    expect(SHRINES.filter((x) => x.mechanic).length).toBeGreaterThanOrEqual(6);
    for (const x of SHRINES) {
      // The cost strings are prefab-derived now; nothing should describe them as ours.
      expect(x.cost).not.toMatch(/approx|roughly|about \d/i);
    }
  });
});

/**
 * §3j.115, the inverse audit: where does the site claim LESS than it knows?
 *
 * schema.ts already states the principle — conflating "no damage path" with "unknown proc"
 * made the Stat Lab report 21 skills as unverified when 19 have nothing to verify, and
 * "reporting a known thing as unknown is the mirror of this project's usual failure and just
 * as misleading". The Stat Lab was fixed. `procProvenance()` was not, so every one of those
 * skills still described its own provenance as "not yet verified" wherever that string is
 * shown.
 *
 * All 21 are established: 19 have no damage-dealing path, and 2 have a proc coefficient of
 * ZERO read from a named site (FireSonicBoom, FireFlower2). A proc of 0 that was read is not
 * a proc that is unknown.
 */
test("no skill describes an established provenance as unverified", () => {
  const all = (skills as Array<{ skills: Array<{ name: string; procSource?: string }> }>).flatMap(
    (w) => w.skills,
  );
  const stillUnknown = all
    .filter((sk) => procProvenance(sk.procSource ?? "") === "not yet verified")
    .map((sk) => `${sk.name} (${sk.procSource})`);

  // CLAUDE.md's claim is "0 skills are genuinely unknown". The UI must agree with it.
  expect(stillUnknown, stillUnknown.join(" | ")).toEqual([]);

  // And the two categories must stay distinguishable, not merged into one vague label.
  expect(procProvenance("code:no-damage-path")).toMatch(/no damage-dealing path/);
  expect(procProvenance("code:no-damage-path")).not.toMatch(/verified|unknown/i);
  expect(procProvenance("code:FireSonicBoom.CalculateProcCoefficient=0f")).toMatch(
    /FireSonicBoom/,
  );
});

/**
 * §3j.116, continuing the §3j.115 pattern: a principle enforced in only some of the places it
 * applies. "Fail closed" (PLAN §6B.3) says a record we have not traced must not LOOK like one
 * we have. Nine components touch item numbers; four carry a confidence signal.
 *
 * Checked, and most of the gap is not a gap: PlannerPage only filters by stacking TYPE and
 * renders no values, StatLabPage computes from statItems.ts (locked by data:verify), and
 * Breakpoints carries its own per-row `verified` field and renders it as <VerifiedTag>.
 *
 * One real hole remains. RunPlanRail publishes an item's hard CAP — a bare number, with no
 * badge and no tooltip. All four capped items are code-verified today, so nothing is wrong on
 * screen; the point is that nothing would notice if that changed. This is the cheap half of
 * fail-closed: rather than adding a badge to a rail that has no room for one, require that
 * only traced records can reach it.
 */
test("every number rendered without a confidence signal comes from a traced record", () => {
  const TRACED = new Set(["code", "asset"]);

  // RunPlanRail: `item.stacking[].cap`, rendered bare.
  const cappedButUntraced = items
    .filter((it) => it.stacking.some((s) => s.cap))
    .filter((it) => !TRACED.has(it.confidence ?? ""))
    .map((it) => `${it.name} (${it.confidence}) — cap shown in the run planner with no badge`);

  expect(cappedButUntraced, cappedButUntraced.join(" | ")).toEqual([]);
});

/**
 * §3j.116: the recurring failure this project actually has is not a wrong number. It is a fix
 * applied to the SURFACE where a bug was noticed rather than to the CONCEPT. Three instances
 * now, all involving skill proc coefficients:
 *
 *   1. The Stat Lab learned to show "no damage path"; SurvivorDetail went on saying "proc
 *      unverified" — its own comment records the same skill being described two ways on two
 *      pages, "and the wrong way here".
 *   2. The Stat Lab was fixed for the 21-skill conflation; `procProvenance()` was not, so the
 *      same skills kept calling themselves unverified everywhere that string appears (§3j.115).
 *   3. The falloff and coined-term guards each policed the file they were born in (§3j.109,
 *      §3j.112).
 *
 * A number is guarded by a value assertion. A concept has to be guarded structurally: any
 * component that renders a proc coefficient must also handle the case where there is no
 * coefficient to render. Both do today — this fails if a third surface appears without it,
 * which is exactly how the first two instances arose.
 */
test("every surface rendering a proc coefficient handles the no-damage-path case", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");

  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx$/.test(e.name)) files.push(p);
    }
  };
  walk("src/components");

  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    // Does this component render a proc VALUE (as opposed to merely mentioning the word)?
    if (!/\{\s*\w+\.proc\s*\}/.test(src)) continue;
    // Then it must distinguish "no coefficient exists" from "coefficient unknown".
    if (/damaging === false/.test(src)) continue;
    offenders.push(f);
  }
  expect(
    offenders,
    `these render a proc coefficient without handling damaging === false: ${offenders.join(", ")}`,
  ).toEqual([]);
});

/**
 * §3j.117: the largest remaining DATA gap, made visible instead of quietly carried.
 *
 * Proc coefficient is a first-order fact in this game — it decides whether an item's own damage
 * can trigger other items. "Does AtG's missile proc Ukulele?" is among the most common real
 * questions a player has, and 31 of the 41 rows describing an item-fired attack do not answer
 * it. §3j.113 found the same omission on Artifact of Spite by accident; this is the item-side
 * measurement of it.
 *
 * Two were closed by reading the code properly, and they differ in a way that shows why the
 * field matters: Ukulele's orb is `procCoefficient = 0.2f` and INHERITS the triggering hit's
 * crit, while Electric Boomerang rolls its own crit with `RollCrit()` and sets no proc
 * coefficient at the fire site at all — its rate lives on a projectile prefab outside the
 * extracted set, so it is recorded as not established rather than guessed.
 *
 * The rest are frozen below. This is a RATCHET, not an exemption: the silent set must stay a
 * SUBSET of this list, so the debt can shrink but never grow. A new attack row that says
 * nothing about proc rate fails here and has to be either answered or added deliberately.
 */
test("no NEW item attack row goes silent on its proc coefficient", () => {
  const ATTACK =
    /BlastAttack|BulletAttack|OverlapAttack|LightningOrb|ProjectileDamage|DelayBlast|OrbManager|GenericDamageOrb|damageCoefficient/i;

  // Frozen 2026-08-08 at 31 rows. Shrinking this list is the work; growing it is a regression.
  const KNOWN_SILENT = new Set([
    "atg-missile-mk-1::Missile damage (% TOTAL)",
    "will-o-the-wisp::Explosion radius (m)",
    "will-o-the-wisp::Explosion damage (% base)",
    "runalds-band::Ice blast damage (% TOTAL)",
    "kjaros-band::Flame tornado damage (% TOTAL)",
    "razorwire::Burst radius (m)",
    "ceremonial-dagger::Dagger damage (% base)",
    "resonance-disc::Explosion damage (% base)",
    "resonance-disc::Pierce & return damage (% base)",
    "electric-boomerang::Times one enemy can be sliced per throw",
    "orphaned-core::Launch damage (%)",
    "orphaned-core::Knockback damage on heavy targets (%)",
    "orphaned-core::Seconds before the same enemy can be launched into again",
    "shatterspleen::Explosion damage (% base)",
    "shatterspleen::Explosion bonus (% of enemy max HP)",
    "halcyon-seed::Aurelionite damage (%)",
    "little-disciple::Wisp damage (%)",
    "molten-perforator::Magma ball damage (%)",
    "charged-perforator::Lightning strike damage (%)",
    "plasma-shrimp::Missile damage (% TOTAL)",
    "polylute::Lightning hits",
    "singularity-band::Black hole damage (% TOTAL)",
    "voidsent-flame::Explosion damage (% base)",
    "volcanic-egg::Ram damage, once per enemy (%)",
    "volcanic-egg::Detonation damage (%)",
    "sawmerang::Damage per saw, once per enemy (%)",
    "sawmerang::Bleed applied",
    "molotov-6-pack::Bomblets",
    "molotov-6-pack::Impact damage per bomblet (%)",
    "of-one-mind::Death explosion damage (%)",
    "aurelionites-blessing::Spike damage, inner / outer (%)",
  ]);

  const newlySilent: string[] = [];
  for (const it of items) {
    for (const st of it.stacking) {
      const f = st.formula ?? "";
      if (!ATTACK.test(f)) continue;
      if (/procCoefficient/i.test(f)) continue;
      const key = `${it.id}::${st.stat}`;
      if (!KNOWN_SILENT.has(key)) newlySilent.push(key);
    }
  }
  expect(
    newlySilent,
    `attack rows with no proc coefficient stated, not on the frozen list: ${newlySilent.join(" | ")}`,
  ).toEqual([]);

  // The two that were closed must stay closed.
  const uku = items.find((i) => i.id === "ukulele")!;
  expect(uku.stacking.some((s) => /procCoefficient = 0\.2f/.test(s.formula ?? ""))).toBe(true);
  const boom = items.find((i) => i.id === "electric-boomerang")!;
  expect(boom.stacking.some((s) => /RollCrit\(\)/.test(s.formula ?? ""))).toBe(true);
});
