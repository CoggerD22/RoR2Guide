#!/usr/bin/env bash
#
# Decompile RoR2.dll for LOCAL math verification (MATH-VERIFICATION.md Phase 0).
#
# NOTE (§3j.106-107): RoR2.dll is where the game's mechanics live, but do not assume
# that from the filename. Assembly-CSharp.dll sits beside it and its strings mention
# RoR2.CharacterAI, RoR2.EntityLogic and similar — those are 2,039 TypeForwardedTo
# attributes, not implementations; it holds only graphics/audio middleware. Decompiled
# and checked in §3j.107, it contains no mechanics at all.
#
# The cheap decisive test for "is X referenced anywhere else?" is a raw byte scan of
# Managed/*.dll for the identifier: a cross-assembly member reference stores the member
# NAME in the referencing assembly's metadata, so if the name appears in only one DLL,
# only that DLL can reference it. 143 DLLs, one grep, no decompiling required.
#
# Output goes to ./.decompiled/ which is git-ignored — decompiled game code is
# copyrighted and MUST NOT be committed. The repo keeps only derived facts.
#
# Requires the .NET SDK. Point at the game via ROR2_DLL if it isn't on E:.
#   ROR2_DLL="D:/.../RoR2.dll" ./scripts/decompile.sh
#
set -euo pipefail

ILSPY_VERSION="9.1.0.7988" # latest is malformed on install; this one works
ILSPY="${ILSPY:-$HOME/.dotnet/tools/ilspycmd}"
DLL="${ROR2_DLL:-E:/SteamLibrary/steamapps/common/Risk of Rain 2/Risk of Rain 2_Data/Managed/RoR2.dll}"
OUT="${OUT:-.decompiled}"

if [ ! -x "$ILSPY" ] && ! command -v ilspycmd >/dev/null 2>&1; then
  echo "Installing ilspycmd $ILSPY_VERSION …"
  dotnet tool install -g ilspycmd --version "$ILSPY_VERSION"
fi
[ -x "$ILSPY" ] || ILSPY=ilspycmd

if [ ! -f "$DLL" ]; then
  echo "RoR2.dll not found at:"
  echo "  $DLL"
  echo "Set ROR2_DLL to your install's Risk of Rain 2_Data/Managed/RoR2.dll"
  exit 1
fi

mkdir -p "$OUT"

# The stat engine + most stat-item math lives in these types. Non-stat item
# values (proc chances, durations) live in scattered behavior classes — decompile
# those on demand with:  "$ILSPY" "$DLL" -t <FullTypeName> -o "$OUT"
TYPES=(
  RoR2.CharacterBody      # RecalculateStats() — stat order + stat-item math
  RoR2.HealthComponent    # armor/damage-taken formula, barrier, shields
  RoR2.RoR2Content        # base-game item codename -> definition
)

for t in "${TYPES[@]}"; do
  echo "decompiling $t …"
  "$ILSPY" "$DLL" -t "$t" -o "$OUT" >/dev/null && echo "  ok -> $OUT/$t.decompiled.cs"
done

echo
echo "For the full assembly tree (large): $ILSPY \"$DLL\" -p -o \"$OUT/full\""
echo "Done."
