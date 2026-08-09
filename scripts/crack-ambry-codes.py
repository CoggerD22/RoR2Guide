"""Recover the Bulwark's Ambry artifact codes from the game itself (PLAN §6A.2).

The codes were the last thing on the site sourced only from the community wiki, and an
earlier note in `provenance.ts` claimed they "live in ArtifactFormulaDisplay prefabs" — which
was false (that prefab only maps compounds to decal materials). What actually ships is a
one-way hash, deliberately:

    PortalDialerController.PerformActionServer(byte[] sequence)
        Sha256Hash result = GetResult(sequence);            // SHA-256 of the sequence
        if (result.Equals(reference.hashAsset.value)) ...   // stored Sha256HashAsset

So the plaintext genuinely is not in the assets. But it does not need to be, because the
search space is tiny and fully determined by the game:

  * `sequenceServer = new byte[portalDialer.buttons.Length]`     -> the dialer prefab has 9
  * `sequenceServer[i] = (byte)buttons[i].currentDigitDef.value` -> ArtifactCompoundDef.value

and there are exactly five compounds: Circle 1, Triangle 3, Diamond 5, Square 7, Empty 11.
That is 5^9 = 1,953,125 candidates — a few seconds of hashing to recover every code exactly
as the game validates it. This is verification against the game's own data, not a transcription
of someone else's notes.

Each `DialedAction` also carries the `ArtifactDef` its UnityEvent opens, as a PPtr into the
bundle's externals, so codes attribute to artifacts without guessing.

Output (git-ignored): .gamedata/ambry-codes.json
  { "Artifact of Command": "\u25cf\u25a0\u25b2 ..." }

Usage: python scripts/crack-ambry-codes.py
"""
import glob
import hashlib
import itertools
import json
import os
import re
import struct
import sys

import UnityPy

DEFAULT_GAME = "E:/SteamLibrary/steamapps/common/Risk of Rain 2/Risk of Rain 2_Data"
GAME = os.environ.get("ROR2_DATA_DIR", DEFAULT_GAME)
AA = f"{GAME}/StreamingAssets/aa/StandaloneWindows64"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, ".gamedata")

# ArtifactCompoundDef.value -> the glyph the wiki/UI uses for that compound.
GLYPH = {1: "\u25cf", 3: "\u25b2", 5: "\u2666", 7: "\u25a0", 11: "\u00b7"}


def hash_bytes(v: dict) -> bytes:
    """Sha256Hash ships as four uint64 fields, in order, little-endian."""
    return b"".join(
        struct.pack("<Q", v[k] & 0xFFFFFFFFFFFFFFFF)
        for k in ("_00_07", "_08_15", "_16_23", "_24_31")
    )



def display_permutation(dialer):
    """Array index -> screen cell, read from the dialer prefab.

    The buttons are laid out on a plane at z = -4 / 0 / 4 (rows) and x = 5 / 1 / -3
    (columns, descending), and each button's GameObject is named "PortalDialerButton N" for
    its position N in reading order. Prefer that name; fall back to sorting by transform
    position if the naming ever changes.

    Returns a list of 9 array indices, in screen order, or None if it cannot be established —
    in which case the caller emits the raw array order rather than a guessed grid.
    """
    t, byid, _externals = dialer
    numbered = {}
    positions = {}
    for i, b in enumerate(t.get("buttons", [])):
        comp = byid.get(b.get("m_PathID"))
        if comp is None:
            continue
        try:
            bt = comp.read_typetree()
            go = byid.get(bt.get("m_GameObject", {}).get("m_PathID"))
            if go is None:
                continue
            gt = go.read_typetree()
            m = re.search(r"(\d+)\s*$", str(gt.get("m_Name", "")))
            if m:
                numbered[int(m.group(1))] = i
            for c in gt.get("m_Component", []):
                cid = (c.get("component") or c.get("m_Component") or {}).get("m_PathID")
                cobj = byid.get(cid)
                if cobj is not None and str(cobj.type.name) in ("Transform", "RectTransform"):
                    pos = cobj.read_typetree().get("m_LocalPosition", {})
                    positions[i] = (pos.get("z", 0.0), -pos.get("x", 0.0))
                    break
        except Exception:
            continue

    if len(numbered) == len(t.get("buttons", [])):
        return [numbered[n] for n in sorted(numbered)]
    if len(positions) == len(t.get("buttons", [])):
        # rows by z ascending, then columns by descending x (encoded as -x ascending)
        return [i for i, _ in sorted(positions.items(), key=lambda kv: kv[1])]
    return None


def main():
    if not os.path.isdir(AA):
        sys.exit(f"Addressables not found: {AA}")

    dialers = []
    standalone_hashes: dict = {}
    # Three of Sky Meadow's hashAssets are external; the DLC dialers (voidoutro,
    # helminthroost) carry the same 19 actions with their own local copies, so scanning
    # all of them fills the gaps.
    # SCAN EVERY BUNDLE. This used to be three hardcoded globs — skymeadow, dlc1-voidoutro,
    # dlc2-helminthro — chosen because that is where the dialer prefabs were when the script
    # was written. It recovered 16 codes and looked complete.
    #
    # There are 19. `PortalDialerCode1A5784` and `PortalDialerCodeD738C9` live in ror2-cu8,
    # and `PortalDialerCodeCF4BB3` in ror2-dlc3, so the three newest artifacts were never
    # targeted at all (MATH-VERIFICATION §3j.133). A hardcoded content list does not grow
    # with the game, and nothing about a clean "recovered 16/16" said otherwise — the
    # denominator was itself derived from the incomplete scan.
    #
    # A full pass is slower and is the only thing that can be right after the next DLC.
    for f in sorted(glob.glob(f"{AA}/*.bundle")):
        try:
            env = UnityPy.load(f)
            objs = list(env.objects)
        except Exception:
            continue
        byid = {o.path_id: o for o in objs}
        # Reset per bundle. This used to be initialised once outside the loop, which was
        # harmless while only three curated bundles were scanned (the first always had a
        # dialer) and is an UnboundLocalError on the first dialer-less bundle now that the
        # sweep is complete. A latent bug that the narrow scan was hiding.
        dialer = None
        # m_FileID indexes the serialized file's external dependency list; the artifact
        # bundles are named after the artifact, which is what attributes each code.
        externals = []
        for sf in env.files.values():
            ext = getattr(sf, "externals", None)
            if ext:
                externals = [getattr(e, "path", "") or getattr(e, "pathName", "") for e in ext]
                break
        # Sha256HashAssets named PortalDialerCode* ARE the full set of codes, whether or
        # not this bundle also holds the dialer that references them. Collecting them
        # directly is what makes the target list complete rather than a by-product of which
        # prefabs happened to be found.
        for o in objs:
            if str(o.type.name) != "MonoBehaviour":
                continue
            try:
                ht = o.read_typetree()
            except Exception:
                continue
            hname = ht.get("m_Name")
            if isinstance(hname, str) and hname.startswith("PortalDialerCode") and "value" in ht:
                standalone_hashes.setdefault(hash_bytes(ht["value"]), hname)

        for o in objs:
            if str(o.type.name) != "MonoBehaviour":
                continue
            try:
                t = o.read_typetree()
            except Exception:
                continue
            if "buttons" not in t or "actions" not in t:
                continue
            dialer = (t, byid, externals)
            break
        if dialer:
            dialers.append(dialer)
    if not dialers:
        sys.exit("PortalDialerController not found")

    length = len(dialers[0][0]["buttons"])
    targets = {}
    for t, byid, externals in dialers:
      for a in t["actions"]:
        pid = a["hashAsset"]["m_PathID"]
        if pid not in byid:
            continue
        try:
            h = byid[pid].read_typetree()
        except Exception:
            continue
        arg = a["action"]["m_PersistentCalls"]["m_Calls"][0]["m_Arguments"]["m_ObjectArgument"]
        fid = arg["m_FileID"]
        dep = externals[fid - 1] if 0 < fid <= len(externals) else f"fileID:{fid}"
        targets.setdefault(hash_bytes(h["value"]),
                           {"hashName": h.get("m_Name", "?"), "dep": dep})

    # Merge in any hash asset the dialer actions did not reach. Actions are added FIRST so
    # they win on attribution; these only fill gaps, and carry dep=None to say so.
    reached = len(targets)
    for h, hname in standalone_hashes.items():
        targets.setdefault(h, {"hashName": hname, "dep": None})
    if len(targets) > reached:
        print(f"note: {len(targets) - reached} code(s) found only as standalone hash assets "
              f"(no dialer action reached them, so they crack but do not self-attribute)")

    display_order = display_permutation(dialers[0])
    print(f"{len(dialers)} dialer prefabs, {length} buttons, {len(targets)} distinct hashes")
    print(f"display permutation (array index per screen cell): {display_order}")
    alphabet = sorted(GLYPH)
    total = len(alphabet) ** length
    print(f"brute-forcing {len(alphabet)}^{length} = {total:,} candidates…")

    found = {}
    for combo in itertools.product(alphabet, repeat=length):
        d = hashlib.sha256(bytes(combo)).digest()
        if d in targets:
            found[d] = combo
            if len(found) == len(targets):
                break

    print(f"recovered {len(found)}/{len(targets)}")
    if not found:
        sys.exit("no matches — the Sha256Hash field packing assumption is wrong")

    out = {}
    for d, combo in found.items():
        meta = targets[d]
        # Bundle name -> artifact name, e.g. ror2-base-artifacts-command -> "command"
        m = re.search(r"artifacts?-([a-z0-9]+)", meta["dep"] or "", re.I)
        key = m.group(1) if m else meta["hashName"]
        # ARRAY ORDER IS NOT DISPLAY ORDER, and this was the missing step.
        #
        # `combo` is in `buttons[]` order because that is what the game hashes. The dialer's
        # nine buttons are NOT stored in reading order: the prefab's GameObjects are named
        # "PortalDialerButton 1".."9" and appear in the array as 3,6,9,2,8,5,1,4,7. Printing
        # `combo` straight out gives a grid nobody can dial.
        #
        # The permutation is read from the prefab (see `display_permutation`), not hardcoded,
        # so it survives a patch that reorders the array. It reproduces the 16 previously
        # published codes exactly (MATH-VERIFICATION §3j.133).
        glyphs = "".join(GLYPH[c] for c in combo)
        shown = "".join(glyphs[i] for i in display_order) if display_order else glyphs
        rows = " ".join(shown[i:i + 3] for i in range(0, len(shown), 3))
        out[key] = {"code": rows, "rawOrder": glyphs, "values": list(combo),
                    "hashAsset": meta["hashName"], "dep": meta["dep"]}

    os.makedirs(OUT_DIR, exist_ok=True)
    path = f"{OUT_DIR}/ambry-codes.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False, sort_keys=True)
    # The glyphs are U+25CF/25A0/25B2/2666 and a Windows console defaults to cp1252, which
    # cannot encode them. The previous `.encode(...).decode(...)` was a no-op — it hands a str
    # back to `print`, which re-encodes to the console codepage and raises. The crash happened
    # AFTER the JSON was written, so the output was correct and the run still looked failed.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    for k in sorted(out):
        print(f"  {k:22s} {out[k]['code']}")
    print(f"-> {path}")


if __name__ == "__main__":
    main()
