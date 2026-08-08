"""Resolve OBJECT REFERENCES in EntityStateConfiguration assets to named prefabs.

The gap this fills: `extract-state-fields.py` reads only fields that parse as NUMBERS out of
`serializedFieldsCollection`. A state's tuning also includes prefab pointers —
`FireMainBeamState.secondBombPrefab` is the motivating case — and those are stored in
`fieldValue.objectValue` as a PPtr (`m_FileID`, `m_PathID`), not in `stringValue`.

Why that mattered: the Resonance Disc damage chain multiplies a code-side coefficient by a
coefficient serialized on the bomb PREFAB. Identifying the prefab by NAME SIMILARITY is not
evidence (MATH-VERIFICATION §3j.118 left a suspected 4x error unfixed for exactly that
reason). This resolves the pointer instead.

How the resolution works: `m_FileID == 0` means the target lives in the same SerializedFile,
so `m_PathID` can be looked up directly in that bundle. `m_FileID > 0` indexes into the
file's `externals` table, naming another CAB; we then search the bundle that provides that
CAB for the matching `m_PathID`. This is the same externals-table walk that made the
cross-bundle reverse scan possible in §3j.106.

Output (git-ignored): .gamedata/state-refs.json
  { "EntityStates.LaserTurbine.FireMainBeamState": { "secondBombPrefab": "LaserTurbineBomb" } }

Usage: python scripts/resolve-state-refs.py [type-substring ...]
       e.g. python scripts/resolve-state-refs.py LaserTurbine
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


def obj_name(o):
    """Best-effort display name for a resolved object."""
    try:
        t = o.read_typetree()
    except Exception:
        return None
    for k in ("m_Name", "name"):
        v = t.get(k)
        if isinstance(v, str) and v:
            return v
    return None


def main():
    if not os.path.isdir(AA):
        sys.exit(f"Addressables not found: {AA}")
    wanted = [a.lower() for a in sys.argv[1:]]

    bundles = sorted(glob.glob(f"{AA}/*.bundle"))

    # Pass 1 — collect the unresolved pointers, and index every CAB we can serve.
    # cab -> bundle path, so an m_FileID naming a CAB can be followed to the file holding it.
    cab_to_bundle = {}
    pending = []   # (stateType, fieldName, fileID, pathID, srcBundle, externals)

    for f in bundles:
        try:
            env = UnityPy.load(f)
            objs = list(env.objects)
        except Exception:
            continue
        for cab in getattr(env, "cabs", {}) or {}:
            cab_to_bundle.setdefault(str(cab).lower(), f)
        for o in objs:
            try:
                cab_to_bundle.setdefault(str(o.assets_file.name).lower(), f)
            except Exception:
                pass
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
            try:
                externals = [str(e.path) for e in o.assets_file.externals]
            except Exception:
                externals = []
            for fld in sfc.get("serializedFields", []):
                fn = fld.get("fieldName")
                fv = fld.get("fieldValue") or {}
                ov = fv.get("objectValue")
                if not fn or not isinstance(ov, dict):
                    continue
                pid = ov.get("m_PathID")
                fid = ov.get("m_FileID")
                if not pid:            # 0 / absent means a null reference
                    continue
                pending.append((tname, fn, fid, pid, f, externals))

    if not pending:
        print("no object-valued serialized fields matched")
        return

    # Pass 2 — resolve each pointer to a name.
    out = {}
    for tname, fn, fid, pid, src, externals in pending:
        target_bundle = None
        if fid == 0:
            target_bundle = src
        else:
            idx = fid - 1
            if 0 <= idx < len(externals):
                cab = os.path.basename(externals[idx]).lower()
                target_bundle = cab_to_bundle.get(cab)
        name = None
        if target_bundle:
            try:
                env = UnityPy.load(target_bundle)
                for o in env.objects:
                    if o.path_id == pid:
                        name = obj_name(o)
                        break
            except Exception:
                name = None
        out.setdefault(tname, {})[fn] = {
            "name": name,
            "m_FileID": fid,
            "m_PathID": pid,
            "resolvedVia": ("same-file" if fid == 0 else "externals"),
            "targetBundle": os.path.basename(target_bundle) if target_bundle else None,
        }

    os.makedirs(OUT_DIR, exist_ok=True)
    path = f"{OUT_DIR}/state-refs.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False, sort_keys=True)

    total = sum(len(v) for v in out.values())
    named = sum(1 for v in out.values() for r in v.values() if r["name"])
    print(f"{len(out)} state types, {total} object refs, {named} resolved to a name -> {path}")
    for k in sorted(out):
        for fld, r in sorted(out[k].items()):
            print(f"  {k}.{fld} -> {r['name'] or '(unresolved)'}  "
                  f"[fileID={r['m_FileID']} pathID={r['m_PathID']} via {r['resolvedVia']}]")


if __name__ == "__main__":
    main()
