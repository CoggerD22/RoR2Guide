"""Extract every SceneDef (stage) with its game-authoritative stage order.

`SceneDef.stageOrder` is the number the game itself uses for stage progression, so
the Bazaar-dreams table's "which stage does this seed?" column can be generated
rather than transcribed from the wiki (PLAN §5.0).

Observed order conventions in the shipped data:
  1..6   normal stage progression (order 6 = Commencement / the moon)
  >=93   hidden realms, special, and non-progression scenes (Bazaar, Gilded Coast,
         Void Locus, Prime Meridian, Artifact world, Simulacrum variants, test scenes)
  0      menus / non-gameplay scenes

Scanning is broad (SceneDefs are scattered across bundles), so the result is cached
to .gamedata/scenedefs.json and consumed by extract-reference.py.

Output (git-ignored): .gamedata/scenedefs.json
  { "<baseSceneName>": { "order": int, "nameToken": str } }

Usage: python scripts/extract-scenedefs.py [path-to-"Risk of Rain 2_Data"]
"""
import glob
import json
import os
import sys

import UnityPy

DEFAULT_GAME = "E:/SteamLibrary/steamapps/common/Risk of Rain 2/Risk of Rain 2_Data"
GAME = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("ROR2_DATA_DIR", DEFAULT_GAME)
AA = f"{GAME}/StreamingAssets/aa/StandaloneWindows64"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, ".gamedata")

# Art/mesh bundles are large and never contain SceneDefs; skipping them keeps the
# sweep to a few minutes without affecting the result.
MAX_BUNDLE_BYTES = 12_000_000


def main():
    if not os.path.isdir(AA):
        sys.exit(f"Addressables not found: {AA}")
    bundles = sorted(glob.glob(f"{AA}/*.bundle"), key=os.path.getsize)
    scenes = {}
    scanned = 0
    for f in bundles:
        if os.path.getsize(f) > MAX_BUNDLE_BYTES:
            continue
        scanned += 1
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
            if "stageOrder" not in t:
                continue
            name = t.get("baseSceneName") or t.get("m_Name")
            if not name:
                continue
            scenes[name] = {"order": t.get("stageOrder"), "nameToken": t.get("nameToken") or ""}

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(f"{OUT_DIR}/scenedefs.json", "w", encoding="utf-8") as fh:
        json.dump(scenes, fh, indent=1, ensure_ascii=False, sort_keys=True)
    print(f"{len(scenes)} SceneDefs from {scanned} bundles -> {OUT_DIR}/scenedefs.json")


if __name__ == "__main__":
    main()
