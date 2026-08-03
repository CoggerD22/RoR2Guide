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

test("Molotov's 500% is impact plus burn total, and the puddle rate is flagged", () => {
  const x = items.find((i) => i.id === "molotov-6-pack")!;
  expect(x.stacking.find((s) => /Bomblets/.test(s.stat))?.base).toBe(6);
  expect(x.stacking.find((s) => /Impact damage/.test(s.stat))?.base).toBe(250);
  expect(x.stacking.find((s) => /Burn total/.test(s.stat))?.base).toBe(250);
  expect(x.descriptionNote).toMatch(/NOT verified/);
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
