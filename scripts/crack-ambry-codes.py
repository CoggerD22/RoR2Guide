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


def main():
    if not os.path.isdir(AA):
        sys.exit(f"Addressables not found: {AA}")

    dialers = []
    # Three of Sky Meadow's hashAssets are external; the DLC dialers (voidoutro,
    # helminthroost) carry the same 19 actions with their own local copies, so scanning
    # all of them fills the gaps.
    for f in sorted(glob.glob(f"{AA}/ror2-base-skymeadow_*")
                    + glob.glob(f"{AA}/ror2-dlc1-voidoutro_*")
                    + glob.glob(f"{AA}/ror2-dlc2-helminthro*")):
        try:
            env = UnityPy.load(f)
            objs = list(env.objects)
        except Exception:
            continue
        byid = {o.path_id: o for o in objs}
        # m_FileID indexes the serialized file's external dependency list; the artifact
        # bundles are named after the artifact, which is what attributes each code.
        externals = []
        for sf in env.files.values():
            ext = getattr(sf, "externals", None)
            if ext:
                externals = [getattr(e, "path", "") or getattr(e, "pathName", "") for e in ext]
                break
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

    print(f"{len(dialers)} dialer prefabs, {length} buttons, {len(targets)} distinct hashes")
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
        glyphs = "".join(GLYPH[c] for c in combo)
        rows = " ".join(glyphs[i:i + 3] for i in range(0, len(glyphs), 3))
        out[key] = {"code": rows, "values": list(combo), "hashAsset": meta["hashName"],
                    "dep": meta["dep"]}

    os.makedirs(OUT_DIR, exist_ok=True)
    path = f"{OUT_DIR}/ambry-codes.json"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False, sort_keys=True)
    for k in sorted(out):
        print(f"  {k:22s} {out[k]['code']}".encode("utf-8", "replace").decode("utf-8"))
    print(f"-> {path}")


if __name__ == "__main__":
    main()
