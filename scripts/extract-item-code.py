"""Locate the code that implements each item, so stacking claims can be code-verified.

PLAN §6A.1: 192 of 212 items carry `confidence: "langfile"`, meaning their numbers AND
their stacking curve were read out of description prose. That is a Behaviour/Numeric
claim sourced from T2 text, which §6A.2 forbids. This script finds the T0 evidence.

Every item effect is gated on reading the item's count, e.g.

    inventory.GetItemCountEffective(RoR2Content.Items.Crowbar)   // then: 1f + 0.75f * n
    Util.ConvertAmplificationPercentageIntoReductionPercentage(15f * itemCounts.bear)

so the reference sites for `Items.<cachedName>` are exactly where the curve lives.
This emits those sites with surrounding context for verification; it deliberately does
NOT try to infer the curve automatically — a regex guessing at arithmetic is precisely
the kind of plausible-but-unchecked answer this programme exists to eliminate. A human
(or a careful read) classifies from the extracted evidence.

Requires the full decompile:  ilspycmd <RoR2.dll> -p -o .decompiled/full

Output (git-ignored): .gamedata/item-code-sites.json
  { "<itemName>": { "def": cachedName, "sites": [ {file, line, context} ] } }

Usage: python scripts/extract-item-code.py
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL = os.path.join(ROOT, ".decompiled/full")
OUT_DIR = os.path.join(ROOT, ".gamedata")
CONTEXT_BEFORE, CONTEXT_AFTER = 3, 8

# RoR2.decompiled.cs is a flattened duplicate of the per-type files; skipping it avoids
# reporting every site twice. Achievement files reference items as unlock rewards, not
# as effects, and are covered by extract-achievements.py.
SKIP_FILES = ("RoR2.decompiled.cs",)
SKIP_DIRS = ("RoR2.Achievements",)


def main():
    if not os.path.isdir(FULL):
        sys.exit(f"Full decompile missing: {FULL}\n"
                 f"Run: ilspycmd <RoR2.dll> -p -o .decompiled/full")

    defs_path = os.path.join(OUT_DIR, "itemdefs.json")
    if not os.path.exists(defs_path):
        sys.exit("Missing .gamedata/itemdefs.json — run extract-itemdefs.py first")
    defs = json.load(open(defs_path, encoding="utf-8"))

    # display name -> cachedName (the token the code uses: RoR2Content.Items.<cachedName>)
    name_to_def = {}
    for kind in ("items", "equipment"):
        for d in defs.get(kind, []):
            if d.get("name") and d.get("cachedName"):
                name_to_def[d["name"]] = d["cachedName"]

    items = json.load(open(os.path.join(ROOT, "src/data/items.json"), encoding="utf-8"))

    # Pre-load the source once; the corpus is a few thousand files.
    sources = []
    for path in glob.glob(f"{FULL}/**/*.cs", recursive=True):
        base = os.path.basename(path)
        if base in SKIP_FILES:
            continue
        if any(d in path.replace("\\", "/") for d in SKIP_DIRS):
            continue
        try:
            sources.append((os.path.relpath(path, FULL).replace("\\", "/"),
                            open(path, encoding="utf-8", errors="ignore").read().splitlines()))
        except Exception:
            pass

    out = {}
    no_def = []
    no_sites = []
    for item in items:
        cached = name_to_def.get(item["name"])
        if not cached:
            no_def.append(item["name"])
            continue
        # Match `Items.<cachedName>` / `Equipment.<cachedName>` with a word boundary so
        # e.g. Bear does not match BearVoid.
        pat = re.compile(rf"\b(?:Items|Equipment)\.{re.escape(cached)}\b")
        sites = []
        for relpath, lines in sources:
            for i, line in enumerate(lines):
                if pat.search(line):
                    lo = max(0, i - CONTEXT_BEFORE)
                    hi = min(len(lines), i + CONTEXT_AFTER + 1)
                    sites.append({
                        "file": relpath,
                        "line": i + 1,
                        "context": "\n".join(lines[lo:hi]),
                    })
        if not sites:
            no_sites.append(f"{item['name']} ({cached})")
        out[item["name"]] = {"def": cached, "id": item["id"],
                             "confidence": item.get("confidence"), "sites": sites}

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(f"{OUT_DIR}/item-code-sites.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False)

    with_sites = sum(1 for v in out.values() if v["sites"])
    total_sites = sum(len(v["sites"]) for v in out.values())
    print(f"{len(out)} items scanned across {len(sources)} source files")
    print(f"  {with_sites} have code sites ({total_sites} total)")
    print(f"  {len(no_sites)} have NO code site (effect may live in a prefab/behaviour "
          f"component rather than a direct item-count read)")
    if no_def:
        print(f"  {len(no_def)} could not be matched to an ItemDef: {no_def[:8]}")
    print(f"-> {OUT_DIR}/item-code-sites.json")


if __name__ == "__main__":
    main()
