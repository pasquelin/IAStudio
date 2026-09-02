#!/usr/bin/env bash
#
# Balaye TRIANGLES_PER_REGION sur le banc du monde ouvert — la mesure (a) du chantier C5-B.
#
# 🛑 La constante est en PRODUCTION et aucun drapeau n'est ajouté pour la mesurer, comme C2 l'a
# fait. Ce script refuse donc de partir si le fichier est déjà modifié, et le restaure quoi qu'il
# arrive — y compris sur une interruption.
#
# Usage : ./sweepRegions.sh <counts> <spreads> <grain[,grain...]>
#   ./sweepRegions.sh 50000 uniform,clustered 150000,50000,15000,5000 [suffixe]
#
# Le suffixe distingue deux passes du MÊME grain : un gain qui ne se retrouve pas à requête
# identique, ou qui s'inverse quand on renverse l'ordre des grains, est du bruit — c'est ce qui a
# retourné la conclusion de C2 et de C3.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FILE="src/renderer/src/engines/scene/instanceRegions.ts"
cd "$ROOT"

if [ -n "$(git status --porcelain -- "$FILE")" ]; then
  echo "🛑 $FILE est déjà modifié — le balayage refuse d'écraser un travail en cours." >&2
  exit 1
fi

restore() {
  git checkout -- "$FILE"
  echo "── constante restaurée : $(grep -E '^export const TRIANGLES_PER_REGION' "$FILE")"
}
trap restore EXIT INT TERM

COUNTS="${1:?counts manquant}"
SPREADS="${2:?spreads manquant}"
GRAINS="${3:?grains manquants}"
SUFFIX="${4:+-$4}"

IFS=',' read -ra LIST <<< "$GRAINS"
for grain in "${LIST[@]}"; do
  sed -i '' -E "s/^export const TRIANGLES_PER_REGION = .*/export const TRIANGLES_PER_REGION = ${grain}/" "$FILE"
  posed="$(grep -E '^export const TRIANGLES_PER_REGION' "$FILE")"
  echo "══ grain ${grain} — ${posed}"
  # Le grain posé est relu par le banc et écrit dans le relevé : un fichier dit de lui-même sous
  # quel grain il a été pris, plutôt que de le tenir de son nom.
  SPIKE_PAGE=world.html \
  SPIKE_QUERY="counts=${COUNTS}&spreads=${SPREADS}" \
  SPIKE_OUT="c5-${COUNTS}-r${grain}${SUFFIX}.json" \
    npx electron spike/webgpu/run.mjs 2>&1 | tail -3
done
