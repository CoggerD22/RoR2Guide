"""Map each equipment to its handler and extract that handler's body (PLAN §6B.1).

The def-use tracer (§6B.6) covers items, because an item's effect is always gated on
`GetItemCountEffective`. Equipment has no stacks and so never appears in that read — which
is why 31 of the 61 items with "no code site at all" are equipment. They are not
unverifiable; they simply live behind a different dispatch:

    EquipmentSlot.cs
        if (equipmentDef == RoR2Content.Equipment.Meteor) { func = FireMeteor; }
        ...
        private bool FireMeteor() { ... }

So the mapping equipment -> handler is explicit and unambiguous, exactly like the
`[ItemDefAssociation]` attribute that made the behaviour-class sweep reliable. This reads
the dispatch table, then extracts each handler method's numeric literals and the lines
containing them.

Handlers frequently only *enter a state* (`new EntityStateMachine(...)`,
`SetNextState(new Meteor...)`), in which case the constants live in an
EntityStateConfiguration asset instead — see extract-state-fields.py. This script notes any
state type a handler references so the two can be joined.

Output (git-ignored): .gamedata/equipment-code.json — evidence for review, never a verdict.

Usage: python scripts/extract-equipment-code.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL = os.path.join(ROOT, ".decompiled/full")
OUT_DIR = os.path.join(ROOT, ".gamedata")
SLOT = os.path.join(FULL, "RoR2/EquipmentSlot.cs")

DISPATCH = re.compile(r"equipmentDef == [A-Za-z0-9_]*Content\.Equipment\.([A-Za-z0-9_]+)")
FUNC_ASSIGN = re.compile(r"func = ([A-Za-z0-9_]+)\s*;")
METHOD = re.compile(r"^\s*(?:private|public|internal|protected)[^;{]*\b([A-Za-z0-9_]+)\s*\([^)]*\)\s*$")
LITERAL = re.compile(r"(?<![A-Za-z0-9_.])(\d+(?:\.\d+)?)f?\b")
STATE_REF = re.compile(r"\b(?:EntityStates|new)\s*\.?\s*([A-Za-z0-9_.]*(?:State|Meteor|Blackhole))\b")


def brace_depths(lines):
    depths, d = [], 0
    for ln in lines:
        depths.append(d)
        s = re.sub(r'"(?:\\.|[^"\\])*"', '""', ln)
        s = re.sub(r"//.*$", "", s)
        d += s.count("{") - s.count("}")
    return depths


def method_body(lines, depths, name):
    """Return (start, end) line indices of the named method, or None."""
    for i, ln in enumerate(lines):
        m = METHOD.match(ln)
        if not m or m.group(1) != name:
            continue
        # Body opens on the next `{` at this depth.
        j = i
        while j < len(lines) and "{" not in lines[j]:
            j += 1
        if j >= len(lines):
            continue
        d = depths[j]
        k = j + 1
        while k < len(lines) and depths[k] > d:
            k += 1
        return i, k
    return None


def main():
    if not os.path.isfile(SLOT):
        sys.exit(f"Missing {SLOT}")
    lines = open(SLOT, encoding="utf-8", errors="ignore").read().splitlines()
    depths = brace_depths(lines)

    # Walk the dispatch chain: an `equipmentDef == X` line is followed within a few lines
    # by the `func = FireX;` it selects.
    mapping = {}
    pending = None
    for i, ln in enumerate(lines):
        d = DISPATCH.search(ln)
        if d:
            pending = d.group(1)
            continue
        f = FUNC_ASSIGN.search(ln)
        if f and pending:
            mapping.setdefault(pending, f.group(1))
            pending = None

    out = {}
    for equip, handler in sorted(mapping.items()):
        span = method_body(lines, depths, handler)
        entry = {"handler": handler}
        if span:
            lo, hi = span
            body = lines[lo:hi]
            entry["lines"] = [lo + 1, hi]
            entry["constants"] = sorted({
                float(m) for ln in body for m in LITERAL.findall(ln)
                if float(m) not in (0.0, 1.0)
            })
            entry["numericLines"] = [
                {"line": lo + 1 + k, "code": b.strip()[:180]}
                for k, b in enumerate(body)
                if LITERAL.search(b) and not re.match(r"^\s*//", b)
            ][:12]
            states = sorted({s for ln in body for s in STATE_REF.findall(ln) if "." in s})
            if states:
                entry["statesReferenced"] = states
        else:
            entry["note"] = "handler body not located"
        out[equip] = entry

    os.makedirs(OUT_DIR, exist_ok=True)
    path = f"{OUT_DIR}/equipment-code.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False, sort_keys=True)

    located = sum(1 for v in out.values() if "lines" in v)
    print(f"{len(out)} equipment dispatched, {located} handler bodies located")
    print(f"-> {path}")


if __name__ == "__main__":
    main()
