"""Triage the 153 `linear` stacking entries by looking for their coefficient in code.

PLAN §6A.4 sequences by blast radius: non-linear curves first (done), then the large
block of entries marked `linear`. Those are *assumptions* — "the description says
+X (+X per stack)" — not findings. Reading all 153 by hand is slow and error-prone, so
this narrows the field:

For each linear entry it takes the recorded `base`/`perStack`, derives the literals the
code would plausibly use (`15` for a flat +15, `0.15f` for a +15% multiplier, and the
0-1 fraction), then searches the item's implementation for that literal applied to the
item's own count. A hit is strong evidence the entry is linear with that coefficient; a
miss means "read this one yourself".

It does the SECOND HOP that a naive scan misses: it records the local the item count is
stored into, then looks for `local * literal` / `literal * local` within a method-sized
window — the pattern that hid Alien Head's 0.75 and Corpsebloom's 0.1.

It reports CANDIDATES, never conclusions. A regex that decided an item was verified
would be the plausible-but-unchecked answer this programme exists to remove.

Output (git-ignored): .gamedata/linear-coefficient-triage.json

Usage: python scripts/scan-linear-coefficients.py
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL = os.path.join(ROOT, ".decompiled/full")
OUT_DIR = os.path.join(ROOT, ".gamedata")
SKIP_FILES = ("RoR2.decompiled.cs",)
WINDOW = 140

COUNT_READ = re.compile(
    r"(?:(?:int|uint|float|var)\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*[^;]*?"
    r"GetItemCount(?:Effective)?\s*\(\s*[A-Za-z0-9_]*Content\.(?:Items|Equipment)\.([A-Za-z0-9_]+)"
)


def literals_for(value: float):
    """Plausible C# spellings of a recorded per-stack value."""
    out = set()
    if value == int(value):
        out.add(f"{int(value)}f")
        out.add(str(int(value)))
    out.add(f"{value}f")
    frac = value / 100.0
    # 15 -> 0.15f ; 7.5 -> 0.075f
    s = repr(round(frac, 6)).rstrip("0").rstrip(".")
    out.add(f"{s}f")
    return {x for x in out if x not in ("0f", "0", "0.0f")}


def main():
    if not os.path.isdir(FULL):
        sys.exit(f"Full decompile missing: {FULL}")

    defs = json.load(open(os.path.join(OUT_DIR, "itemdefs.json"), encoding="utf-8"))
    name_to_def = {}
    for kind in ("items", "equipment"):
        for d in defs.get(kind, []):
            if d.get("name") and d.get("cachedName") and d["name"] != "?":
                name_to_def[(kind, d["name"])] = d["cachedName"]

    items = json.load(open(os.path.join(ROOT, "src/data/items.json"), encoding="utf-8"))

    sources = []
    for path in glob.glob(f"{FULL}/**/*.cs", recursive=True):
        if os.path.basename(path) in SKIP_FILES:
            continue
        try:
            sources.append((os.path.relpath(path, FULL).replace("\\", "/"),
                            open(path, encoding="utf-8", errors="ignore").read().splitlines()))
        except Exception:
            pass

    report = {}
    for item in items:
        if item.get("confidence") == "code":
            continue
        linear = [s for s in item["stacking"] if s["type"] == "linear"]
        if not linear:
            continue
        kind = "equipment" if item["tier"] in ("equipment", "lunar-equipment") else "items"
        cached = name_to_def.get((kind, item["name"])) or name_to_def.get(
            ("items" if kind == "equipment" else "equipment", item["name"]))
        if not cached:
            continue

        wanted = {}
        for entry in linear:
            for v in {entry["perStack"], entry["base"]}:
                if v:
                    for lit in literals_for(abs(v)):
                        wanted.setdefault(lit, set()).add(entry["stat"])

        hits = []
        pat_def = re.compile(rf"\b(?:Items|Equipment)\.{re.escape(cached)}\b")
        for relpath, lines in sources:
            local_names = set()
            for i, ln in enumerate(lines):
                for var, c in COUNT_READ.findall(ln):
                    if c == cached:
                        local_names.add(var.split(".")[-1])
            direct = [i for i, ln in enumerate(lines) if pat_def.search(ln)]
            if not direct and not local_names:
                continue
            for start in direct:
                for i in range(start, min(len(lines), start + WINDOW)):
                    ln = lines[i]
                    refs_local = any(re.search(rf"\b{re.escape(v)}\b", ln) for v in local_names)
                    if not (pat_def.search(ln) or refs_local):
                        continue
                    for lit, stats in wanted.items():
                        if lit in ln and re.search(r"[*/+\-]", ln):
                            hits.append({"file": relpath, "line": i + 1, "literal": lit,
                                         "stats": sorted(stats), "code": ln.strip()[:150]})
        seen, uniq = set(), []
        for h in hits:
            k = (h["file"], h["line"], h["literal"])
            if k not in seen:
                seen.add(k)
                uniq.append(h)
        report[item["name"]] = {"id": item["id"], "def": cached,
                                "expected": sorted(wanted), "hits": uniq[:6]}

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(f"{OUT_DIR}/linear-coefficient-triage.json", "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=1, ensure_ascii=False, sort_keys=True)

    withhits = [k for k, v in report.items() if v["hits"]]
    print(f"{len(report)} unverified linear items triaged")
    print(f"  {len(withhits)} have a coefficient match in code (strong candidates to confirm)")
    print(f"  {len(report) - len(withhits)} need manual reading")
    print(f"-> {OUT_DIR}/linear-coefficient-triage.json")


if __name__ == "__main__":
    main()
