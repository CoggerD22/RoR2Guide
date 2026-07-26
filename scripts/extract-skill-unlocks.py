"""Extract every survivor's alternate skills AND the challenge that unlocks each.

Fixes the §5.1 defect at its root. `LOADOUT_UNLOCKS` was hand-entered from the wiki and
used an empty list to mean two different things — "no alternates exist" (Void Fiend,
true) and "we never entered the data" (Drifter, false) — with the UI rendering both as
the positive claim "Fixed kit". Five survivors were under-reported.

The game answers this directly:

    CharacterBody -> SkillLocator.{primary,secondary,utility,special}
      -> GenericSkill._skillFamily -> SkillFamily.variants[]
         -> .skillDef      (the skill)
         -> .unlockableName / .unlockableDef  (empty => available from the start)

and the unlockable joins to its granting achievement via the same chain used for items
(extract-achievements.py), giving the challenge name and the game's requirement text.

The first variant of a family is the default (`defaultVariantIndex`); the rest are the
alternates the Loadout screen exposes. Crucially, "no alternates" and "not recorded"
become *distinguishable*: a survivor whose families genuinely have one variant each is
recorded as `alternates: []` with `complete: true`.

Output (git-ignored): .gamedata/skill-unlocks.json
  { "<survivorId>": { "body":…, "complete": true,
      "alternates": [ {slot, skill, token, unlockable, challenge, requirement} ] } }

Usage: python scripts/extract-skill-unlocks.py [path-to-"Risk of Rain 2_Data"]
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
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, ".gamedata")
SLOTS = ("primary", "secondary", "utility", "special")

# survivorId -> body GameObject name (same table as extract-loadouts.py)
SURVIVOR_BODY = {
    "commando": "CommandoBody", "huntress": "HuntressBody", "bandit": "Bandit2Body",
    "mul-t": "ToolbotBody", "engineer": "EngiBody", "artificer": "MageBody",
    "mercenary": "MercBody", "rex": "TreebotBody", "loader": "LoaderBody",
    "acrid": "CrocoBody", "captain": "CaptainBody", "heretic": "HereticBody",
    "railgunner": "RailgunnerBody", "void-fiend": "VoidSurvivorBody",
    "seeker": "SeekerBody", "false-son": "FalseSonBody", "chef": "ChefBody",
    "operator": "DroneTechBody", "drifter": "DrifterBody",
}


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


def main():
    tokens = load_tokens()

    ach_path = f"{OUT_DIR}/achievements.json"
    by_unlockable = {}
    if os.path.exists(ach_path):
        by_unlockable = json.load(open(ach_path, encoding="utf-8")).get("byUnlockable", {})
    else:
        print("  note: .gamedata/achievements.json missing — challenges will be unresolved")

    idx_path = f"{OUT_DIR}/unlockable-index.json"
    if not os.path.exists(idx_path):
        sys.exit("Missing .gamedata/unlockable-index.json — run extract-unlockables.py first")
    unlockable_index = json.load(open(idx_path, encoding="utf-8"))

    bodies = json.load(open(f"{OUT_DIR}/bodies.json", encoding="utf-8"))
    body_bundle = {name: rec["_bundle"] for name, rec in bodies.items()}

    by_bundle = {}
    for sid, body in SURVIVOR_BODY.items():
        b = body_bundle.get(body)
        if b:
            by_bundle.setdefault(b, []).append((sid, body))

    out = {}
    for bundle, members in by_bundle.items():
        files = glob.glob(f"{AA}/{bundle}")
        if not files:
            continue
        try:
            env = UnityPy.load(*files)
            objs = list(env.objects)
        except Exception:
            continue
        byid = {o.path_id: o for o in objs}

        def tt(pid):
            o = byid.get(pid)
            if not o:
                return None
            try:
                return o.read_typetree()
            except Exception:
                return None

        for sid, body in members:
            loc = None
            for o in objs:
                if str(o.type.name) != "MonoBehaviour":
                    continue
                try:
                    t = o.read_typetree()
                except Exception:
                    continue
                if all(k in t for k in SLOTS) and "passiveSkill" in t:
                    try:
                        owner = o.read().m_GameObject.read().m_Name
                    except Exception:
                        owner = None
                    if owner == body:
                        loc = t
                        break
            if not loc:
                out[sid] = {"body": body, "complete": False, "alternates": [],
                            "note": "SkillLocator not found"}
                continue

            alternates = []
            for slot in SLOTS:
                gs = tt((loc.get(slot) or {}).get("m_PathID"))
                fam = tt(((gs or {}).get("_skillFamily") or {}).get("m_PathID")) if gs else None
                variants = (fam or {}).get("variants", []) if fam else []
                default_ix = (fam or {}).get("defaultVariantIndex", 0) or 0
                for ix, v in enumerate(variants):
                    if ix == default_ix:
                        continue  # the starting skill, not an unlockable alternate
                    sd = tt((v.get("skillDef") or {}).get("m_PathID"))
                    if not sd:
                        continue
                    # `unlockableName` is the legacy string field (SkillFamily still
                    # carries UpgradeUnlockableNameToUnlockableDef()); shipped data uses
                    # the unlockableDef PPtr, which points OUTSIDE this bundle — so it
                    # resolves through the global path_id index.
                    unlockable = (v.get("unlockableName") or "").strip() or None
                    if not unlockable:
                        pid = (v.get("unlockableDef") or {}).get("m_PathID")
                        if pid:
                            unlockable = unlockable_index.get(str(pid))
                    ach = by_unlockable.get(unlockable) if unlockable else None
                    alternates.append({
                        "slot": slot.capitalize(),
                        "skill": tokens.get(sd.get("skillNameToken", ""), sd.get("skillName")),
                        "token": sd.get("skillNameToken"),
                        "unlockable": unlockable or None,
                        "challenge": (ach or {}).get("challenge"),
                        "requirement": (ach or {}).get("requirement"),
                    })
            out[sid] = {"body": body, "complete": True, "alternates": alternates}

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(f"{OUT_DIR}/skill-unlocks.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False, sort_keys=True)

    total = sum(len(v["alternates"]) for v in out.values())
    resolved = sum(1 for v in out.values() for a in v["alternates"] if a["challenge"])
    fixed_kit = [k for k, v in out.items() if v["complete"] and not v["alternates"]]
    print(f"{len(out)} survivors, {total} alternate skills, {resolved} with a resolved challenge")
    print(f"genuinely fixed-kit (no alternates in the game data): {fixed_kit}")
    print(f"-> {OUT_DIR}/skill-unlocks.json")


if __name__ == "__main__":
    main()
