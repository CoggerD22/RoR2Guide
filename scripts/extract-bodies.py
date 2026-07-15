"""Extract ground-truth survivor stats from the game's Addressables bundles.

Survivor base stats are NOT in RoR2.dll — CharacterBody declares them as plain
public fields (baseMaxHealth, levelRegen, …) that Unity serializes onto each body
PREFAB. So they can't be decompiled; they must be read out of the asset bundles.
This script does that, giving `pnpm data:verify` a real ground truth for
survivors.json (MATH-VERIFICATION.md, Phase 3).

Outputs (both git-ignored, under .gamedata/ — game data, not ours to redistribute):
  bodies.json        every CharacterBody found: GameObject name -> serialized stats
  survivordefs.json  the authoritative playable roster (SurvivorDef assets),
                     incl. displayNameToken -> resolved English name and the
                     cachedName that identifies each survivor's body prefab.

Both assets are located by FIELD SIGNATURE rather than by MonoScript class name:
script pointers live in separate *_monoscripts_* bundles and don't resolve, but
the type trees are intact, so matching on distinctive fields is reliable.

Setup (one-time):
    python -m venv .venv && .venv/Scripts/pip install UnityPy
Usage:
    python scripts/extract-bodies.py [path-to-"Risk of Rain 2_Data"]
Takes ~15s. Re-run after a game patch, then `pnpm data:verify`.
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
LANG = f"{GAME}/StreamingAssets/Language/en"
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".gamedata")

# CharacterBody's serialized stat fields (see decompiled RoR2.CharacterBody).
BODY_FIELDS = [
    "baseMaxHealth", "levelMaxHealth", "baseRegen", "levelRegen",
    "baseDamage", "levelDamage", "baseArmor", "levelArmor",
    "baseMoveSpeed", "levelMoveSpeed", "baseAcceleration",
    "baseJumpCount", "baseJumpPower", "levelJumpPower",
    "baseAttackSpeed", "levelAttackSpeed", "baseCrit", "levelCrit",
    "sprintingSpeedMultiplier",
]


def load_language_tokens():
    tokens = {}
    for lf in glob.glob(f"{LANG}/*.json"):
        try:
            raw = open(lf, encoding="utf-8-sig").read()
            raw = re.sub(r",\s*([}\]])", r"\1", raw)  # game files have trailing commas
            tokens.update(json.loads(raw).get("strings", {}))
        except Exception:
            pass
    return tokens


def extract():
    if not os.path.isdir(AA):
        sys.exit(f"Addressables not found: {AA}\nPass the 'Risk of Rain 2_Data' path as an argument.")

    tokens = load_language_tokens()
    bodies, defs = {}, []

    # Bodies live in *_static_assets_all_* bundles; SurvivorDefs can be anywhere.
    for f in sorted(glob.glob(f"{AA}/*.bundle")):
        static = "static_assets_all" in f
        try:
            env = UnityPy.load(f)
        except Exception:
            continue
        for o in env.objects:
            if str(o.type.name) != "MonoBehaviour":
                continue
            try:
                t = o.read_typetree()
            except Exception:
                continue

            if static and "baseMaxHealth" in t:
                try:
                    name = o.read().m_GameObject.read().m_Name
                except Exception:
                    name = f"<unresolved:{o.path_id}>"
                rec = {k: t[k] for k in BODY_FIELDS if k in t}
                rec["_bundle"] = os.path.basename(f)
                bodies.setdefault(name, rec)

            if "bodyPrefab" in t and "displayNameToken" in t and "desiredSortPosition" in t:
                defs.append({
                    "cachedName": t.get("cachedName") or t.get("m_Name"),
                    "displayNameToken": t.get("displayNameToken"),
                    "name": tokens.get(t.get("displayNameToken", ""), "?"),
                    "sort": t.get("desiredSortPosition"),
                    "hidden": t.get("hidden"),
                })

    defs.sort(key=lambda d: d["sort"] if isinstance(d["sort"], (int, float)) else 999)
    os.makedirs(OUT_DIR, exist_ok=True)
    json.dump(bodies, open(f"{OUT_DIR}/bodies.json", "w"), indent=1, sort_keys=True)
    json.dump(defs, open(f"{OUT_DIR}/survivordefs.json", "w"), indent=1)
    print(f"{len(bodies)} CharacterBody instances, {len(defs)} SurvivorDefs -> {OUT_DIR}/")


if __name__ == "__main__":
    extract()
