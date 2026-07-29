"""Locate the code implementing each artifact, so effects can be code-verified (PLAN §5.0.1).

The Reference page's artifact `effect` text is the game's own `ARTIFACT_*_DESCRIPTION`
token, quoted verbatim. That is a fine source for *wording* and an invalid one for a
*mechanic* — the same distinction that made Tougher Times read "15% per stack" while
blocking 13%. `provenance.ts` has flagged this field `adequate: false` since it was
written; this extractor is what closes it.

Artifacts have no per-item behaviour class. They are checked inline wherever they matter:

    RunArtifactManager.instance.IsArtifactEnabled(RoR2Content.Artifacts.glassArtifactDef)

so the reference sites for `Artifacts.<name>ArtifactDef` are exactly where the mechanic
lives. Note the accessor casing differs from the def name (`WeakAssKnees` ->
`weakAssKneesArtifactDef`), which is why matching is done on both forms.

Output (git-ignored): .gamedata/artifact-code.json — evidence for review, never a verdict.

Usage: python scripts/extract-artifact-code.py
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL = os.path.join(ROOT, ".decompiled/full")
OUT_DIR = os.path.join(ROOT, ".gamedata")
SKIP = ("RoR2.decompiled.cs",)
CONTEXT_BEFORE, CONTEXT_AFTER = 2, 14


def main():
    if not os.path.isdir(FULL):
        sys.exit(f"Full decompile missing: {FULL}")

    # Artifact def names, from whichever Content class declares them.
    names = set()
    for p in glob.glob(f"{FULL}/RoR2/*Content.cs"):
        text = open(p, encoding="utf-8", errors="ignore").read()
        names.update(re.findall(r"public static ArtifactDef ([A-Za-z0-9_]+);", text))
    if not names:
        sys.exit("no ArtifactDefs found")

    sources = []
    for path in glob.glob(f"{FULL}/**/*.cs", recursive=True):
        if os.path.basename(path) in SKIP or path.endswith("Content.cs"):
            continue
        try:
            sources.append((os.path.relpath(path, FULL).replace("\\", "/"),
                            open(path, encoding="utf-8", errors="ignore").read().splitlines()))
        except Exception:
            pass

    out = {}
    for n in sorted(names):
        lower = n[0].lower() + n[1:]
        pat = re.compile(rf"Artifacts\.(?:{re.escape(n)}|{re.escape(lower)}ArtifactDef)\b")
        sites = []
        for relpath, lines in sources:
            for i, line in enumerate(lines):
                if not pat.search(line):
                    continue
                lo = max(0, i - CONTEXT_BEFORE)
                hi = min(len(lines), i + CONTEXT_AFTER + 1)
                sites.append({"file": relpath, "line": i + 1,
                              "context": "\n".join(lines[lo:hi])})
        out[n] = {"sites": sites}

    os.makedirs(OUT_DIR, exist_ok=True)
    path = f"{OUT_DIR}/artifact-code.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False)
    total = sum(len(v["sites"]) for v in out.values())
    print(f"{len(out)} artifacts, {total} code sites")
    for n in sorted(out):
        print(f"  {n:26s} {len(out[n]['sites'])}")
    print(f"-> {path}")


if __name__ == "__main__":
    main()
