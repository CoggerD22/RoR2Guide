"""Extract every item constant from the proc code paths in one pass (PLAN §6B.1/§6B.5).

`RecalculateStats` covers items that change a stat. The other dense concentration is
`GlobalEventManager`, where every on-hit and on-kill proc item lives:

  ProcessHitEnemy   ~820 lines — on-hit procs
  OnCharacterDeath  ~560 lines — on-kill procs
  OnHitAll                     — hit-anything procs

These have no stat accumulators to trace, so instead of labelling by stat this
classifies each site by the KIND of quantity it computes, which is what actually needs
checking against `items.json`:

  chance    LocalCheckRoll / CheckRoll / ConvertAmplificationPercentage…
  damage    damageCoefficient / OnHitProcDamage / baseDamage
  duration  AddTimedBuff / duration / seconds
  healing   Heal( / healFraction
  count     maxTargets / bounces / remaining / for-loop bounds
  other     everything else, for a human to read

Same discipline as the other extractors: locals holding counts of more than one item are
dropped rather than mis-attributed, and the output is EVIDENCE, not a verdict.

Output (git-ignored): .gamedata/proc-paths.json

Usage: python scripts/extract-proc-paths.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, ".decompiled/full/RoR2/GlobalEventManager.cs")
OUT_DIR = os.path.join(ROOT, ".gamedata")

METHODS = ["ProcessHitEnemy", "OnCharacterDeath", "OnHitAll", "ProcIgniteOnKill"]

COUNT_READ = re.compile(
    r"([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[^;]*?GetItemCount(?:Effective)?\s*\(\s*"
    r"([A-Za-z0-9_]+)Content\.(?:Items|Equipment)\.([A-Za-z0-9_]+)\s*\)")
LITERAL = re.compile(r"(?<![A-Za-z0-9_.])(\d+(?:\.\d+)?)f?(?![A-Za-z0-9_])")

KINDS = [
    ("chance", re.compile(r"CheckRoll|ConvertAmplificationPercentage|chance", re.I)),
    ("damage", re.compile(r"damageCoefficient|OnHitProcDamage|baseDamage|damageValue", re.I)),
    ("duration", re.compile(r"AddTimedBuff|duration|Seconds", re.I)),
    ("healing", re.compile(r"\bHeal\b|healFraction|RepeatHeal", re.I)),
    ("count", re.compile(r"maxTargets|bounces|remaining|totalTargets|maxHit", re.I)),
]


def method_body(text: str, name: str) -> list[tuple[int, str]]:
    """Lines of one method, as (1-based line number within the file, text)."""
    m = re.search(rf"^\s*(?:public|private|internal|protected).*\b{name}\s*\(", text, re.M)
    if not m:
        return []
    start_line = text[: m.start()].count("\n")
    depth, out, started = 0, [], False
    for i, line in enumerate(text.splitlines()[start_line:], start=start_line + 1):
        out.append((i, line))
        depth += line.count("{") - line.count("}")
        if "{" in line:
            started = True
        if started and depth <= 0:
            break
    return out


def classify(line: str) -> str:
    for kind, pat in KINDS:
        if pat.search(line):
            return kind
    return "other"


def main():
    if not os.path.exists(SRC):
        sys.exit(f"Missing {SRC} — run the full decompile first")
    text = open(SRC, encoding="utf-8", errors="ignore").read()

    findings: dict[str, list] = {}
    ambiguous: set[str] = set()
    scanned = {}

    for method in METHODS:
        body = method_body(text, method)
        if not body:
            continue
        scanned[method] = len(body)

        local_items: dict[str, set[str]] = {}
        for _, ln in body:
            for var, _ns, cached in COUNT_READ.findall(ln):
                local_items.setdefault(var, set()).add(cached)
        for v, s in local_items.items():
            if len(s) > 1:
                ambiguous.add(v)
        item_of = {v: next(iter(s)) for v, s in local_items.items() if len(s) == 1}

        for lineno, ln in body:
            lits = [l for l in LITERAL.findall(ln) if l not in ("0", "1")]
            if not lits:
                continue
            for var, cached in item_of.items():
                if not re.search(rf"\b{re.escape(var)}\b", ln):
                    continue
                findings.setdefault(cached, []).append({
                    "method": method,
                    "kind": classify(ln),
                    "literals": lits,
                    "line": lineno,
                    "code": ln.strip()[:160],
                })

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(f"{OUT_DIR}/proc-paths.json", "w", encoding="utf-8") as fh:
        json.dump({"items": findings, "ambiguousLocals": sorted(ambiguous),
                   "methodsScanned": scanned}, fh, indent=1, ensure_ascii=False,
                  sort_keys=True)

    sites = sum(len(v) for v in findings.values())
    print(f"scanned: " + ", ".join(f"{k} ({v} lines)" for k, v in scanned.items()))
    print(f"  {len(findings)} items with a proc constant, {sites} sites "
          f"({len(ambiguous)} ambiguous locals dropped)")
    print(f"-> {OUT_DIR}/proc-paths.json")


if __name__ == "__main__":
    main()
