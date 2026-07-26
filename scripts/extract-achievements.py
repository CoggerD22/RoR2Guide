"""Build the complete, code-verified unlock chain for every gated item/equipment.

The chain has three links, each from its authoritative tier (PLAN §6A.2):

  T1 asset : ItemDef.unlockableDef        -> UnlockableDef.cachedName   ("Items.Bear")
  T0 code  : [RegisterAchievement(id, unlockableRewardIdentifier, ...)] -> identifier
             ("Die5Times"), read from the decompiled RoR2.Achievements namespace
  T2 text  : ACHIEVEMENT_<ID>_NAME / _DESCRIPTION -> the player-facing challenge
             name and its stated requirement

This is what makes "is this item locked, and how do you unlock it?" a *verified*
claim rather than a wiki transcription. It also disambiguates the trap that
extract-unlockables.py alone cannot resolve: an unlockableDef whose token is merely
the item's own name ("Items.Crowbar") looks like a Logbook entry, but the achievement
registration proves it is a genuine drop-pool gate (Discover10UniqueTier1 -> Crowbar).

Requires the full decompile:
  ilspycmd <RoR2.dll> -p -o .decompiled/full
and .gamedata/unlockables.json from extract-unlockables.py.

Output (git-ignored): .gamedata/achievements.json
  { "byUnlockable": { "Items.Bear": {identifier, challenge, requirement} },
    "items":     { "<ItemName>": {unlockable, identifier, challenge, requirement} },
    "equipment": { ... } }

Usage: python scripts/extract-achievements.py [path-to-"Risk of Rain 2_Data"]
"""
import glob
import json
import os
import re
import sys

DEFAULT_GAME = "E:/SteamLibrary/steamapps/common/Risk of Rain 2/Risk of Rain 2_Data"
GAME = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("ROR2_DATA_DIR", DEFAULT_GAME)
LANG = f"{GAME}/StreamingAssets/Language/en"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, ".gamedata")
FULL = os.path.join(ROOT, ".decompiled/full")

# [RegisterAchievement("Die5Times", "Items.Bear", null, 1u, null)]
REGISTER = re.compile(
    r'\[RegisterAchievement\(\s*"([^"]+)"\s*,\s*(?:"([^"]*)"|null)', re.S)


def load_tokens():
    strings = {}
    for lf in glob.glob(f"{LANG}/*.json"):
        try:
            raw = re.sub(r",\s*([}\]])", r"\1", open(lf, encoding="utf-8-sig").read())
            for k, v in json.loads(raw).get("strings", {}).items():
                if isinstance(v, str):
                    strings[k] = v
        except Exception:
            pass
    return strings


def strip_tags(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip() if s else None


def main():
    if not os.path.isdir(FULL):
        sys.exit(f"Full decompile missing: {FULL}\n"
                 f"Run: ilspycmd <RoR2.dll> -p -o .decompiled/full")
    tokens = load_tokens()

    # --- T0: achievement identifier -> unlockable it grants ------------------
    by_unlockable = {}
    seen = 0
    for path in glob.glob(f"{FULL}/**/*.cs", recursive=True):
        try:
            src = open(path, encoding="utf-8", errors="ignore").read()
        except Exception:
            continue
        if "RegisterAchievement" not in src:
            continue
        for ident, unlockable in REGISTER.findall(src):
            seen += 1
            if not unlockable:
                continue
            up = ident.upper()
            name = tokens.get(f"ACHIEVEMENT_{up}_NAME")
            desc = tokens.get(f"ACHIEVEMENT_{up}_DESCRIPTION") or tokens.get(f"ACHIEVEMENT_{up}_DESC")
            # First registration wins; duplicates across partial classes are identical.
            by_unlockable.setdefault(unlockable, {
                "identifier": ident,
                "challenge": name,
                "requirement": strip_tags(desc),
            })

    # --- T1: join to the item/equipment defs ---------------------------------
    upath = f"{OUT_DIR}/unlockables.json"
    if not os.path.exists(upath):
        sys.exit("Missing .gamedata/unlockables.json — run extract-unlockables.py first")
    unlockables = json.load(open(upath, encoding="utf-8"))

    out = {"byUnlockable": by_unlockable, "items": {}, "equipment": {}}
    stats = {"gated": 0, "resolved": 0, "no_achievement": 0}
    for kind in ("items", "equipment"):
        for cached, rec in unlockables.get(kind, {}).items():
            key = rec.get("unlockable")
            if not key:
                continue
            stats["gated"] += 1
            ach = by_unlockable.get(key)
            if ach:
                stats["resolved"] += 1
                out[kind][rec["name"]] = {"def": cached, "unlockable": key, **ach}
            else:
                stats["no_achievement"] += 1
                out[kind][rec["name"]] = {"def": cached, "unlockable": key,
                                          "identifier": None, "challenge": None,
                                          "requirement": None,
                                          "note": "no RegisterAchievement grants this unlockable"}

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(f"{OUT_DIR}/achievements.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False, sort_keys=True)

    print(f"{seen} RegisterAchievement attributes, {len(by_unlockable)} grant an unlockable")
    print(f"gated defs: {stats['gated']} | achievement resolved: {stats['resolved']} | "
          f"no granting achievement: {stats['no_achievement']}")
    print(f"-> {OUT_DIR}/achievements.json")


if __name__ == "__main__":
    main()
