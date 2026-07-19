"""Extract proc-coefficient ground truth from the game's bundles + language files.

A skill's proc coefficient can live in one of three places, and they must NOT be
conflated:
  1. EntityStateConfiguration — for hitscan/melee states, the configured
     `procCoefficient` static field (authoritative shipped value).
  2. Code default — `public static float procCoefficient = Xf` in the EntityState
     (only relevant when no ESC overrides it; captured separately from decompile).
  3. Projectile prefab — for projectile skills, the coefficient lives on the fired
     projectile's ProjectileController, not on the skill state.

This script pulls layers 1 and 3 from the bundles (layer 2 is a decompile grep,
kept in data-verify). It keys everything on the EntityState type name so a SkillDef
(activationState._typeName) can be joined to its configured value.

Output (git-ignored, .gamedata/procs.json):
  { "skills":[{name,token,stateType,stateMachine,rechargeInterval,maxStock}],
    "stateProcConfigs":{ "<EntityState type>": <value> },     # layer 1 (ESC)
    "projectileProc":{ "<prefab name>": <value> } }           # layer 3

Usage: python scripts/extract-procs.py [path-to-"Risk of Rain 2_Data"]   (~30s)
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
        return s


def finite(x):
    """JSON has no Infinity/NaN; passive skills use Infinity recharge -> null."""
    return x if isinstance(x, (int,)) or (isinstance(x, float) and x == x and abs(x) != float("inf")) else None


def gameobject_proc(reader, byid):
    """procCoefficient of a projectile GameObject: scan its components."""
    try:
        go = reader.read()
        for c in go.m_Components:
            try:
                ct = c.read().object_reader.read_typetree()
                if "procCoefficient" in ct:
                    return num(ct["procCoefficient"])
            except Exception:
                pass
    except Exception:
        pass
    return None


def extract():
    if not os.path.isdir(AA):
        sys.exit(f"Addressables not found: {AA}")
    tokens = load_tokens()
    skills, state_proc, proj_proc = [], {}, {}
    # stateType -> {"proc": value, "source": "esc"|"projectile:<name>", "projectile": name}
    state_resolved = {}

    for f in sorted(glob.glob(f"{AA}/*.bundle")):
        try:
            env = UnityPy.load(f)
        except Exception:
            continue
        objs = list(env.objects)
        byid = {o.path_id: o for o in objs}

        for o in objs:
            if str(o.type.name) != "MonoBehaviour":
                continue
            try:
                t = o.read_typetree()
            except Exception:
                continue

            # EntityStateConfiguration: direct procCoefficient and/or projectilePrefab link
            sfc = t.get("serializedFieldsCollection")
            if isinstance(sfc, dict):
                tt = t.get("targetType") or {}
                tname = (tt.get("assemblyQualifiedName", "") if isinstance(tt, dict) else str(tt)).split(",")[0]
                direct, proj_pptr = None, None
                for fld in sfc.get("serializedFields", []):
                    fn = fld.get("fieldName")
                    if fn == "procCoefficient":
                        direct = num((fld.get("fieldValue") or {}).get("stringValue"))
                    elif fn == "projectilePrefab":
                        ov = (fld.get("fieldValue") or {}).get("objectValue") or {}
                        proj_pptr = (ov.get("m_FileID"), ov.get("m_PathID"))
                if direct is not None:
                    state_proc[tname] = direct
                    state_resolved[tname] = {"proc": direct, "source": "esc"}
                elif proj_pptr and proj_pptr[0] == 0 and proj_pptr[1] in byid:
                    ref = byid[proj_pptr[1]]
                    pname = None
                    try:
                        pname = ref.read().m_Name
                    except Exception:
                        pass
                    pv = gameobject_proc(ref, byid)
                    if pv is not None:
                        state_resolved.setdefault(tname, {"proc": pv, "source": f"projectile:{pname}", "projectile": pname})

            # SkillDef
            if "activationState" in t and "skillNameToken" in t:
                st = (t.get("activationState") or {}).get("_typeName", "")
                skills.append({
                    "name": tokens.get(t.get("skillNameToken", ""), t.get("skillName") or t.get("m_Name")),
                    "token": t.get("skillNameToken"),
                    "stateType": st,
                    "stateMachine": t.get("activationStateMachineName"),
                    "rechargeInterval": finite(t.get("baseRechargeInterval")),
                    "maxStock": t.get("baseMaxStock"),
                })

            # standalone projectile prefab
            if "procCoefficient" in t and "activationState" not in t and "serializedFieldsCollection" not in t:
                try:
                    proj_proc[o.read().m_GameObject.read().m_Name] = num(t["procCoefficient"])
                except Exception:
                    pass

    os.makedirs(OUT_DIR, exist_ok=True)
    out = {
        "skills": sorted(skills, key=lambda s: str(s["stateType"])),
        "stateProc": dict(sorted(state_resolved.items())),   # resolved: esc OR projectile
        "stateProcConfigs": dict(sorted(state_proc.items())),  # esc-direct only
        "projectileProc": dict(sorted(proj_proc.items())),
    }
    json.dump(out, open(f"{OUT_DIR}/procs.json", "w"), indent=1)
    print(f"{len(skills)} SkillDefs, {len(state_resolved)} states resolved "
          f"({len(state_proc)} esc-direct + {len(state_resolved)-len(state_proc)} via projectile), "
          f"{len(proj_proc)} standalone projectiles -> {OUT_DIR}/procs.json")


if __name__ == "__main__":
    extract()
