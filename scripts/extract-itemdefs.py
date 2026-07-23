"""Extract the authoritative item + equipment roster from the game's bundles.

Every ItemDef / EquipmentDef ScriptableObject, identified by field signature (script
pointers live in separate bundles and don't resolve, same as extract-bodies.py):
  ItemDef      -> has nameToken AND deprecatedTier, no cooldown
  EquipmentDef -> has nameToken AND cooldown

nameToken is resolved to English via the language files. Output lets a roster
completeness check (are there game items missing from items.json?) run without
trusting a wiki count.

Output (git-ignored): .gamedata/itemdefs.json
  { "items": [ {name, token, tier, cachedName} ], "equipment": [ {name, token, cachedName, isConsumed} ] }

Usage: python scripts/extract-itemdefs.py ["Risk of Rain 2_Data" path]
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

# ItemTier enum (from the decompile). Index into this by deprecatedTier.
TIERS = ["Tier1", "Tier2", "Tier3", "Lunar", "Boss", "NoTier",
         "VoidTier1", "VoidTier2", "VoidTier3", "VoidBoss", "FoodTier"]

# Bundles are named by origin: ror2-base-*, ror2-dlc1-*, ror2-dlc2-*, ror2-dlc3-*.
# That prefix is the authoritative DLC of an asset — no field-name matching needed.
DLC_BY_PREFIX = {"ror2-base": "base", "ror2-dlc1": "sotv", "ror2-dlc2": "sots", "ror2-dlc3": "ac"}


def dlc_of(bundle):
    for prefix, dlc in DLC_BY_PREFIX.items():
        if bundle.startswith(prefix):
            return dlc
    return None


def load_tokens():
    tokens = {}
    for lf in glob.glob(f"{LANG}/*.json"):
        try:
            raw = re.sub(r",\s*([}\]])", r"\1", open(lf, encoding="utf-8-sig").read())
            tokens.update(json.loads(raw).get("strings", {}))
        except Exception:
            pass
    return tokens


def tier_name(v):
    if isinstance(v, int) and 0 <= v < len(TIERS):
        return TIERS[v]
    return str(v)


def extract():
    if not os.path.isdir(AA):
        sys.exit(f"Addressables not found: {AA}")
    tokens = load_tokens()
    items, equipment = {}, {}

    for f in sorted(glob.glob(f"{AA}/*.bundle")):
        bundle = os.path.basename(f)
        dlc = dlc_of(bundle)
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
            if "nameToken" not in t:
                continue
            cached = t.get("m_Name") or ""

            if "cooldown" in t and "isConsumed" in t and "deprecatedTier" not in t:
                tok = t.get("nameToken", "")
                equipment.setdefault(cached, {
                    "name": tokens.get(tok, "?"), "token": tok, "cachedName": cached,
                    "isConsumed": bool(t.get("isConsumed")),
                    # canDrop = player-obtainable; isLunar = lunar equipment.
                    "canDrop": bool(t.get("canDrop")),
                    "isLunar": bool(t.get("isLunar")),
                    "enabled": bool(t.get("enabled", True)),
                    "dlc": dlc,
                })
            elif "deprecatedTier" in t:
                tok = t.get("nameToken", "")
                items.setdefault(cached, {
                    "name": tokens.get(tok, "?"), "token": tok, "cachedName": cached,
                    "tier": tier_name(t.get("deprecatedTier")),
                    "dlc": dlc,
                })

    os.makedirs(OUT_DIR, exist_ok=True)
    out = {
        "items": sorted(items.values(), key=lambda x: (x["tier"], x["name"])),
        "equipment": sorted(equipment.values(), key=lambda x: x["name"]),
    }
    json.dump(out, open(f"{OUT_DIR}/itemdefs.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"{len(out['items'])} ItemDefs, {len(out['equipment'])} EquipmentDefs -> {OUT_DIR}/itemdefs.json")


if __name__ == "__main__":
    extract()
