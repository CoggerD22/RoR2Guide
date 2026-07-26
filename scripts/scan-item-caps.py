"""Find HARD CAPS on item stacking — where extra copies do literally nothing.

A cap is the single most actionable fact a stacking table can carry (PLAN §5.8b): past
it, every further copy of the item is wasted. Only 5 of 212 items record one, which is
certainly an undercount.

The naive scan — look near each `GetItemCountEffective(...)` reference — misses most of
them, because the count is usually read into a local or an `ItemCounts` field and the
clamp happens much later. That is how Longstanding Solitude's `i < 3` cap went unnoticed
until it was traced by hand.

So this does the SECOND HOP: for each item-count read it records the variable the count
lands in, then searches the whole file for that variable appearing in a capping
construct:

    Math.Min(count, N) / Mathf.Min(...)      explicit clamp
    Mathf.Clamp(count, ...)                  explicit clamp
    for (int i = 0; i < count && i < N; ...) bounded grant loop
    count > N ? N : count                    manual clamp

Output is CANDIDATES for a human read, not conclusions. A regex that decided what a cap
means would be exactly the plausible-but-unchecked answer this programme exists to
remove (§6A.4).

Output (git-ignored): .gamedata/item-cap-candidates.json

Usage: python scripts/scan-item-caps.py
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

# `int num56 = inventory.GetItemCountEffective(DLC3Content.Items.TransferDebuffOnHit);`
# `repeatHeal = src.GetItemCountEffective(RoR2Content.Items.RepeatHeal);`
COUNT_READ = re.compile(
    r"(?:(?:int|uint|float|var)\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*[^;]*?"
    r"GetItemCount(?:Effective)?\s*\(\s*[A-Za-z0-9_]*Content\.Items\.([A-Za-z0-9_]+)"
)

# Capping constructs, checked against the variable the count landed in.
CAP_PATTERNS = [
    ("min", re.compile(r"Math(?:f)?\.Min\s*\(")),
    ("clamp", re.compile(r"Math(?:f)?\.Clamp\s*\(")),
    ("loop-bound", re.compile(r"for\s*\([^)]*<\s*\d+")),
    ("ternary-clamp", re.compile(r"\?\s*\d+\s*:")),
    ("maxStacks", re.compile(r"maxStacks|maxPurchaseCount|maxCount")),
]


def main():
    if not os.path.isdir(FULL):
        sys.exit(f"Full decompile missing: {FULL}")

    defs_path = os.path.join(OUT_DIR, "itemdefs.json")
    defs = json.load(open(defs_path, encoding="utf-8"))
    def_to_name = {}
    for kind in ("items", "equipment"):
        for d in defs.get(kind, []):
            if d.get("cachedName") and d.get("name") and d["name"] != "?":
                def_to_name.setdefault(d["cachedName"], d["name"])

    candidates = {}
    for path in glob.glob(f"{FULL}/**/*.cs", recursive=True):
        if os.path.basename(path) in SKIP_FILES:
            continue
        try:
            lines = open(path, encoding="utf-8", errors="ignore").read().splitlines()
        except Exception:
            continue
        rel = os.path.relpath(path, FULL).replace("\\", "/")

        # variable -> {def name} and the line it was assigned on.
        #
        # Precision matters more than recall here: a false "this item is capped" is a
        # wrong claim shipped to players, while a miss just leaves a known gap. Two
        # filters, both learned from the first noisy run:
        #   1. Decompiled code reuses generic names (`num`, `itemCountEffective`,
        #      `result`) for DIFFERENT items in the same file. A variable that holds
        #      counts of more than one item is ambiguous — drop it rather than
        #      attribute a shared line to every candidate.
        #   2. Only look FORWARD from the assignment and within a method-ish window;
        #      a later reuse of the same name is a different variable.
        var_defs = {}
        var_lines = {}
        for i, ln in enumerate(lines):
            for var, cached in COUNT_READ.findall(ln):
                v = var.split(".")[-1]
                var_defs.setdefault(v, set()).add(cached)
                var_lines.setdefault(v, []).append(i)

        WINDOW = 120
        for var, cacheds in var_defs.items():
            if len(cacheds) != 1:
                continue  # ambiguous — same name used for multiple items in this file
            cached = next(iter(cacheds))
            name = def_to_name.get(cached)
            if not name:
                continue
            word = re.compile(rf"\b{re.escape(var)}\b")
            for start in var_lines[var]:
                for i in range(start, min(len(lines), start + WINDOW)):
                    ln = lines[i]
                    if not word.search(ln):
                        continue
                    for label, pat in CAP_PATTERNS:
                        if pat.search(ln):
                            candidates.setdefault(name, []).append({
                                "def": cached, "var": var, "kind": label,
                                "file": rel, "line": i + 1, "code": ln.strip()[:160],
                            })
                            break

    # De-duplicate identical code lines per item.
    for name, hits in candidates.items():
        seen, unique = set(), []
        for h in hits:
            key = (h["file"], h["line"])
            if key not in seen:
                seen.add(key)
                unique.append(h)
        candidates[name] = unique

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(f"{OUT_DIR}/item-cap-candidates.json", "w", encoding="utf-8") as fh:
        json.dump(candidates, fh, indent=1, ensure_ascii=False, sort_keys=True)

    total = sum(len(v) for v in candidates.values())
    print(f"{len(candidates)} items with cap-shaped code ({total} sites) "
          f"-> {OUT_DIR}/item-cap-candidates.json")


if __name__ == "__main__":
    main()
