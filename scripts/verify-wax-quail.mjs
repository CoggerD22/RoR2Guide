/**
 * Reproducible evidence for a claim that CONTRADICTS the game's own description.
 *
 * Wax Quail says "boosts you forward by 10m (+10m per stack)". It does not: the real
 * figure is 5m per stack. Because that disagrees with the in-game text (and with the
 * wiki, which repeats the text), the derivation must be checkable by anyone rather than
 * asserted — hence this file. Run: node scripts/verify-wax-quail.mjs
 *
 * The two code paths involved, both from the decompile:
 *
 *   GenericCharacterMain.cs:199-201        (the item)
 *     a  = characterBody.acceleration * characterMotor.airControl
 *     n2 = Mathf.Sqrt(10f * stacks / a)
 *     n3 = characterBody.moveSpeed / a
 *     horizontalBonus = (n2 + n3) / n3
 *
 *   GenericCharacterMain.ApplyJumpVelocity  (the launch)
 *     velocity.xz = moveDirection * moveSpeed * horizontalBonus
 *
 *   CharacterMotor.PreMove:437-459          (the decay)
 *     num    = acceleration * airControl        // airborne; air control is not disabled
 *     target = moveDirection * walkSpeed        // walkSpeed = body.moveSpeed
 *     target.y = velocity.y                     // so MoveTowards only affects horizontal
 *     velocity = Vector3.MoveTowards(velocity, target, num * deltaTime)
 *
 * Algebraically: launch speed is moveSpeed + a*sqrt(10n/a) = moveSpeed + sqrt(10na), an
 * excess of sqrt(10na) over the target the motor is pulling back to. MoveTowards bleeds
 * that off at exactly `a` m/s^2, so the extra ground covered is
 *
 *     excess^2 / (2a)  =  10na / (2a)  =  5n metres
 *
 * — independent of both moveSpeed and acceleration. The "10" in the description is the
 * literal inside the square root, not a distance.
 *
 * The one real caveat: bleeding off takes sqrt(10n/a) seconds, and a standard jump is
 * airborne 1.0s (jumpPower 15 against gravity -30). Survivors with low acceleration land
 * early and get less, which the simulation below shows for MUL-T at 3+ stacks.
 */

const GRAVITY = -30; // Run.baseGravity
const AIR_CONTROL = 0.25; // CharacterMotor.airControl
const DT = 1 / 60;

/** Replays the motor loop for one jump; returns horizontal distance until landing. */
function jumpDistance({ accel, moveSpeed, jumpPower, stacks }) {
  const a = accel * AIR_CONTROL;
  let hBonus = 1;
  if (stacks > 0) {
    const n2 = Math.sqrt((10 * stacks) / a);
    const n3 = moveSpeed / a;
    hBonus = (n2 + n3) / n3;
  }
  let vx = moveSpeed * hBonus;
  let vy = jumpPower;
  let x = 0;
  let h = 0;
  for (let t = 0; t < 20; t += DT) {
    const step = a * DT;
    vx = Math.abs(vx - moveSpeed) <= step ? moveSpeed : vx + Math.sign(moveSpeed - vx) * step;
    vy += GRAVITY * DT;
    x += vx * DT;
    h += vy * DT;
    if (h <= 0 && t > DT) break;
  }
  return x;
}

// baseAcceleration / baseMoveSpeed / baseJumpPower from the body prefabs (.gamedata).
const BODIES = [
  { name: "Commando / Huntress (accel 80)", accel: 80, moveSpeed: 7, jumpPower: 15 },
  { name: "MUL-T (accel 30)", accel: 30, moveSpeed: 7, jumpPower: 15 },
];

let failures = 0;
for (const b of BODIES) {
  const base = jumpDistance({ ...b, stacks: 0 });
  const a = b.accel * AIR_CONTROL;
  console.log(`\n${b.name} — a = ${a} m/s^2, airtime ${(2 * b.jumpPower) / -GRAVITY}s`);
  console.log(`  no Wax Quail: ${base.toFixed(2)} m`);
  for (const n of [1, 2, 3, 5]) {
    const gained = jumpDistance({ ...b, stacks: n }) - base;
    const decay = Math.sqrt((10 * n) / a);
    const truncated = decay > (2 * b.jumpPower) / -GRAVITY;
    console.log(
      `  ${n} stack(s): +${gained.toFixed(2)} m` +
      `   (model ${5 * n} m, needs ${decay.toFixed(2)}s to bleed off` +
      `${truncated ? " — LANDS FIRST, so gains less" : ""})`,
    );
    // Where the jump is long enough, the closed form must hold to within a timestep.
    if (!truncated && Math.abs(gained - 5 * n) > 0.25) {
      console.error(`    MISMATCH: expected ~${5 * n}, got ${gained.toFixed(2)}`);
      failures++;
    }
  }
}

console.log(
  failures === 0
    ? "\nOK — 5m per stack confirmed wherever the jump is long enough to bleed the boost off."
    : `\n${failures} mismatch(es)`,
);
process.exit(failures === 0 ? 0 : 1);
