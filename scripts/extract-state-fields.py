"""Dump every numeric EntityStateConfiguration field, keyed by state type (PLAN §5.0.2).

`extract-procs.py` reads exactly one field — `procCoefficient` — out of these assets. But
EntityStateConfiguration is where a large amount of RoR2's tuning actually lives: a state
declares `public static float mainBeamDamageCoefficient;` with no initialiser, and the
value is injected from the asset at runtime. Grepping the decompile for such a constant
finds only the declaration, which is why Resonance Disc looked unverifiable —
`FireMainBeamState.mainBeamDamageCoefficient` has no value anywhere in the C#.

So this generalises the same read: for every EntityStateConfiguration, emit all serialized
fields that parse as numbers, keyed by the state's type name.

Output (git-ignored): .gamedata/state-fields.json
  { "EntityStates.LaserTurbine.FireMainBeamState": { "mainBeamDamageCoefficient": 10.0, … } }

Usage: python scripts/extract-state-fields.py [type-substring ...]
"""
import glob
import json
import os
import sys

import UnityPy

DEFAULT_GAME = "E:/SteamLibrary/steamapps/common/Risk of Rain 2/Risk of Rain 2_Data"
GAME = os.environ.get("ROR2_DATA_DIR", DEFAULT_GAME)
AA = f"{GAME}/StreamingAssets/aa/StandaloneWindows64"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, ".gamedata")


def num(s):
    """Parse a serialized field's stringValue, rejecting non-finite sentinels."""
    try:
        v = float(s)
    except (TypeError, ValueError):
        return None
    if v != v or v in (float("inf"), float("-inf")):
        return None
    return v


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
            sfc = t.get("serializedFieldsCollection")
            if not isinstance(sfc, dict):
                continue
            tt = t.get("targetType") or {}
            tname = (tt.get("assemblyQualifiedName", "") if isinstance(tt, dict)
                     else str(tt)).split(",")[0]
            if not tname:
                continue
            if wanted and not any(w in tname.lower() for w in wanted):
                continue
            fields = {}
            for fld in sfc.get("serializedFields", []):
                fn = fld.get("fieldName")
                v = num((fld.get("fieldValue") or {}).get("stringValue"))
                if fn and v is not None:
                    fields[fn] = v
            if fields:
                out.setdefault(tname, {}).update(fields)

    os.makedirs(OUT_DIR, exist_ok=True)
    path = f"{OUT_DIR}/state-fields.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False, sort_keys=True)
    nf = sum(len(v) for v in out.values())
    print(f"{len(out)} state types, {nf} numeric fields -> {path}")
    for k in sorted(out) if wanted else []:
        print(f"  {k}: {json.dumps(out[k], sort_keys=True)}")


if __name__ == "__main__":
    main()
