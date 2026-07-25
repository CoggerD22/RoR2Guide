"""Resolve each locked item's unlock CHALLENGE requirement from the game's own text.

items.json already records the challenge *display name* for challenge-locked items
(the `unlock` field, e.g. "Experimenting"). The player-facing "how do I unlock this?"
requirement is the matching achievement DESCRIPTION in the game's language files:

  ACHIEVEMENT_<X>_NAME         -> the challenge name we already store
  ACHIEVEMENT_<X>_DESCRIPTION  -> the one-line requirement (verbatim in-game text)

So we join by exact display name: name -> description. This is source 2 (the game's
own `Language/en` JSON), the most authoritative "how to unlock" text there is.

We NEVER guess: a name with zero or multiple matches, or a match with no description,
is emitted with requirement=null and a status, for manual review — not filled in.

Output (git-ignored, .gamedata/challenges.json):
  { "<itemId>": { "challenge": str, "requirement": str|null, "token": str|null,
                  "status": "ok"|"nomatch"|"ambiguous"|"nodesc" } }

Usage: python scripts/extract-challenges.py [path-to-"Risk of Rain 2_Data"]
"""
import glob
import json
import os
import re
import sys

DEFAULT_GAME = "E:/SteamLibrary/steamapps/common/Risk of Rain 2/Risk of Rain 2_Data"
GAME = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("ROR2_DATA_DIR", DEFAULT_GAME)
LANG = f"{GAME}/StreamingAssets/Language/en"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, ".gamedata")


def load_tokens():
    strings = {}
    for lf in glob.glob(f"{LANG}/*.json"):
        try:
            raw = re.sub(r",\s*([}\]])", r"\1", open(lf, encoding="utf-8-sig").read())
            strings.update(json.loads(raw).get("strings", {}))
        except Exception:
            pass
    return strings


def unlock_name(item):
    """Read the challenge name whether unlock is a bare string or {challenge}."""
    u = item.get("unlock")
    if isinstance(u, str):
        return u
    if isinstance(u, dict):
        return u.get("challenge")
    return None


def main():
    strings = load_tokens()
    # displayName -> list of (base_token, description)
    by_name = {}
    for k, v in strings.items():
        m = re.match(r"^(ACHIEVEMENT_.*)_NAME$", k)
        if not m:
            continue
        base = m.group(1)
        desc = strings.get(f"{base}_DESCRIPTION") or strings.get(f"{base}_DESC")
        by_name.setdefault(v, []).append((base, desc))

    items = json.load(open(os.path.join(ROOT, "src/data/items.json"), encoding="utf-8"))
    out = {}
    counts = {"ok": 0, "nomatch": 0, "ambiguous": 0, "nodesc": 0}
    for item in items:
        name = unlock_name(item)
        if not name:
            continue
        matches = by_name.get(name, [])
        if len(matches) == 0:
            rec = {"challenge": name, "requirement": None, "token": None, "status": "nomatch"}
        elif len(matches) > 1:
            rec = {"challenge": name, "requirement": None,
                   "token": [b for b, _ in matches], "status": "ambiguous"}
        else:
            base, desc = matches[0]
            if desc:
                rec = {"challenge": name, "requirement": desc, "token": base, "status": "ok"}
            else:
                rec = {"challenge": name, "requirement": None, "token": base, "status": "nodesc"}
        counts[rec["status"]] += 1
        out[item["id"]] = rec

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(f"{OUT_DIR}/challenges.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    total = sum(counts.values())
    print(f"{total} locked items -> {OUT_DIR}/challenges.json")
    print("  " + ", ".join(f"{k}={v}" for k, v in counts.items()))
    for iid, rec in out.items():
        if rec["status"] != "ok":
            print(f"  [{rec['status']}] {iid}: challenge={rec['challenge']!r} token={rec.get('token')}")


if __name__ == "__main__":
    main()
