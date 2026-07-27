"""Extract EVERY item constant out of CharacterBody.RecalculateStats in one pass.

PLAN §6B.1. Verifying one item at a time is unbounded and blind to systematic error.
Items are not independent — `RecalculateStats` is a single function containing the
stat contribution of dozens of items, so reading it *once* and extracting everything
verifies a whole block at a time, and makes anomalies visible in aggregate (which is
the only reason Stone Flux's double application was recognisable at all).

Three passes:

1. **Item → local.** `num51 = inventory.GetItemCountEffective(DLC1Content.Items.X)`.
   Locals are validated as single-item: the decompiler reuses slots, and a local that
   holds counts of two different items is dropped rather than mis-attributed.
2. **Local → coefficient → accumulator.** Every arithmetic line mentioning the local,
   capturing the numeric literal and the accumulator it feeds
   (`num80 += num46 * (1f * num79)`  →  item, `1f`, `num80`).
3. **Accumulator → stat.** Assignment chains are walked back from the final
   `maxHealth = num78` / `moveSpeed = num97` / … so each coefficient can be labelled
   with the stat it actually affects.

Output (git-ignored): .gamedata/recalculate-stats.json — evidence for review and for
diffing against items.json, NOT an automatic verdict.

Usage: python scripts/extract-recalculate-stats.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, ".decompiled/full/RoR2/CharacterBody.cs")
OUT_DIR = os.path.join(ROOT, ".gamedata")

COUNT_READ = re.compile(
    r"([A-Za-z_][A-Za-z0-9_]*)\s*=\s*inventory\.GetItemCountEffective\s*\(\s*"
    r"([A-Za-z0-9_]+)Content\.Items\.([A-Za-z0-9_]+)\s*\)")
# num80 += (float)num46 * (1f * num79);   /  num113 *= 0.75f;
ASSIGN = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|/=|=)\s*(.+?);\s*$")
LITERAL = re.compile(r"(?<![A-Za-z0-9_.])(\d+(?:\.\d+)?)f?(?![A-Za-z0-9_])")
# Final stat assignments, e.g. `maxHealth = num78;`
STAT_ASSIGN = re.compile(
    r"^\s*(maxHealth|maxShield|regen|moveSpeed|jumpPower|damage|attackSpeed|crit|"
    r"critMultiplier|armor|maxJumpCount)\s*=\s*([^;]+);")


def method_body(text: str) -> list[str]:
    start = text.index("public void RecalculateStats()")
    depth, out, started = 0, [], False
    for line in text[start:].splitlines():
        out.append(line)
        depth += line.count("{") - line.count("}")
        if "{" in line:
            started = True
        if started and depth <= 0:
            break
    return out


def main():
    if not os.path.exists(SRC):
        sys.exit(f"Missing {SRC} — run the full decompile first")
    lines = method_body(open(SRC, encoding="utf-8", errors="ignore").read())

    # --- pass 1: item -> local (single-item locals only) ---------------------
    local_items: dict[str, set[str]] = {}
    for ln in lines:
        for var, _ns, cached in COUNT_READ.findall(ln):
            local_items.setdefault(var, set()).add(cached)
    item_of = {v: next(iter(s)) for v, s in local_items.items() if len(s) == 1}
    ambiguous = sorted(v for v, s in local_items.items() if len(s) > 1)

    # --- pass 3 (built first): accumulator -> stat ---------------------------
    # Walk back from `maxHealth = num78` through `num78 = num80 * …` chains.
    direct: dict[str, str] = {}
    for ln in lines:
        m = STAT_ASSIGN.match(ln)
        if m:
            stat, rhs = m.group(1), m.group(2)
            for v in re.findall(r"\bnum\d+\b", rhs):
                direct.setdefault(v, stat)
    # Propagate BACKWARD only: from a known stat accumulator to the accumulators that
    # feed it. `maxHealth = num78` makes num78 the health accumulator; `num109 *= num110`
    # makes num110 an attack-speed one, since it is the multiplier applied to it.
    #
    # Three constraints, each from a false label on an earlier run:
    #   - never FORWARD (an RHS stat leaking to an unrelated LHS labelled num110, the
    #     attack-speed accumulator, as maxHealth);
    #   - only `=`, `*=`, `/=` — a `+=` RHS holds contributions, not accumulators;
    #   - never onto a known item-count local, which is a count and not a stat.
    CHAIN_OPS = {"=", "*=", "/="}
    for _ in range(8):
        for ln in lines:
            m = ASSIGN.match(ln)
            if not m:
                continue
            lhs, op, rhs = m.groups()
            if op not in CHAIN_OPS or lhs not in direct:
                continue
            for r in re.findall(r"\bnum\d+\b", rhs):
                if r in item_of:
                    continue
                direct.setdefault(r, direct[lhs])

    # --- pass 2: coefficients ------------------------------------------------
    findings: dict[str, list] = {}
    for i, ln in enumerate(lines):
        m = ASSIGN.match(ln)
        if not m:
            continue
        lhs, op, rhs = m.groups()
        for var, cached in item_of.items():
            if not re.search(rf"\b{re.escape(var)}\b", rhs):
                continue
            lits = [l for l in LITERAL.findall(rhs) if l not in ("0", "1")]
            findings.setdefault(cached, []).append({
                "local": var,
                "op": op,
                "accumulator": lhs,
                "stat": direct.get(lhs),
                "literals": lits,
                "line": i + 1,
                "code": ln.strip()[:150],
            })

    os.makedirs(OUT_DIR, exist_ok=True)
    out = {"items": findings, "ambiguousLocals": ambiguous,
           "accumulatorStats": direct}
    with open(f"{OUT_DIR}/recalculate-stats.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False, sort_keys=True)

    labelled = sum(1 for v in findings.values() for f in v if f["stat"])
    total = sum(len(v) for v in findings.values())
    print(f"RecalculateStats: {len(lines)} lines")
    print(f"  {len(item_of)} single-item locals ({len(ambiguous)} ambiguous, dropped)")
    print(f"  {len(findings)} items with a stat contribution, {total} sites "
          f"({labelled} labelled with a stat)")
    print(f"-> {OUT_DIR}/recalculate-stats.json")


if __name__ == "__main__":
    main()
