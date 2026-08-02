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

# Two patterns, and the split matters (MATH-VERIFICATION §3j.73).
#
# This was one case-INSENSITIVE regex, and `Layer$` under re.I matches the trailing "layer"
# inside "P|layer" — so every serialized field ending in "Player" had been silently dropped
# from every query ever run through this tool. `defenseMatrixToGrantPlayer` is how it was
# found: the probe showed the value serialized as 1, and the extractor reported the component
# without it. `^k[A-Z]` was over-matching the same way ("keepAlive" -> k + "e").
#
# Unity's own noise is capitalised (`m_Layer`, `groundLayer`, `kMaxCount`), so making those
# alternatives case-SENSITIVE keeps them filtered while letting real fields through.
NOISE_CS = re.compile(r"^m_|^k[A-Z]|Layer$|LayerMask")
NOISE_CI = re.compile(r"Hash$|^instanceID$", re.I)


class _Noise:
    """Kept as a `NOISE.search(name)` shim so call sites read unchanged."""

    @staticmethod
    def search(name: str):
        return NOISE_CS.search(name) or NOISE_CI.search(name)


NOISE = _Noise


def _num(v):
    """JSON-safe scalar, or None if this isn't one."""
    if isinstance(v, bool) or isinstance(v, int):
        return v
    if isinstance(v, float):
        return str(v) if (v != v or v in (float("inf"), float("-inf"))) else v
    return None


def scalars(t: dict) -> dict:
    """Numeric/bool fields only — the tuning values, not the object graph."""
    out = {}
    for k, v in t.items():
        if NOISE.search(k):
            continue
        n = _num(v)
        if n is not None:
            out[k] = n
    return out


def arrays(t: dict, byid: dict) -> dict:
    """
    Lists of structs, which `scalars` cannot see and which hide real tuning values.

    The motivating case is `CharacterSpawnCard.itemsToGrant` (MATH-VERIFICATION §3j.69):
    Defense Nucleus's stated 300% damage / 300% health are `ItemCountPair` entries — a PPtr
    to an ItemDef plus an int `count` — so the number that matters is a scalar sitting one
    level inside an array. Reading only top-level scalars made it invisible, and because a
    ScriptableObject whose interesting content is entirely arrays yields an EMPTY scalar
    dict, the old `if not fields: continue` discarded the whole record silently.

    PPtrs are kept as resolved names when the target is in this bundle and as a bare
    `#<pathId>` when it is not — the same `m_FileID != 0` wall that defeats `m_Script`
    resolution. A pair of {name-or-id, count} is still enough to identify a grant, and
    labelling the unresolved case is better than dropping it.
    """
    out = {}
    for k, v in t.items():
        if NOISE.search(k) or not isinstance(v, list) or not v:
            continue
        rows = []
        for el in v:
            if not isinstance(el, dict):
                n = _num(el)
                if n is not None:
                    rows.append(n)
                continue
            row = {}
            for ek, ev in el.items():
                n = _num(ev)
                if n is not None and not NOISE.search(ek):
                    row[ek] = n
                elif isinstance(ev, dict) and "m_PathID" in ev:
                    pid = ev.get("m_PathID")
                    if not pid:
                        continue
                    name = None
                    if pid in byid:
                        try:
                            name = byid[pid].read().m_Name
                        except Exception:
                            name = None
                    row[ek] = name or f"#{pid}"
            if row:
                rows.append(row)
        if rows:
            out[k] = rows
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
            lists = arrays(t, byid)
            if not fields and not lists:
                continue
            # ScriptableObjects (CharacterSpawnCard, ItemDef, …) have no m_GameObject, so
            # the prefab-owner lookup returns nothing and every such record used to be
            # labelled "". Their own m_Name is the identity, and without it the bundle name
            # was the only handle — which §3j.67 showed is necessary but not sufficient.
            owner = ""
            try:
                go = t.get("m_GameObject") or {}
                if go.get("m_PathID") in byid:
                    owner = byid[go["m_PathID"]].read().m_Name
            except Exception:
                pass
            if not owner:
                owner = t.get("m_Name") or ""
            for h in hits:
                rec = {"bundle": os.path.basename(f), "owner": owner, "fields": fields}
                if lists:
                    rec["lists"] = lists
                out.setdefault(h, []).append(rec)

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
