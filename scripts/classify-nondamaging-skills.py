"""Separate skills that CANNOT deal damage from skills whose proc coefficient is unknown.

`skills.json` marks 21 skills `proc: null`, and the Stat Lab renders all of them as
"unverified". That conflates two different things:

  * a dash, a stance swap, or an aim state that has no damage path at all — for which the
    honest answer is "no proc", a fact, not a gap;
  * a genuine attack whose coefficient has not been located — a real gap.

Reporting the first group as unverified overstates our ignorance, which is the mirror of the
error this whole programme exists to avoid: it makes a known thing look unknown.

The test is deliberately conservative — a state counts as damaging if its class OR any state
it transitions into mentions any damage-dealing API. Anything ambiguous stays unverified,
because a false "no proc" would be a claim, whereas a false "unverified" is only a shrug.

Output (git-ignored): .gamedata/skill-damage-paths.json

Usage: python scripts/classify-nondamaging-skills.py
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL = os.path.join(ROOT, ".decompiled/full")
OUT_DIR = os.path.join(ROOT, ".gamedata")

# Anything that can put damage on a target.
DAMAGE_API = re.compile(
    r"\bBlastAttack\b|\bOverlapAttack\b|\bBulletAttack\b|\bFireProjectile\b|"
    r"\bTakeDamage\b|\bDamageInfo\b|\bInflictDot\b|\bAddOrb\b|\bDotController\b|"
    r"\bprocCoefficient\b|\bdamageCoefficient\b|\bFireMissile\b|\bLightningOrb\b")

# `SetNextState(new Foo())` / `outer.SetState(new Foo())` — follow one hop so a charge state
# that fires on exit is judged by what it transitions into (REX's ChargeSonicBoom is the
# motivating case: the charge is inert, the fire state is not).
NEXT_STATE = re.compile(r"new\s+([A-Za-z_][\w]*)\s*\(")


def index_sources():
    by_class = {}
    for path in glob.glob(f"{FULL}/**/*.cs", recursive=True):
        if os.path.basename(path) == "RoR2.decompiled.cs":
            continue
        cls = os.path.basename(path)[:-3]
        try:
            by_class[cls] = open(path, encoding="utf-8", errors="ignore").read()
        except Exception:
            pass
    return by_class


def main():
    if not os.path.isdir(FULL):
        sys.exit(f"Full decompile missing: {FULL}")
    skills_path = os.path.join(ROOT, "src/data/skills.json")
    skills = json.load(open(skills_path, encoding="utf-8"))
    by_class = index_sources()

    out = {}
    for sv in skills:
        for k in sv.get("skills", []):
            if k.get("proc") is not None:
                continue
            state = k.get("state") or ""
            # "EntityStates.Foo.Bar+Nested" -> leaf class name, nested types included.
            leaf = state.split("+")[-1].split(".")[-1]
            src = by_class.get(leaf)
            # Nested types (`EntityStates.VoidSurvivor.VoidBlinkBase+VoidBlinkUp`) have no
            # file of their own — they live inside the OUTER class. Void Fiend's Trespass
            # reported "source-not-found" until this fell back to the outer name.
            if src is None and "+" in state:
                outer = state.split("+")[0].split(".")[-1]
                src = by_class.get(outer)
                if src is not None:
                    leaf = outer
            if src is None:
                out[f"{sv['survivor']}/{k['name']}"] = {
                    "state": state, "verdict": "source-not-found", "evidence": None}
                continue
            hits = sorted(set(DAMAGE_API.findall(src)))
            # One hop into referenced states.
            referenced = []
            for cand in set(NEXT_STATE.findall(src)):
                if cand in by_class and cand != leaf:
                    sub = sorted(set(DAMAGE_API.findall(by_class[cand])))
                    if sub:
                        referenced.append({"state": cand, "api": sub})
            verdict = "damaging" if (hits or referenced) else "no-damage-path"
            out[f"{sv['survivor']}/{k['name']}"] = {
                "state": state, "leaf": leaf, "verdict": verdict,
                "api": hits, "viaStates": referenced[:4],
            }

    os.makedirs(OUT_DIR, exist_ok=True)
    path = f"{OUT_DIR}/skill-damage-paths.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False, sort_keys=True)

    counts = {}
    for v in out.values():
        counts[v["verdict"]] = counts.get(v["verdict"], 0) + 1
    print(f"{len(out)} skills with proc:null")
    for kk, vv in sorted(counts.items()):
        print(f"  {kk}: {vv}")
    for name, v in sorted(out.items()):
        extra = ""
        if v["verdict"] == "damaging":
            extra = f"  api={v.get('api')} via={[r['state'] for r in v.get('viaStates', [])]}"
        print(f"  {v['verdict']:18s} {name}{extra}")
    print(f"-> {path}")


if __name__ == "__main__":
    main()
