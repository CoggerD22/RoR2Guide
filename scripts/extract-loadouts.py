"""Extract each survivor's LOADOUT skills and resolve each one's proc coefficient.

The clean key for a proc table is the loadout slot, not raw SkillDefs (which include
intermediate Setup/Prep sub-states and duplicates). For each survivor body:
  SkillLocator (primary/secondary/utility/special)
    -> GenericSkill._skillFamily
      -> SkillFamily.variants[].skillDef
        -> SkillDef.activationState._typeName + skillNameToken

Everything is same-bundle (FileID 0), so it resolves within the survivor's own
static bundle — including the skill's EntityStateConfiguration (proc override) and
any projectilePrefab it fires.

Proc resolution per skill state:
  1. ESC procCoefficient field            -> source "esc"
  2. ESC projectilePrefab -> projectile's procCoefficient -> source "projectile:<name>"
  3. otherwise null (source "unresolved") — filled/curated separately, NOT guessed.

Output (git-ignored, .gamedata/loadouts.json):
  { "<survivorId>": { "body": name, "slots": {
      "primary": [ {name, token, displayName, state, proc, procSource, projectile?} ], ...
  }}}

Usage: python scripts/extract-loadouts.py [path-to-"Risk of Rain 2_Data"]
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
SLOTS = ("primary", "secondary", "utility", "special")

# survivorId -> body GameObject name (proven from SurvivorDef cachedName, Phase 3)
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
    tokens = {}
    for lf in glob.glob(f"{LANG}/*.json"):
        try:
            raw = re.sub(r",\s*([}\]])", r"\1", open(lf, encoding="utf-8-sig").read())
            tokens.update(json.loads(raw).get("strings", {}))
        except Exception:
            pass
    return tokens


def num(s):
    try:
        f = float(s)
        return int(f) if f == int(f) else round(f, 4)
    except (TypeError, ValueError):
        return None


def build_body_index():
    """body name -> bundle path (from the static bundle that holds its CharacterBody)."""
    bodies = json.load(open(f"{OUT_DIR}/bodies.json"))
    return {name: rec["_bundle"] for name, rec in bodies.items()}


# Fields that ARE the skill's primary proc coefficient, best first. A skill's
# attack type dictates which one it uses (bullet=procCoefficient, orb=orbProcCoefficient,
# blast=blastProcCoefficient, …). "Per"/bonus/delayed fields are secondary and skipped
# for the headline value.
PRIMARY_PROC_FIELDS = [
    "procCoefficient", "blastProcCoefficient", "blastAttackProcCoefficient",
    "explosionProcCoefficient", "orbProcCoefficient", "glaiveProcCoefficient",
    "discProcCoefficient", "mainBeamProcCoefficient", "shockProcCoefficient",
    "meatballProcCoefficient", "unchargedBlastProcCoefficient",
    "procCoefficientPerTick", "procCoefficientPerSecond", "baseProcCoefficientPerSecond",
]


def esc_proc(esc):
    """Pick the primary proc coefficient from an ESC's captured proc fields."""
    pf = esc.get("procFields", {})
    for name in PRIMARY_PROC_FIELDS:
        if name in pf and pf[name] is not None:
            return pf[name], f"esc:{name}"
    return None, None


def resolve_proc(sd_state_type, esc_by_type, byid):
    """Return (proc, source, projectile) for an activationState type."""
    esc = esc_by_type.get(sd_state_type)
    if esc is not None:
        val, src = esc_proc(esc)
        if val is not None:
            return val, src, None
        for ppid in esc.get("prefab_pathids", []):
            if ppid not in byid:
                continue
            try:
                go = byid[ppid].read()
                for c in go.m_Components:
                    ct = c.read().object_reader.read_typetree()
                    if "procCoefficient" in ct:
                        return num(ct["procCoefficient"]), f"projectile:{go.m_Name}", go.m_Name
            except Exception:
                pass
    return None, "unresolved", None


def extract():
    tokens = load_tokens()
    body_bundle = build_body_index()
    out = {}

    # group survivors by bundle so each bundle loads once
    by_bundle = {}
    for sid, body in SURVIVOR_BODY.items():
        b = body_bundle.get(body)
        if b:
            by_bundle.setdefault(b, []).append((sid, body))

    for bundle, members in by_bundle.items():
        files = glob.glob(f"{AA}/{bundle}")
        if not files:
            continue
        env = UnityPy.load(*files)
        objs = list(env.objects)
        byid = {o.path_id: o for o in objs}

        def tt(pid):
            o = byid.get(pid)
            if not o:
                return None
            try:
                return o.read_typetree()
            except Exception:
                return None

        # index EntityStateConfiguration in this bundle by target type
        esc_by_type = {}
        for o in objs:
            if str(o.type.name) != "MonoBehaviour":
                continue
            try:
                t = o.read_typetree()
            except Exception:
                continue
            sfc = t.get("serializedFieldsCollection")
            if not isinstance(sfc, dict):
                continue
            ttv = t.get("targetType") or {}
            tname = (ttv.get("assemblyQualifiedName", "") if isinstance(ttv, dict) else str(ttv)).split(",")[0]
            rec = {"procFields": {}, "prefab_pathids": []}
            for fld in sfc.get("serializedFields", []):
                fn = fld.get("fieldName", "")
                if fn.endswith("procCoefficient") or fn.endswith("ProcCoefficient"):
                    rec["procFields"][fn] = num((fld.get("fieldValue") or {}).get("stringValue"))
                elif fn.endswith("Prefab") or fn.endswith("prefab"):
                    # any prefab ref; only the one carrying procCoefficient is a projectile
                    ov = (fld.get("fieldValue") or {}).get("objectValue") or {}
                    if ov.get("m_FileID") == 0 and ov.get("m_PathID"):
                        # projectilePrefab first if present, else append
                        if fn == "projectilePrefab":
                            rec["prefab_pathids"].insert(0, ov["m_PathID"])
                        else:
                            rec["prefab_pathids"].append(ov["m_PathID"])
            esc_by_type[tname] = rec

        # find each member's SkillLocator (component on the body GameObject)
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
                out[sid] = {"body": body, "slots": {}, "_note": "SkillLocator not found"}
                continue

            slots = {}
            for slot in SLOTS:
                pid = (loc.get(slot) or {}).get("m_PathID")
                gs = tt(pid)
                fam = tt(((gs or {}).get("_skillFamily") or {}).get("m_PathID")) if gs else None
                variants = (fam or {}).get("variants", []) if fam else []
                items = []
                for v in variants:
                    sd = tt((v.get("skillDef") or {}).get("m_PathID"))
                    if not sd:
                        continue
                    state = (sd.get("activationState") or {}).get("_typeName", "")
                    proc, src, proj = resolve_proc(state, esc_by_type, byid)
                    items.append({
                        "name": sd.get("skillName"),
                        "token": sd.get("skillNameToken"),
                        "displayName": tokens.get(sd.get("skillNameToken", ""), sd.get("skillName")),
                        "state": state,
                        "proc": proc,
                        "procSource": src,
                        **({"projectile": proj} if proj else {}),
                    })
                slots[slot] = items
            out[sid] = {"body": body, "slots": slots}

    os.makedirs(OUT_DIR, exist_ok=True)
    json.dump(out, open(f"{OUT_DIR}/loadouts.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    n_sk = sum(len(v) for s in out.values() for v in s.get("slots", {}).values())
    n_res = sum(1 for s in out.values() for v in s.get("slots", {}).values() for k in v if k["proc"] is not None)
    print(f"{len(out)} survivors, {n_sk} loadout variants, {n_res} with a resolved proc -> {OUT_DIR}/loadouts.json")


if __name__ == "__main__":
    extract()
