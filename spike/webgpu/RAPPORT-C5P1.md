# C5-P1 — la grille, la zone active et l'instancing par cellule, en production

Sources : **[M]** mesuré · **[C]** lu dans le code · **[H]** hypothèse.

Étapes 1 et 2 du plan de migration de C5-B2 § 10. **Première session qui écrit dans `src/`.**
Les étapes 3 (bypass géométrique), 4 (couche dynamique) et 5 (activation par défaut) ne sont pas
engagées.

## 1. Ce qui a été écrit

| commit | fichiers |
|---|---|
| `11d8771e4` | `engines/scene/worldPartition.ts` + son test — la grille et la zone |
| `61b2df176` | `engines/scene/cellInstancing.ts` + son test · `grouping.ts` (le contrat) · `SceneRenderer.ts` (le flag) · `sceneRendererGroups.test.ts` · `no-layer-for-a-line.test.ts` |
| `0a5aa2636` | une cellule hors zone SORT de la scène — voir § 5 |

Le flag est **`partition: 'off' | 'grid'`, défaut `off`**, à côté de `grouping` et selon le même
modèle que `batching.ts` : une stratégie alternative dans son propre fichier, jamais activée par
défaut. `sceneRendererGroups.test.ts` mesure désormais **trois** façons de dessiner et non deux.

Deux écarts assumés par rapport au code de spike :

- **L'index est ANCRÉ SUR L'ORIGINE du monde**, pas sur l'étendue des corps. Lu sur l'étendue, il
  bouge le jour où un corps est ajouté au-delà de l'ancien bord, et toutes les cellules changent de
  clé avec lui — ce qu'un index incrémental doit précisément éviter. **[C]**
- **`hold` / `release` remplacent `build(centres)`** : une cellule entre et sort de l'index une par
  une, ce que la règle « n'invalider que les cellules touchées » exige.

Le contrat `InstancedGroups` gagne **une** méthode, optionnelle, que seule la partition
implémente : `follow(camera | null)`. Elle est appelée depuis `dressPane` — donc une fois par pane
et par frame, avant le dessin — et depuis `hideWorkshop`, avec `null`, ce qui rouvre la zone en
grand : le film, la capture et l'aperçu rendent depuis une caméra à eux sans jamais passer par un
pane, et une zone rétrécie pour le viewport leur retirerait des corps.

## 2. Le banc de spike, rejoué (contrôle)

`SPIKE_PAGE=partition.html … cycles=8`, 500 000 / `D_active` 500 / grain 256, médianes de 8 cycles.

| | CPU | instances | appels | GPU | nœuds |
|---|---:|---:|---:|---:|---:|
| cible § 1 (C5-B2) — témoin | 0,372 | 223 488 | 125 | 2,86 | — |
| cible § 1 — partition | 0,351 | 20 462 | 244 | 2,26 | 45 |
| **rejoué — témoin `regions`** | **0,473** | **223 488** | **125** | 3,59 | 0 |
| **rejoué — partition `grid`** | **0,451** | **20 462** | **244** | **1,96** | **45** |

Instances, appels et nœuds sont **identiques au chiffre près**. Le CPU est 27 % au-dessus de la
cible **des deux côtés** — c'est la machine du jour, pas la partition : le RAPPORT
partition/témoin vaut 0,95 ici contre 0,94 au § 1. Image : **0 pixel différent** contre le témoin.
**[M]**

## 3. Le flag de production, `off` contre `grid`

Banc neuf — `spike/webgpu/productionPartition.{ts,html}`. Il **ne réimplémente rien** : il monte le
vrai `SceneRenderer` des deux côtés du flag et mesure `gl.render` de la passe couleur, ombres
éteintes — la fenêtre du § 1. Caméra posée DANS le niveau, `far = 500`, 8 cycles après 10 frames
de chauffe.

### 500 000 corps (501 445 nœuds avec le sol)

| | `off` | témoin `off` n°2 | **`grid`** | `grid` zone ouverte |
|---|---:|---:|---:|---:|
| `gl.render` CPU, moyenne | 0,499 | 0,661 | **1,124** | 2,971 |
| dont marche des matrices | 0,171 | 0,183 | 0,285 | 1,828 |
| `follow` | 0,000 | 0,000 | **0,036** | 0,005 |
| GPU | 3,440 | 3,411 | **1,865** | 2,143 |
| appels de dessin | 159 | 159 | 397 | 432 |
| instances dessinées | 231 397 | 231 397 | **31 506** | 34 311 |
| triangles | 19 767 548 | — | **11 464 392** | 12 402 400 |
| meshes dans la scène | 1 235 | 1 235 | 1 404 | 6 912 |
| cellules dessinées | — | — | **53 / 257** | 257 / 257 |
| appels de moins de 16 instances | 0 | 0 | **52** (336 inst.) | 385 (2 913) |

**Ce que la partition rend :** les instances sont divisées par **7,3** (231 397 → 31 506), les
triangles par 1,7, le GPU passe de **3,44 à 1,87 ms (−46 %)**, et la zone active ne coûte que
**0,036 ms** par frame — recherche et diff des cellules comprises. **[M]**

**Ce qu'elle coûte : le CPU de soumission, ×2,25 (0,50 → 1,12 ms).** La cible du § 1 était la
PARITÉ avec le témoin ; production s'en écarte bien au-delà de ±20 %. La cause est mesurée et
tient en une ligne : **la soumission suit le nombre d'appels**, à ~3,2 µs l'appel des deux côtés
(0,499/159 = 3,1 · 1,124/397 = 2,8), et la partition multiplie les appels par 2,5. **[M]**

Pourquoi 397 appels ici et 244 au banc de spike : les deux ne regroupent pas de la même façon — la
production clé sur (descripteur de géométrie, descripteur de matériau, drapeaux d'ombre, marque
d'outil) et découpe sur une grille ancrée à l'origine, le spike sur (forme, couleur) et une grille
ancrée sur les corps. Le témoin lui-même diffère déjà : 159 appels en production contre 125 au
spike. **[H]** pour l'attribution, **[M]** pour les deux comptes.

### Les petits mondes

| | CPU `off` | CPU `grid` | GPU `off` | GPU `grid` | appels | instances | appels fins |
|---|---:|---:|---:|---:|---:|---:|---:|
| 500 corps | 0,182 | **0,221** | 0,68 | **0,72** | 54 → 80 | 514 → 268 | **96 sur 96** |
| 5 000 corps | 0,173 | **0,221** | 0,87 | **1,10** | 51 → 86 | 5 030 → 3 118 | 5 sur 108 |

**La régression annoncée est là, et elle est petite en absolu** : +0,04 ms de CPU dans les deux
cas, et un GPU qui monte au lieu de descendre alors que la partition dessine deux fois moins de
triangles — le prix fixe des appels supplémentaires. **À 500 corps, les 96 appels tirent tous
moins de 16 instances** : c'est exactement la mesure que l'étape 3 (bypass géométrique) attend.
**[M]** — le GPU se lit à ce niveau avec prudence, une seconde campagne donnait 1,12 et 1,66 ms
pour ces mêmes deux lignes.

## 4. L'image

| comparaison | pixels différents | écart max |
|---|---:|---:|
| `off` contre `off` (témoin, deux moteurs) | **0** | 0 |
| `off` contre `grid` | **2** sur 3,24 M | 35 |
| `off` contre `grid` **zone ouverte** | **2**, aux mêmes coordonnées | 35 |

**La zone active ne retire aucun pixel.** Le contrôle le prouve : zone grande ouverte, toutes les
cellules dessinées, les deux mêmes pixels restent — `1268,808` et `1452,1165`, tous deux de la
teinte du sol, à 12/255 par canal. Ce que ces deux pixels mesurent est le **changement d'ordre de
dessin** que tout regroupement produit, pas un corps perdu. **[M]** pour l'attribution,
**[H]** pour la cause (précision du tampon de profondeur à longue portée).

À 500 et à 5 000 corps, **0 pixel** dans les trois comparaisons. **[M]**

**La règle du lot demandait 0 pixel. Le résultat est 2, sur le plus grand monde seulement, et le
contrôle dit qu'ils ne viennent pas de la zone.** Livré comme tel, pas comme un succès.

## 5. Le défaut trouvé en cours de route

Première version : une cellule hors zone était **éteinte** (`visible = false`). Mesuré :
soumission à 2,97 ms et 1,83 ms de marche de matrices par frame, pour 6 912 meshes dont 6 900 ne
dessinaient rien.

`visible` arrête `projectObject` et **rien d'autre** : `Object3D.updateMatrixWorld` de three 0.185
descend dans tous les enfants quoi qu'en dise le drapeau, et la garde sur `matrixWorldAutoUpdate`
épargne la matrice, jamais la descente. Une cellule hors zone **sort** donc de la scène. La marche
retombe à 0,285 ms et la soumission à 1,124. **[M]** + **[C]**

## 6. Le coût d'un changement de document

`apply` d'un état où **un corps est ajouté**, puis d'un état où il est **retiré**, médiane de 5
passes :

| | `off` | `grid` |
|---|---:|---:|
| 500 corps | 0,59 / 0,64 ms | 0,58 / 0,58 ms |
| 5 000 corps | 5,20 / 4,88 ms | 5,31 / 4,66 ms |
| 500 000 corps | 1 086 / 1 123 ms | 1 327 / 1 314 ms |

**L'invalidation par cellule EXISTE et elle est prouvée par le test unitaire** — « keeps the cells
nothing touched, and builds again only the one that changed » : le mesh de la cellule intacte est
le MÊME objet après la reconstruction, seule la cellule touchée en reçoit un neuf, et les matrices
des cellules intactes ne sont réécrites que si elles ont vraiment bougé.

**Mais elle ne se voit pas en millisecondes à 500 000**, et il faut le dire ainsi : `apply` y est
dominé par la réconciliation du studio sur 501 445 nœuds, pas par le regroupement. À cette taille
`grid` est même **20 % plus lent** que `off` — le rangement par cellule s'ajoute au balayage. À
5 000 et à 500, les deux sont à égalité. **[M]**

## 7. Ce que le lot ne fait pas

- Le CPU de soumission ne rejoint pas la cible du § 1 : le levier nommé par la mesure est
  **l'étape 3**, le bypass géométrique — 52 appels de moins de 16 instances à 500 000, 96 sur 96 à
  500.
- **Aucun nombre de nœuds visités n'est publié par la production** : `worldPartition` le compte
  (`stats()`), mais rien ne l'expose au travers du contrat `InstancedGroups`. Le 45 du § 2 est
  celui du banc de spike. Le test unitaire tient la borne (< 80 pour une zone de 500 sur 10 000
  cellules).
- Un corps qui traverse une frontière de cellule **pendant un geste** reste dessiné par sa cellule
  d'origine jusqu'au prochain changement de contenu : `moved` élargit les bornes plutôt que de
  redécouper, comme `instancing.ts` le fait déjà pour ses régions. C'est l'étape 4 qui traite les
  mobiles.
- Ni C3 (LOD), ni les ombres, ni l'activation par défaut.
