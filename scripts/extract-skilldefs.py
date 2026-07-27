"""Extract SkillDef recharge/stock constants from the game assets (PLAN §5.0.2).

Some item claims are settled only by a SkillDef, not by code. Hooks of Heresy is the
motivating case: `LunarSecondaryReplacementSkill.GetRechargeInterval` returns

    GetItemCountEffective(LunarSecondaryReplacement) * baseRechargeInterval

so the code proves the *shape* (n x interval) while the interval itself is a serialized
field on the skill asset. Neither source alone answers "5s (+5s per stack)"; this
supplies the missing half.

Scans every addressable bundle for MonoBehaviours that look like SkillDefs (they carry
`baseRechargeInterval` / `baseMaxStock`) and dumps their tuning fields keyed by asset
name, so a skill referenced from code can be looked up directly.

Output (git-ignored): .gamedata/skilldefs.json

Usage: python scripts/extract-skilldefs.py [name-substring ...]
"""
import glob
import json
import os
import re
import sys

import UnityPy

DEFAULT_GAME = "E:/SteamLibrary/steamapps/common/Risk of Rain 2/Risk of Rain 2_Data"
GAME = os.environ.get("ROR2_DATA_DIR", DEFAULT_GAME)
AA = f"{GAME}/StreamingAssets/aa/StandaloneWindows64"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, ".gamedata")

# A SkillDef is identified by its own fields rather than by bundle name — the skill an
# item replaces is not necessarily shipped in that item's bundle, which is why grepping
# bundle names for "lunarsecondary" finds nothing.
MARKERS = ("baseRechargeInterval", "baseMaxStock", "activationStateMachineName")
KEEP = re.compile(
    r"baseRechargeInterval|baseMaxStock|rechargeStock|requiredStock|stockToConsume|"
    r"beginSkillCooldownOnSkillEnd|cancelSprintingOnActivation|isCombatSkill|"
    r"mustKeyPress|interruptPriority", re.I)


def main():
    if not os.path.isdir(AA):
        sys.exit(f"Addressables not found: {AA}")
    wanted = [a.lower() for a in sys.argv[1:]]

    out = {}
    for f in sorted(glob.glob(f"{AA}/*.bundle")):
        try:
            env = UnityPy.load(f)
            objs = list(env.objects)
        except Exception:
            continue
        for o in objs:
            if str(o.type.name) != "MonoBehaviour":
                continue
            try:
                t = o.read_typetree()
            except Exception:
                continue
            if not any(m in t for m in MARKERS):
                continue
            name = t.get("m_Name") or ""
            if not name:
                continue
            if wanted and not any(w in name.lower() for w in wanted):
                continue
            # Unity ships sentinels like `baseRechargeInterval: Infinity` (skills that
            # never recharge). json.dump writes those as a bare `Infinity` — valid Python,
            # invalid JSON, unreadable by every consumer. Same trap as
            # extract-item-prefabs.py; keep the value, but as a string.
            fields = {}
            for k, v in t.items():
                if not KEEP.search(k) or not isinstance(v, (int, float, bool)):
                    continue
                if isinstance(v, float) and (v != v or v in (float("inf"), float("-inf"))):
                    v = str(v)
                fields[k] = v
            if fields:
                out.setdefault(name, {"bundle": os.path.basename(f), **fields})

    os.makedirs(OUT_DIR, exist_ok=True)
    path = f"{OUT_DIR}/skilldefs.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False, sort_keys=True)
    print(f"{len(out)} SkillDefs -> {path}")
    for k in sorted(out)[:20] if wanted else []:
        print(f"  {k}: {out[k]}")


if __name__ == "__main__":
    main()
