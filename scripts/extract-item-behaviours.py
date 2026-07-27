"""Extract constants from the per-item behaviour classes (PLAN §6B.1/§6B.5, path 3).

`RecalculateStats` covers stat items and `GlobalEventManager` covers proc items. The
third concentration is the ~60 `BaseItemBodyBehavior` / `CharacterBody.ItemBehavior`
subclasses, where an item's own logic lives — this is where Old War Stealthkit's
`rechargeReductionMultiplierPerStack`, Faulty Conductor's `durationStack` and Egocentrism's
`secondsPerProjectile` were each found individually. Doing all 60 at once is the point.

These classes are unusually easy to attribute, which is why this sweep is high-yield and
low-risk: each declares its own item explicitly via

    [ItemDefAssociation(...)]
    private static ItemDef GetItemDef() { return DLC3Content.Items.Whatever; }

so there is no local-reuse ambiguity to guard against — the class *is* the item. What is
extracted is the class's named constants (`private static readonly float x = 15f`,
`private const float y = 0.5f`), which is exactly where per-stack coefficients live, plus
any line applying `stack` arithmetic.

Output (git-ignored): .gamedata/item-behaviours.json — evidence for review.

Usage: python scripts/extract-item-behaviours.py
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL = os.path.join(ROOT, ".decompiled/full")
OUT_DIR = os.path.join(ROOT, ".gamedata")

ITEM_DEF = re.compile(r"return\s+[A-Za-z0-9_]*Content\.(?:Items|Equipment)\.([A-Za-z0-9_]+)\s*;")
CONSTANT = re.compile(
    r"(?:private|public|internal|protected)?\s*(?:static\s+)?(?:readonly\s+)?"
    r"(?:const\s+)?(?:float|int|uint|double)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"
    r"(-?\d+(?:\.\d+)?)f?\s*;")
# Lines where the item's own stack count drives arithmetic.
STACK_USE = re.compile(r"\bstack\b")


def main():
    if not os.path.isdir(FULL):
        sys.exit(f"Full decompile missing: {FULL}")

    out = {}
    for path in glob.glob(f"{FULL}/**/*.cs", recursive=True):
        if os.path.basename(path) == "RoR2.decompiled.cs":
            continue
        try:
            text = open(path, encoding="utf-8", errors="ignore").read()
        except Exception:
            continue
        if "ItemDefAssociation" not in text and "ItemBehavior" not in text:
            continue
        m = ITEM_DEF.search(text)
        if not m:
            continue
        cached = m.group(1)
        lines = text.splitlines()

        constants = {}
        for ln in lines:
            cm = CONSTANT.search(ln)
            if cm and "=" in ln:
                name, val = cm.group(1), cm.group(2)
                if name not in ("kRpc", "kCmd"):
                    constants[name] = float(val)

        stack_lines = [
            {"line": i + 1, "code": ln.strip()[:160]}
            for i, ln in enumerate(lines)
            if STACK_USE.search(ln) and re.search(r"[*/+\-]", ln) and "//" not in ln[:4]
        ]

        if constants or stack_lines:
            out[cached] = {
                "class": os.path.basename(path).replace(".cs", ""),
                "constants": constants,
                "stackUses": stack_lines[:8],
            }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(f"{OUT_DIR}/item-behaviours.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False, sort_keys=True)

    nconst = sum(len(v["constants"]) for v in out.values())
    print(f"{len(out)} item behaviour classes, {nconst} named constants")
    print(f"-> {OUT_DIR}/item-behaviours.json")


if __name__ == "__main__":
    main()
