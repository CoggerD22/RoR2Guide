"""Verify that /public/icons/<id>.png actually depicts the right item.

`data:audit` checks that all 217 icon FILES exist. It cannot check that each one shows the
item it is named after — a swapped pair passes every existing check, renders without error,
and is wrong on the page for as long as nobody looks (MATH-VERIFICATION §3j.128 left this
explicitly unchecked rather than assert it from the filenames).

Method, and why it is a rank test rather than a threshold:

  A pixel comparison is useless — our PNGs are rescaled and recompressed, so they never match
  the game texture byte for byte. Picking a "close enough" difference threshold would just be
  a guess dressed as a measurement.

  So instead: perceptual-hash every game icon and every one of ours, then for each item ask
  whether OUR icon's nearest neighbour among all game icons is that item's own. A swap shows
  up immediately and unambiguously — icon A's nearest match is item B — and no threshold has
  to be invented. The distance is reported alongside so a near-tie is visible rather than
  hidden behind a pass.

Output: a report only. This script asserts nothing about files it cannot resolve; it prints
the denominator (§3j.126) so "0 mismatches" can never be confused with "0 compared".

Usage: python scripts/verify-icons.py
"""
import glob
import json
import os
import re
import sys

import UnityPy
from PIL import Image

DEFAULT_GAME = "E:/SteamLibrary/steamapps/common/Risk of Rain 2/Risk of Rain 2_Data"
GAME = os.environ.get("ROR2_DATA_DIR", DEFAULT_GAME)
AA = f"{GAME}/StreamingAssets/aa/StandaloneWindows64"
LANG = f"{GAME}/StreamingAssets/Language/en"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, "public", "icons")

HASH_W, HASH_H = 16, 16


def dhash(img: Image.Image) -> int:
    """Difference hash over an alpha-TRIMMED, composited greyscale thumbnail.

    Trimming to the alpha bounding box first is the part that makes this comparison mean
    anything, and the first version of this script omitted it — producing 40+ false
    "mismatches" that were an artifact of framing, not of content.

    The game's sprites are tightly cropped and NOT square: Alien Head is 115x125, Crowbar
    127x124, Exposed Cerebellum 127x92. Our PNGs are 256x256 (some 128x128) with the art
    padded inside. Hashing those directly compares a tight crop against a padded canvas, so
    even a perfectly correct icon scored a near-random distance. Cropping both to their art
    and then resizing to a common grid removes the difference that is not about the picture.
    """
    img = img.convert("RGBA")
    box = img.split()[3].getbbox()
    if box:
        img = img.crop(box)
    bg = Image.new("RGBA", img.size, (0, 0, 0, 255))
    flat = Image.alpha_composite(bg, img)

    # Hash EACH COLOUR CHANNEL, not a greyscale flattening.
    #
    # Item Scrap comes in White, Green, Red and Yellow: four icons with the SAME shape that
    # differ only in hue. A greyscale hash throws away the one signal that separates them, so
    # every scrap icon reported a different scrap as its best match — a false positive that
    # says nothing about the data. Their mean colours are distinct and correct
    # (green has the highest G-R, red the highest R-G), so the fix is to stop discarding it.
    bits = 0
    for channel in flat.convert("RGB").split():
        small = channel.resize((HASH_W + 1, HASH_H), Image.LANCZOS)
        px = small.load()
        for y in range(HASH_H):
            for x in range(HASH_W):
                bits = (bits << 1) | (1 if px[x, y] > px[x + 1, y] else 0)
    return bits


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def language_names() -> dict:
    """token -> English display name."""
    out = {}
    if not os.path.isdir(LANG):
        return out
    for fn in os.listdir(LANG):
        if not fn.endswith(".json"):
            continue
        raw = open(os.path.join(LANG, fn), encoding="utf-8-sig").read()
        try:
            strings = json.loads(raw).get("strings", {})
        except Exception:
            try:
                strings = json.loads(re.sub(r",(\s*[}\]])", r"\1", raw)).get("strings", {})
            except Exception:
                continue
        for k, v in strings.items():
            if isinstance(v, str):
                out[k] = v
    return out


def main():
    if not os.path.isdir(AA):
        sys.exit(f"Addressables not found: {AA}")

    names = language_names()
    items = json.load(open(os.path.join(ROOT, "src", "data", "items.json"), encoding="utf-8"))
    by_name = {i["name"]: i for i in items}

    # --- pass 1: every ItemDef/EquipmentDef and the sprite it points at -------------------
    # (token, m_FileID, m_PathID, source bundle, that file's externals)
    wanted = []
    cab_to_bundle = {}
    bundles = sorted(glob.glob(f"{AA}/*.bundle"))
    for f in bundles:
        try:
            env = UnityPy.load(f)
            objs = list(env.objects)
        except Exception:
            continue
        for o in objs:
            try:
                cab_to_bundle.setdefault(str(o.assets_file.name).lower(), f)
            except Exception:
                pass
            if str(o.type.name) != "MonoBehaviour":
                continue
            try:
                t = o.read_typetree()
            except Exception:
                continue
            tok = t.get("nameToken")
            ptr = t.get("pickupIconSprite")
            if not tok or not isinstance(ptr, dict) or not ptr.get("m_PathID"):
                continue
            try:
                externals = [str(e.path) for e in o.assets_file.externals]
            except Exception:
                externals = []
            wanted.append((tok, ptr.get("m_FileID"), ptr["m_PathID"], f, externals))

    print(f"ItemDef/EquipmentDefs with an icon pointer: {len(wanted)}")

    # --- pass 2: resolve each pointer to an image ----------------------------------------
    game_hash = {}   # display name -> dhash
    unresolved = []
    for tok, fid, pid, src, externals in wanted:
        display = names.get(tok)
        if not display or display not in by_name:
            continue  # not an item we publish (cut content, artifacts, monster gear)
        target = src
        if fid:
            idx = fid - 1
            cab = os.path.basename(externals[idx]).lower() if 0 <= idx < len(externals) else None
            target = cab_to_bundle.get(cab) if cab else None
        img = None
        if target:
            try:
                for o in UnityPy.load(target).objects:
                    if o.path_id != pid:
                        continue
                    data = o.read()
                    img = getattr(data, "image", None)
                    break
            except Exception:
                img = None
        if img is None:
            unresolved.append(display)
            continue
        game_hash[display] = dhash(img)

    print(f"game icons resolved to an image: {len(game_hash)}")
    if unresolved:
        print(f"  (could not resolve {len(unresolved)}: {', '.join(sorted(unresolved)[:6])}…)")

    # --- pass 3: our icons ----------------------------------------------------------------
    ours = {}
    missing_file = []
    for name, it in by_name.items():
        path = os.path.join(ICON_DIR, os.path.basename(it["icon"]))
        if not os.path.isfile(path):
            missing_file.append(name)
            continue
        try:
            ours[name] = dhash(Image.open(path))
        except Exception as e:
            missing_file.append(f"{name} ({e})")

    # --- the rank test --------------------------------------------------------------------
    comparable = sorted(set(ours) & set(game_hash))
    print(f"\nCOMPARED: {len(comparable)} of {len(by_name)} items\n")

    mismatches, near = [], []
    for name in comparable:
        d_self = hamming(ours[name], game_hash[name])
        best, best_d = name, d_self
        for other, h in game_hash.items():
            d = hamming(ours[name], h)
            if d < best_d:
                best, best_d = other, d
        if best != name:
            mismatches.append(f"{name}: our icon matches {best!r} better (d={best_d} vs own d={d_self})")
        else:
            runner = min(
                ((hamming(ours[name], h), o) for o, h in game_hash.items() if o != name),
                default=(999, None),
            )
            if runner[0] <= d_self:
                near.append(f"{name}: ties with {runner[1]!r} (both d={d_self})")

    print(f"MISMATCHED icons: {len(mismatches)}")
    for m in mismatches:
        print("   !", m)
    print(f"\nambiguous (a different item is as close): {len(near)}")
    for n in near[:10]:
        print("   ?", n)
    if missing_file:
        print(f"\nno icon file: {len(missing_file)} — {', '.join(missing_file[:5])}")

    return 1 if mismatches else 0


if __name__ == "__main__":
    sys.exit(main())
