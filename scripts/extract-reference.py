"""Re-derive the hand-entered reference blocks from the game's own text (PLAN §5.0).

`reference.ts` was transcribed from the wiki and carried no provenance. The game's
`Language/en` files define these records directly, so they can be *generated* instead
of paraphrased:

  ARTIFACT_<X>_NAME / _DESCRIPTION   -> artifact name + effect, verbatim
  BAZAAR_SEER_<STAGE>                -> the "You dream of…" line, and the STAGE is
                                        encoded in the token itself, so the
                                        dream -> stage mapping is game-authoritative
  MAP_<STAGE>_NAME                   -> that stage's display name

Text is transcribed verbatim, including the game's own typos — the site quotes the
game, it does not correct it. Style tags (<style=…>) are stripped since they're
markup, not content.

Output (git-ignored, .gamedata/reference.json):
  { "artifacts": [ {name, description, token} ],
    "dreams":    [ {stage, stageToken, dream, token} ] }

Usage: python scripts/extract-reference.py [path-to-"Risk of Rain 2_Data"]
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

# BAZAAR_SEER_* keys that are UI strings, not dreams.
NON_STAGE_SUFFIXES = {"CONTEXT", "DESCRIPTION", "LORE", "NAME"}


def load_tokens():
    strings = {}
    for lf in glob.glob(f"{LANG}/*.json"):
        try:
            raw = re.sub(r",\s*([}\]])", r"\1", open(lf, encoding="utf-8-sig").read())
            strings.update(json.loads(raw).get("strings", {}))
        except Exception:
            pass
    return strings


def strip_tags(s):
    """Remove Unity rich-text markup; keep the words exactly as written."""
    return re.sub(r"<[^>]+>", "", s).strip()


def resolve_stage_name(S, stage_token):
    """Map a BAZAAR_SEER_<STAGE> suffix to that stage's display title.

    Usually MAP_<STAGE>_TITLE exists outright. A few seer tokens don't match their
    map token exactly (DAMPCAVESIMPLE -> MAP_DAMPCAVE_TITLE, HELMINTH ->
    MAP_HELMINTHROOST_TITLE), so fall back to the longest MAP_* key where one stage
    name is a prefix of the other. Longest-prefix avoids matching a shorter unrelated
    stage; anything still unresolved is reported rather than guessed.
    """
    for suffix in ("_TITLE", "_NAME"):
        direct = S.get(f"MAP_{stage_token}{suffix}")
        if direct:
            return direct
    best = None
    for k, v in S.items():
        m = re.match(r"^MAP_([A-Z0-9]+)_(?:TITLE|NAME)$", k)
        if not m:
            continue
        cand = m.group(1)
        if stage_token.startswith(cand) or cand.startswith(stage_token):
            if best is None or len(cand) > len(best[0]):
                best = (cand, v)
    return best[1] if best else None


def load_scenes():
    """SceneDefs cached by extract-scenedefs.py; empty if it hasn't been run."""
    path = f"{OUT_DIR}/scenedefs.json"
    if not os.path.exists(path):
        print("  note: .gamedata/scenedefs.json missing — run extract-scenedefs.py "
              "for verified stage numbers")
        return {}
    return json.load(open(path, encoding="utf-8"))


def resolve_stage_order(scenes, stage_token):
    """Join a seer token to its SceneDef. The token IS the scene name in most cases
    (BAZAAR_SEER_BLACKBEACH -> blackbeach); a few need the same longest-prefix
    fallback as the display name (HELMINTH -> helminthroost)."""
    key = stage_token.lower()
    if key in scenes:
        return scenes[key]["order"]
    best = None
    for name, rec in scenes.items():
        if key.startswith(name) or name.startswith(key):
            if best is None or len(name) > len(best[0]):
                best = (name, rec["order"])
    return best[1] if best else None


def stage_number(order):
    """Display form of stageOrder. 1..6 are the normal progression; the game parks
    hidden realms / special scenes at >=93, which have no stage number."""
    if order is None:
        return None
    return str(order) if 1 <= order <= 6 else "—"


def main():
    S = load_tokens()
    scenes = load_scenes()

    # --- Artifacts -----------------------------------------------------------
    artifacts = []
    for k, v in S.items():
        m = re.match(r"^ARTIFACT_(.+)_NAME$", k)
        if not m or not v.startswith("Artifact of"):
            continue
        desc = S.get(f"ARTIFACT_{m.group(1)}_DESCRIPTION")
        if not desc:
            continue
        artifacts.append({
            "name": v,
            "description": strip_tags(desc),
            "token": f"ARTIFACT_{m.group(1)}",
        })
    artifacts.sort(key=lambda a: a["name"])

    # --- Bazaar seer dreams --------------------------------------------------
    dreams = []
    for k, v in S.items():
        if not k.startswith("BAZAAR_SEER_"):
            continue
        stage_token = k[len("BAZAAR_SEER_"):]
        if stage_token in NON_STAGE_SUFFIXES:
            continue
        text = strip_tags(v)
        if "You dream of" not in text:
            continue
        display = resolve_stage_name(S, stage_token)
        order = resolve_stage_order(scenes, stage_token)
        dreams.append({
            "stage": display,          # None when the map token is absent -> needs review
            "stageToken": stage_token,
            "stageOrder": order,       # None when no SceneDef matched -> needs review
            "stageNumber": stage_number(order),
            "dream": text,
            "token": k,
        })
    dreams.sort(key=lambda d: (d["stageOrder"] if d["stageOrder"] is not None else 999,
                               d["stage"] or "zzz"))

    # --- Loadout challenge requirements --------------------------------------
    # Achievement names for alternate skills are survivor-prefixed in game text
    # ("Artificer: Massacre", "CHEF: You've Always Been Crazy") while reference.ts
    # stores the bare challenge name. Match either form, case-insensitively, since
    # the prefix casing varies by survivor.
    ach = {}
    for k, v in S.items():
        m = re.match(r"^(ACHIEVEMENT_.*)_NAME$", k)
        if not m:
            continue
        desc = S.get(f"{m.group(1)}_DESCRIPTION") or S.get(f"{m.group(1)}_DESC")
        if v and desc:
            ach[v.strip().lower()] = desc

    challenges = {}
    ref_src = open(os.path.join(ROOT, "src/data/reference.ts"), encoding="utf-8").read()
    for surv, body in re.findall(r'survivor:\s*"([^"]+)",\s*skills:\s*\[(.*?)\]\s*,?\s*\}',
                                 ref_src, re.S):
        for skill, ch in re.findall(
                r'skill:\s*"([^"]+)",\s*slot:\s*"[^"]+",\s*challenge:\s*"([^"]+)"', body):
            for cand in (ch, f"{surv}: {ch}"):
                hit = ach.get(cand.strip().lower())
                if hit:
                    challenges[f"{surv}|{skill}"] = {"challenge": ch, "requirement": strip_tags(hit)}
                    break

    os.makedirs(OUT_DIR, exist_ok=True)
    out = {"artifacts": artifacts, "dreams": dreams, "challenges": challenges}
    with open(f"{OUT_DIR}/reference.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)

    unresolved = [d["stageToken"] for d in dreams if not d["stage"]]
    print(f"{len(artifacts)} artifacts, {len(dreams)} dreams, "
          f"{len(challenges)} skill challenges -> {OUT_DIR}/reference.json")
    if unresolved:
        print(f"  {len(unresolved)} dream(s) with no MAP_*_NAME token (need review): {unresolved}")


if __name__ == "__main__":
    main()
