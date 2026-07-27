"""Trace each item's count from where it is READ to where it is USED (PLAN §6B.6).

`extract-item-code.py` reports the line that reads an item's count, plus a few lines of
context. That anchor is wrong. RoR2 reads every item count in one block near the top of
`RecalculateStats` / `TakeDamage` and consumes it hundreds of lines later, so a context
window around the read site systematically misses the constant:

    Backup Magazine        count read CharacterBody.cs:4128   used :4775   (647 lines)
    Cautious Slug          count read CharacterBody.cs:4112   used :4328   (216 lines)
    Repulsion Armor Plate  count read HealthComponent.cs:257  used :1390  (1133 lines)

All three were sitting in the "code site but no numeric literal" bucket, and all three
are fully verifiable (MATH-VERIFICATION §3j.15).

So this does a **def-use trace** instead: from the local that receives the count, follow
it forward to every line where it participates in arithmetic, then follow aliases of
that local one hop at a time. Two design points earned the hard way:

  - **Scope matters.** Decompiled locals are named `num5`, `num21`, … and reused across
    methods. §3j.7 already produced a wrong answer by propagating across a method
    boundary. Scope here is the *enclosing brace block* of the declaration, computed by
    depth, so a trace can never leak into an unrelated method.

  - **Do not require a numeric literal.** Backup Magazine's entire effect is
    `SetBonusStockFromBody(n + extraSecondaryFromSkill)` — +1 per stack expressed purely
    as variable arithmetic. Any tool that filters for numbers scores it unverifiable
    forever. Arithmetic *participation* is the signal, not the presence of a constant.

The enclosing operation is emitted too, not just the line: Repulsion Armor Plate's `5f`
means little without knowing it is subtracted *after* the armor multiplier. Position in
the pipeline is itself a fact.

As with every extractor here, this reports EVIDENCE, not a verdict — it never infers a
curve. A human reads the traced lines and classifies (§6A.2).

Output (git-ignored): .gamedata/item-defuse.json

Usage: python scripts/extract-item-defuse.py [itemName ...]
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
SKIP_DIRS = ("RoR2.Achievements",)

# `int num21 = inventory.GetItemCountEffective(RoR2Content.Items.X);`  -> local  num21
# `armorPlate = src.GetItemCountEffective(RoR2Content.Items.X);`       -> field  armorPlate
DECL = re.compile(r"^\s*(?:(?:private|public|internal|readonly|static)\s+)*"
                  r"(?:int|uint|float|double|var)\s+([A-Za-z_]\w*)\s*=")
ASSIGN = re.compile(r"^\s*(?:this\.)?([A-Za-z_][\w.]*)\s*=[^=]")

ARITH = re.compile(r"[*/+\-]|\bMathf\.|\bUtil\.|\bMath\.")
# Aliases: `float numX = <expr with traced var>;` — follow the new name too.
MAX_HOPS = 3
MAX_USES = 24


def brace_depths(lines):
    """Depth at the START of each line, ignoring braces inside strings/char literals."""
    depths = []
    d = 0
    for ln in lines:
        depths.append(d)
        stripped = re.sub(r'"(?:\\.|[^"\\])*"', '""', ln)
        stripped = re.sub(r"'(?:\\.|[^'\\])*'", "''", stripped)
        stripped = re.sub(r"//.*$", "", stripped)
        d += stripped.count("{") - stripped.count("}")
    return depths


def block_scope(depths, i):
    """The enclosing brace block of line i — a local declared here cannot outlive it."""
    d = depths[i]
    lo = i
    while lo > 0 and depths[lo - 1] >= d:
        lo -= 1
    hi = i
    n = len(depths)
    while hi + 1 < n and depths[hi + 1] >= d:
        hi += 1
    return lo, hi


def find_declaration(lines, depths, use_line, name):
    """Locate where `name` was declared, scanning back from where it is assigned.

    This is the case that broke the first version. In `RecalculateStats` every count is
    declared once at the top (`int num21 = 0;`) and assigned much later inside
    `if (inventory) { … }`. Scoping to the *assignment's* block stops the trace at the
    end of that if-block — before the value is ever used. The declaration's block is the
    real lifetime, so it is what the walk must be bounded by.

    Returns (declaration_index, is_field) or (None, False).
    """
    pat = re.compile(rf"^\s*(?:(?:private|public|internal|protected|readonly|static)\s+)*"
                     rf"(?:int|uint|float|double|var)\s+{re.escape(name)}\b")
    for i in range(use_line, -1, -1):
        if pat.match(lines[i]):
            is_field = bool(re.match(r"^\s*(?:private|public|internal|protected)\b", lines[i]))
            return i, is_field
    return None, False


def trace_local(lines, depths, start, name, scope_from=None):
    """Forward def-use walk for `name`, bounded by the block it was DECLARED in."""
    lo, hi = block_scope(depths, scope_from if scope_from is not None else start)
    tracked = {name: 0}          # identifier -> hop count
    uses = []
    read_depth = depths[start]
    for i in range(start + 1, hi + 1):
        line = lines[i]
        # Stop at the end of the read's own switch case. Lysate Cell exposed this: its
        # count is read into `result` inside `case DeployableSlot.EngiTurret:`, and
        # `result` is reassigned in a dozen *unrelated* cases below. Brace depth does not
        # separate them, so without this the trace reports another item's code as if it
        # were this one's — a false verification, the worst possible failure here.
        if re.match(rf"^\s*(?:break;|case\s|default:|goto\s)", line) and depths[i] <= read_depth:
            break
        hit = next((v for v in tracked if re.search(rf"\b{re.escape(v)}\b", line)), None)
        if hit is None:
            continue
        if not ARITH.search(line) and "(" not in line:
            continue
        # `if (n > 0)` only marks the block the effect lives in; it carries no curve.
        # Keeping it (it locates the code) but flagging it, so review time goes to the
        # lines that actually compute something.
        guard = bool(re.match(rf"^\s*(?:\}}\s*)?(?:else\s+)?if\s*\(\s*{re.escape(hit)}\s*[<>!=]", line))
        uses.append({
            "line": i + 1,
            "code": line.strip()[:200],
            "via": hit if hit != name else None,
            "distance": i - start,
            "guard": guard,
        })
        # Follow an alias one hop further: `float numX = <expr with hit>;`
        m = DECL.match(line) or ASSIGN.match(line)
        if m and tracked[hit] < MAX_HOPS:
            tracked.setdefault(m.group(1), tracked[hit] + 1)
        if len(uses) >= MAX_USES:
            break
    return uses, (lo + 1, hi + 1)


def trace_field(sources, field):
    """Struct-field counts (`itemCounts.armorPlate`) are qualified, so scope-free."""
    uses = []
    pat = re.compile(rf"\.{re.escape(field)}\b")
    for relpath, lines, _ in sources:
        for i, line in enumerate(lines):
            if pat.search(line) and ARITH.search(line):
                uses.append({"file": relpath, "line": i + 1, "code": line.strip()[:200]})
                if len(uses) >= MAX_USES:
                    return uses
    return uses


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
    only = set(sys.argv[1:])
    if only:
        items = [i for i in items if i["name"] in only or i["id"] in only]

    sources = []
    for path in glob.glob(f"{FULL}/**/*.cs", recursive=True):
        if os.path.basename(path) in SKIP_FILES:
            continue
        if any(d in path.replace("\\", "/") for d in SKIP_DIRS):
            continue
        try:
            lines = open(path, encoding="utf-8", errors="ignore").read().splitlines()
        except Exception:
            continue
        sources.append((os.path.relpath(path, FULL).replace("\\", "/"), lines,
                        brace_depths(lines)))

    out = {}
    traced = 0
    for item in items:
        kind = "equipment" if item["tier"] in ("equipment", "lunar-equipment") else "items"
        cached = (name_to_def.get((kind, item["name"]))
                  or name_to_def.get(("items" if kind == "equipment" else "equipment",
                                      item["name"])))
        if not cached:
            continue
        pat = re.compile(rf"\b(?:Items|Equipment)\.{re.escape(cached)}\b")
        reads = []
        for relpath, lines, depths in sources:
            for i, line in enumerate(lines):
                if not pat.search(line):
                    continue
                m = DECL.match(line)
                if m:
                    uses, scope = trace_local(lines, depths, i, m.group(1))
                    reads.append({"file": relpath, "line": i + 1, "var": m.group(1),
                                  "kind": "local", "scope": scope, "uses": uses})
                    continue
                # A count read used INLINE, with no local to follow, e.g.
                #   return (int)(10f + (GetItemCountEffective(X) - 1) * 5f);
                # There is nothing to trace — the arithmetic is on this very line — but it
                # is still the answer. Chronic Expansion's stack cap lives exactly here and
                # had to be found by hand because the first version only recognised reads
                # that were assigned to something.
                if ARITH.search(line) and not DECL.match(line) and not ASSIGN.match(line):
                    reads.append({"file": relpath, "line": i + 1, "var": None,
                                  "kind": "inline",
                                  "uses": [{"line": i + 1, "code": line.strip()[:200],
                                            "via": None, "distance": 0, "guard": False}]})
                    continue

                a = ASSIGN.match(line)
                if a and "GetItemCount" in line:
                    name = a.group(1).split(".")[-1]
                    decl, is_field = find_declaration(lines, depths, i, name)
                    if decl is not None and not is_field:
                        uses, scope = trace_local(lines, depths, i, name, scope_from=decl)
                        reads.append({"file": relpath, "line": i + 1, "var": name,
                                      "kind": "local", "declaredAt": decl + 1,
                                      "scope": scope, "uses": uses})
                    else:
                        reads.append({"file": relpath, "line": i + 1, "var": name,
                                      "kind": "field", "uses": trace_field(sources, name)})
        if reads:
            traced += 1
            out[item["name"]] = {"def": cached, "id": item["id"],
                                 "confidence": item.get("confidence"), "reads": reads}

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(f"{OUT_DIR}/item-defuse.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False)

    nuses = sum(len(r["uses"]) for v in out.values() for r in v["reads"])
    far = sum(1 for v in out.values() for r in v["reads"]
              for u in r["uses"] if u.get("distance", 0) > 12)
    print(f"{traced} items traced, {nuses} use sites")
    print(f"  {far} use sites are >12 lines from the count read "
          f"(invisible to the old context window)")
    print(f"-> {OUT_DIR}/item-defuse.json")


if __name__ == "__main__":
    main()
