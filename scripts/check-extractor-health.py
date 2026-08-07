"""Are the extractors' swallowed exceptions inert? (MATH-VERIFICATION §3j.104)

Every extractor in this directory follows the same shape:

    try:  env = UnityPy.load(bundle)
    except Exception: continue          # skip the bundle
    ...
    try:  t = o.read_typetree()
    except Exception: continue          # skip the object

There are 50+ of these across the family. Each is defensible on its own — a corrupt or
unexpected asset should not abort a whole extraction — and collectively they are the
project's most dangerous construct, because a failure that skips input **looks exactly like
a game that contains less**. §3j.73 found a filter silently dropping every field whose name
ended in "Player"; §3j.70 found records dropped entirely for having only array-valued
fields. Both returned a plausible smaller answer rather than an error.

The two dominant swallow classes are global properties of the install plus the UnityPy
version, not of any one script, so measuring them once covers every extractor that uses
them. This measures them, and the name-resolution and language-parse classes too.

Run after a game patch, or after upgrading UnityPy. A non-zero count does not mean an
extraction is wrong — it means the "0 skipped" assumption behind every number in
`.gamedata/` no longer holds and the affected extractor needs looking at.

    python scripts/check-extractor-health.py
"""
import glob
import json
import os
import re
import sys

import UnityPy

GAME = os.environ.get(
    "ROR2_DATA_DIR",
    "E:/SteamLibrary/steamapps/common/Risk of Rain 2/Risk of Rain 2_Data",
)
AA = f"{GAME}/StreamingAssets/aa/StandaloneWindows64"
LANG = f"{GAME}/StreamingAssets/Language/en"


def main() -> int:
    if not os.path.isdir(AA):
        print(f"Addressables not found: {AA}")
        print("Set ROR2_DATA_DIR to the game's *_Data directory.")
        return 2

    failures = {}

    # Class 1: language files that will not parse (the game ships trailing commas).
    lang_bad = []
    for lf in sorted(glob.glob(f"{LANG}/*.json")):
        try:
            raw = open(lf, encoding="utf-8-sig").read()
            json.loads(re.sub(r",\s*([}\]])", r"\1", raw)).get("strings", {})
        except Exception as e:
            lang_bad.append(f"{os.path.basename(lf)} ({type(e).__name__})")
    failures["language files unparseable"] = lang_bad

    # Classes 2-4: bundle load, typetree read, and GameObject name resolution.
    bundles = sorted(glob.glob(f"{AA}/*.bundle"))
    bundle_bad, tt_bad, name_bad = [], 0, 0
    objects = 0
    for f in bundles:
        try:
            env = UnityPy.load(f)
            objs = list(env.objects)
        except Exception as e:
            bundle_bad.append(f"{os.path.basename(f)} ({type(e).__name__})")
            continue
        for o in objs:
            if str(o.type.name) != "MonoBehaviour":
                continue
            objects += 1
            try:
                t = o.read_typetree()
            except Exception:
                tt_bad += 1
                continue
            # Only probe the name where an extractor would: on a component that carries
            # something worth keying by owner.
            if "baseMaxHealth" in t:
                try:
                    o.read().m_GameObject.read().m_Name
                except Exception:
                    name_bad += 1
    failures["bundles that fail to load"] = bundle_bad
    failures["typetrees that fail to read"] = [f"{tt_bad} objects"] if tt_bad else []
    failures["owner names that fail to resolve"] = [f"{name_bad} components"] if name_bad else []

    print(f"scanned {len(bundles)} bundles, {objects} MonoBehaviours, "
          f"{len(glob.glob(f'{LANG}/*.json'))} language files\n")
    bad = 0
    for label, items in failures.items():
        if items:
            bad += 1
            print(f"  ! {label}: {len(items)}")
            for i in items[:8]:
                print(f"      {i}")
        else:
            print(f"  ok {label}: 0")

    if bad:
        print("\nThe extractors' swallowed exceptions are NO LONGER inert. Any '0 skipped'")
        print("assumption behind .gamedata/ output needs re-checking before it is trusted.")
        return 1
    print("\nAll swallow classes inert: extractions ran over complete input.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
