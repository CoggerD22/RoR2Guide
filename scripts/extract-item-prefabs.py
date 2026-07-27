"""Extract serialized constants from item prefabs (PLAN §6B.5 step 4).

Code gives the shape of a formula; the ASSET gives its constants (§5.0.2). Two of the
most consequential findings so far lived only here and were invisible to every code
scan:

  - Elusive Antlers grants a barrier of `10 + 7(n-1)` per orb — an effect the dataset
    did not have and the in-game description never mentions.
  - Shrine of Blood's cost compounds (`costMultiplierPerPurchase = 2`) and is capped at
    three uses, neither of which its description says.

Bundles are named after the item's def, e.g.
`ror2-dlc2-items-speedboostpickup_assets_all_<hash>.bundle` → `SpeedBoostPickup`, which
gives a clean prefab→item mapping with no guessing. For each item bundle this dumps the
numeric serialized fields of its MonoBehaviours, skipping the generic Unity noise
(transforms, colours, layer masks) that would bury the real values.

Output (git-ignored): .gamedata/item-prefabs.json — evidence for review, not a verdict.

Usage: python scripts/extract-item-prefabs.py [path-to-"Risk of Rain 2_Data"]
"""
import glob
import json
import os
import re
import sys

import UnityPy

DEFAULT_GAME = "E:/SteamLibrary/steamapps/common/Risk of Rain 2/Risk of Rain 2_Data"
GAME = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("ROR2_DATA_DIR", DEFAULT_GAME)
AA = f"{GAME}/StreamingAssets/aa/StandaloneWindows64"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, ".gamedata")

BUNDLE_ITEM = re.compile(r"^ror2-(?:base|dlc\d)-items-([a-z0-9]+)_")

# Unity/engine fields that are never item tuning values.
NOISE = re.compile(
    r"^m_|^k[A-Z]|Layer$|LayerMask|^enabled$|^size$|^scale$|Color$|Rotation$|"
    r"^r$|^g$|^b$|^a$|^x$|^y$|^z$|^w$|Index$|Hash$|^instanceID$", re.I)

# An INCLUSION list, not just an exclusion one.
#
# The first run matched mostly incidental numbers — `vfxPriority: 2`, `boldSpacing: 7`,
# `curveInterpolation: 4` — because item bundles are overwhelmingly visual assets, so
# excluding known noise still let hundreds of rendering fields through and buried the
# handful of real values. Tuning constants have recognisable names, and requiring one
# is far more precise than trying to enumerate everything that isn't.
TUNING = re.compile(
    r"damage|duration|radius|chance|amount|stack|cooldown|heal|barrier|shield|armor|"
    r"speed|count|interval|multiplier|coefficient|percent|threshold|bonus|proc|"
    r"maxTargets|regen|force|charges|cost|scalar|fraction|seconds|ratio", re.I)
# …minus names that use those words for presentation rather than mechanics.
TUNING_NOISE = re.compile(
    r"vfx|particle|sound|audio|anim|sprite|material|shader|camera|font|text|icon|"
    r"transmit|interpolat|priority|lod\b|fadeOut|blend", re.I)


def numeric_fields(t: dict) -> dict:
    out = {}
    for k, v in t.items():
        if NOISE.search(k):
            continue
        if isinstance(v, bool):
            continue
        if not isinstance(v, (int, float)):
            continue
        # Unity ships sentinels like `tolerance: Infinity`, which json.dump writes as a
        # bare `Infinity` — valid Python, invalid JSON, and unreadable by every consumer.
        if v != v or v in (float("inf"), float("-inf")):
            continue
        if v in (0, 1, -1):
            continue
        if not TUNING.search(k) or TUNING_NOISE.search(k):
            continue
        out[k] = v
    return out


def main():
    if not os.path.isdir(AA):
        sys.exit(f"Addressables not found: {AA}")

    defs = json.load(open(os.path.join(OUT_DIR, "itemdefs.json"), encoding="utf-8"))
    lower_to_def = {}
    for kind in ("items", "equipment"):
        for d in defs.get(kind, []):
            if d.get("cachedName"):
                lower_to_def[d["cachedName"].lower()] = d["cachedName"]

    out = {}
    scanned = 0
    for f in sorted(glob.glob(f"{AA}/*.bundle")):
        m = BUNDLE_ITEM.match(os.path.basename(f))
        if not m:
            continue
        cached = lower_to_def.get(m.group(1))
        if not cached:
            continue
        scanned += 1
        try:
            env = UnityPy.load(f)
            objs = list(env.objects)
        except Exception:
            continue
        byid = {o.path_id: o for o in objs}
        comps = []
        for o in objs:
            if str(o.type.name) != "MonoBehaviour":
                continue
            try:
                t = o.read_typetree()
            except Exception:
                continue
            fields = numeric_fields(t)
            if not fields:
                continue
            owner = ""
            try:
                owner = byid[t["m_GameObject"]["m_PathID"]].read().m_Name
            except Exception:
                pass
            comps.append({"owner": owner, "fields": fields})
        if comps:
            out.setdefault(cached, []).extend(comps)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(f"{OUT_DIR}/item-prefabs.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False, sort_keys=True)

    nfields = sum(len(c["fields"]) for v in out.values() for c in v)
    print(f"{scanned} item bundles scanned")
    print(f"  {len(out)} items with serialized constants, {nfields} numeric fields")
    print(f"-> {OUT_DIR}/item-prefabs.json")


if __name__ == "__main__":
    main()
