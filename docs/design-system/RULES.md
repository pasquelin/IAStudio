# RULES

Les conventions de design **constatées** dans ce dépôt. Une par ligne, chacune avec sa
source. Ce fichier ne décide rien : il enregistre ce que `CLAUDE.md` impose et ce que
le code majoritaire pratique.

Une règle sans source ne s'écrit pas ici. Si la source est l'usage, donner le compte
qui établit le majoritaire.

| Règle | Source | Portée |
|---|---|---|
| Les couleurs sont des jetons ; aucune valeur hexadécimale dans un composant | `CLAUDE.md` § Densité et jetons | `src/renderer/src/**/*.tsx` |
| Un jeton de couleur ne porte jamais un nom de l'échelle de taille de Tailwind | `CLAUDE.md` § Densité et jetons, verrouillé par `src/renderer/src/design/tokens.test.ts` | `src/renderer/src/index.css` |
| Les classes se fusionnent par `cn()`, jamais par gabarit | `CLAUDE.md` § Style ; usage : 1 seul `className={\`` dans tout `src/` | `src/renderer/` |
| Une peau lue par plus d'un composant vit dans `design/styles.ts` | usage : 60 fichiers hors tests importent ce module | `src/renderer/` |
| `style={{…}}` est réservé à une valeur calculée à l'exécution | usage : 25 des 27 relevés portent une mesure de virtualiseur, un pourcentage, une profondeur ou une hauteur de piste | `src/renderer/` |
| Les tailles de texte s'écrivent en pixels arbitraires | usage : 86 occurrences `text-[Npx]` ; `index.css` ne déclare aucune échelle typographique | `src/renderer/` |
| DaisyUI ne sert que hors des docks | `CLAUDE.md` § La frontière design system / DaisyUI ; usage : les classes DaisyUI n'apparaissent que sous `settings/` et `usage/`, deux fenêtres séparées | `src/renderer/src/` |
| Les icônes passent par `UiIcon` ; pas de SVG inline dans un composant | `CLAUDE.md` § Icônes | `src/renderer/` |
| Un composant exporté a au moins un appelant | usage : 0 orphelin sur 257 composants recensés | `src/` |
| Un hexadécimal en dehors d'un `.tsx` est une donnée ou un repli documenté | usage : les 33 relevés sont des couleurs de scène, des dessins de curseur ou des replis de jeton, chacun avec son commentaire | `src/renderer/src/engines/`, `src/shared/` |

## Contradictions relevées

Ce que `CLAUDE.md` dit et que le code contredit, ou l'inverse. **`CLAUDE.md` prime** ;
la ligne reste ici jusqu'à ce que le code s'aligne.

| Ce que dit `CLAUDE.md` | Ce que fait le code | Où |
|---|---|---|
| « **`cn()`** pour fusionner les classes Tailwind » | un gabarit de chaîne fusionne deux classes conditionnelles | `src/renderer/src/design/Row.tsx:49` |
