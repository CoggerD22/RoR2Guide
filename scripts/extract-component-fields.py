"""Dump serialized fields of MonoBehaviours by their C# class name (PLAN §5.0.2).

The gap this fills: a behaviour class can declare a public field with NO initialiser and
have its value set on a prefab. `AffixBeadAttachment` is the motivating case — it holds
`maxAllies = 5` and `cooldownAfterFiring = 10f` as real constants in code, but the tether
range, the armor it grants, and the hit count that fires the spike are all serialized. The
C# shows the field exists and never shows the number.

Existing extractors could not reach these:
  - extract-item-prefabs.py keys on `ror2-*-items-<name>` bundle names, and elite/aspect
    content is not in an items bundle (§3j.14 already recorded that bundle-name scanning
    is the wrong axis).
  - extract-state-fields.py only reads EntityStateConfiguration assets.

Selection is by **field name**, not by class name. The obvious approach — resolve each
MonoBehaviour's `m_Script` pointer to its MonoScript and read `m_ClassName` — does not work
here: every MonoScript pointer in these bundles has `m_FileID == 1`, i.e. it lives in an
external dependency that is not loaded, so the class name is simply unavailable. Measured,
not assumed: a probe over the first bundles resolved 0 of 2 MonoBehaviours and saw only
`m_FileID == 1`.

Field names survive in the typetree regardless, and they are distinctive enough to be a
better key anyway — `maxAllies` plus `cooldownAfterFiring` identifies exactly one component.

Output (git-ignored): .gamedata/component-fields.json
  { "maxAllies": [ { "owner": "AffixBeadBodyAttachment", "fields": {…} } ] }

Usage: python scripts/extract-component-fields.py fieldName [fieldName ...]
       e.g. python scripts/extract-component-fields.py maxAllies damageHitCountTotal
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

NOISE = re.compile(r"^m_|^k[A-Z]|Layer$|LayerMask|Hash$|^instanceID$", re.I)


def scalars(t: dict) -> dict:
    """Numeric/bool fields only — the tuning values, not the object graph."""
    out = {}
    for k, v in t.items():
        if NOISE.search(k) or not isinstance(v, (int, float, bool)):
            continue
        if isinstance(v, float) and (v != v or v in (float("inf"), float("-inf"))):
            v = str(v)
        out[k] = v
    return out


def main():
    if not os.path.isdir(AA):
        sys.exit(f"Addressables not found: {AA}")
    wanted = set(sys.argv[1:])
    if not wanted:
        sys.exit("Give one or more FIELD names, e.g. maxAllies cooldownAfterFiring")

    out = {}
    for f in sorted(glob.glob(f"{AA}/*.bundle")):
        try:
            env = UnityPy.load(f)
            objs = list(env.objects)
        except Exception:
            continue
        byid = {o.path_id: o for o in objs}
        for o in objs:
            if str(o.type.name) != "MonoBehaviour":
                continue
            try:
                t = o.read_typetree()
            except Exception:
                continue
            hits = wanted & set(t.keys())
            if not hits:
                continue
            fields = scalars(t)
            if not fields:
                continue
            owner = ""
            try:
                go = t.get("m_GameObject") or {}
                if go.get("m_PathID") in byid:
                    owner = byid[go["m_PathID"]].read().m_Name
            except Exception:
                pass
            for h in hits:
                out.setdefault(h, []).append({
                    "bundle": os.path.basename(f), "owner": owner, "fields": fields,
                })

    os.makedirs(OUT_DIR, exist_ok=True)
    path = f"{OUT_DIR}/component-fields.json"
    existing = {}
    if os.path.exists(path):
        try:
            existing = json.load(open(path, encoding="utf-8"))
        except Exception:
            existing = {}
    existing.update(out)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(existing, fh, indent=1, ensure_ascii=False, sort_keys=True)

    for cls in sorted(wanted):
        insts = out.get(cls, [])
        print(f"{cls}: {len(insts)} component(s) carrying it")
        for i in insts[:3]:
            print(f"  [{i['owner']}] {json.dumps(i['fields'], sort_keys=True)}")
    print(f"-> {path}")


if __name__ == "__main__":
    main()
