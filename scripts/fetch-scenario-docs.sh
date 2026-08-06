#!/usr/bin/env bash
# Régénère docs/scenario-api/ depuis docs.scenario.com.
#
# Le site est un Astro/Starlight qui sert chaque page en markdown brut sous
# <chemin>/index.md — c'est ce qu'on aspire, plutôt que de convertir du HTML.
# La spec OpenAPI officielle est en 403 sur le CDN, d'où cette approche.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/docs/scenario-api"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fetch_md() {
  local path="$1" dest="$2"
  mkdir -p "$(dirname "$dest")"
  local code
  code=$(curl -sSL -o "$dest" -w '%{http_code}' "https://docs.scenario.com${path%/}/index.md")
  [ "$code" = '200' ] || { rm -f "$dest"; return 1; }
}

echo '→ guides'
curl -sSL https://docs.scenario.com/ \
  | grep -oE 'href="/[^"#]*"' | sed 's/href="//;s/"//' \
  | grep -vE '^/(_astro|favicon)' | sort -u > "$TMP/guides.txt"

curl -sSL https://docs.scenario.com/index.md -o "$OUT/guides/index.md"
while read -r p; do
  [ "$p" = '/index.md' ] && continue
  fetch_md "$p" "$OUT/guides${p%/}.md" || echo "  ignoré : $p"
done < "$TMP/guides.txt"

echo '→ référence SDK'
curl -sSL https://docs.scenario.com/api/typescript -o "$TMP/ts.html"
grep -oE 'href="/api/typescript[^"#]*"' "$TMP/ts.html" \
  | sed 's/href="//;s/"//' | grep -v 'index.md$' | sort -u > "$TMP/ref.txt"

while read -r p; do
  name=$(echo "$p" \
    | sed 's|^/api/typescript/||; s|resources/||; s|subresources/||g; s|methods/||g; s|/|.|g')
  [ -n "$name" ] || continue
  fetch_md "$p" "$OUT/reference/$name.md" || echo "  ignoré : $p"
done < "$TMP/ref.txt"

echo "✓ $(find "$OUT" -name '*.md' | wc -l | tr -d ' ') pages dans $OUT"
echo '  Penser à relire docs/scenario-api/README.md : le catalogue de modèles évolue.'
