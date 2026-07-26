"""Determine which items/equipment are ACTUALLY gated behind an unlock, from the defs.

An item is challenge-locked iff its `ItemDef.unlockableDef` / `EquipmentDef.unlockableDef`
points at a real UnlockableDef. That pointer — not the wiki, not a description token —
is the authoritative answer to "does the player have to earn this?" (PLAN §5.0.2,
claim kind = Existence/Identity, source = the registered def).

Why this script exists: the codex shows a lock badge driven by items.json `unlock`,
which was populated from the wiki. If the game gates an item we don't mark, the site
silently tells the player it's freely available — a false statement by omission. This
extraction lets `data:audit` diff our locked set against the game's.

Addressables path_ids are globally unique, so UnlockableDefs are indexed across every
bundle first, then item defs resolve their pointer against that index (the same
technique the void-corruption extraction uses for cross-bundle PPtrs).

Output (git-ignored): .gamedata/unlockables.json
  { "items":     { "<cachedName>": {name, unlockable, unlockableToken} | null },
    "equipment": { ... } }

Usage: python scripts/extract-unlockables.py [path-to-"Risk of Rain 2_Data"]
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
    if not os.path.isdir(AA):
        sys.exit(f"Addressables not found: {AA}")
    tokens = load_tokens()

    unlockables = {}   # path_id -> {"cachedName", "nameToken"}
    defs = []          # (kind, cachedName, nameToken, unlockable_path_id|None)

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

            # UnlockableDef: nameToken + no def-ish fields. Identify by field signature,
            # since script pointers don't resolve across bundles.
            if "nameToken" in t and "achievementIcon" in t:
                unlockables[o.path_id] = {
                    "cachedName": t.get("cachedName") or t.get("m_Name") or "",
                    "nameToken": t.get("nameToken") or "",
                }
                continue

            if "nameToken" not in t or "unlockableDef" not in t:
                continue
            is_equipment = "cooldown" in t and "deprecatedTier" not in t
            is_item = "deprecatedTier" in t
            if not (is_equipment or is_item):
                continue
            ud = t.get("unlockableDef") or {}
            pid = ud.get("m_PathID") or None
            defs.append((
                "equipment" if is_equipment else "items",
                t.get("m_Name") or "",
                t.get("nameToken") or "",
                pid,
            ))

    out = {"items": {}, "equipment": {}}
    unresolved = 0
    for kind, cached, tok, pid in defs:
        rec = None
        if pid:
            u = unlockables.get(pid)
            if u:
                rec = {
                    "unlockable": u["cachedName"],
                    "unlockableToken": u["nameToken"],
                    "challenge": tokens.get(u["nameToken"], None),
                }
            else:
                unresolved += 1
                rec = {"unlockable": None, "unlockableToken": None, "challenge": None,
                       "note": f"unlockableDef path_id {pid} not found"}
        out[kind][cached] = {"name": tokens.get(tok, "?"), **(rec or {})} if rec else \
                            {"name": tokens.get(tok, "?"), "unlockable": None}

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(f"{OUT_DIR}/unlockables.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False, sort_keys=True)

    # Global path_id -> cachedName index. Addressables path_ids are unique across
    # bundles, so this lets other extractors resolve an unlockableDef PPtr that points
    # outside their own bundle — which is how SkillFamily.Variant references them
    # (extract-skill-unlocks.py).
    with open(f"{OUT_DIR}/unlockable-index.json", "w", encoding="utf-8") as fh:
        json.dump({str(pid): u["cachedName"] for pid, u in unlockables.items()},
                  fh, indent=1, ensure_ascii=False, sort_keys=True)

    locked_i = sum(1 for v in out["items"].values() if v.get("unlockable"))
    locked_e = sum(1 for v in out["equipment"].values() if v.get("unlockable"))
    print(f"{len(out['items'])} ItemDefs ({locked_i} locked), "
          f"{len(out['equipment'])} EquipmentDefs ({locked_e} locked), "
          f"{len(unlockables)} UnlockableDefs -> {OUT_DIR}/unlockables.json")
    if unresolved:
        print(f"  ⚠ {unresolved} unlockableDef pointer(s) unresolved")


if __name__ == "__main__":
    main()
