# C5-P1 — la grille, la zone active et l'instancing par cellule, en production

Sources : **[M]** mesuré · **[C]** lu dans le code · **[H]** hypothèse.

Étapes 1 et 2 du plan de migration de C5-B2 § 10. **Première session qui écrit dans `src/`.**
Les étapes 3 (bypass géométrique), 4 (couche dynamique) et 5 (activation par défaut) ne sont pas
engagées.

## 1. Ce qui a été écrit

| commit | ce qu'il pose |
|---|---|
| `11d8771e4` | `engines/scene/worldPartition.ts` + test — la grille et la requête par disque |
| `61b2df176` | `engines/scene/cellInstancing.ts` + test · le contrat de `grouping.ts` · le flag dans `SceneRenderer` · `sceneRendererGroups.test.ts` mesure désormais TROIS façons de dessiner |
| `0a5aa2636` | une cellule hors zone SORT de la scène — § 5 |
| `97153ef04` | `spike/webgpu/productionPartition.{ts,html}` — le banc du vrai moteur, et ses témoins |
| `f7ee6ac3c` | `writeMoved` et `shapeAndPaint` descendus dans `grouping.ts` ; trois allocations par frame en moins |
| `bb89c5333` | l'aperçu nomme SA caméra à la zone au lieu de la rouvrir — § 7 |

Le flag est **`partition: 'off' | 'grid'`, défaut `off`**, selon le modèle de `batching.ts` : une
stratégie alternative dans son propre fichier, jamais activée par défaut.

Deux écarts assumés par rapport au code de spike :

- **L'index est ancré sur l'ORIGINE du monde**, pas sur l'étendue des corps. Lu sur l'étendue, il
  bouge le jour où un corps est ajouté au-delà de l'ancien bord, et toutes les cellules changent de
  clé avec lui — ce qu'un index incrémental doit précisément éviter. **[C]**
- **`hold` / `release` remplacent `build(centres)`** : une cellule entre et sort de l'index une par
  une, ce que la règle « n'invalider que les cellules touchées » exige.

Le contrat `InstancedGroups` gagne **une** méthode, optionnelle, que seule la partition
implémente : `follow(camera | null)`, appelée depuis `dressPane` — une fois par pane et par frame,
avant le dessin, et sa réponse redemande les cartes d'ombre — et depuis `hideWorkshop`, que le
film, la capture et l'aperçu franchissent tous.

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

**Il joue `off` DEUX fois**, et c'est ce qui rend le reste lisible : sans ce témoin, l'écart entre
deux moteurs se mettrait sur le dos de la partition. La colonne `zone ouverte` est le second
contrôle — la partition regroupe mais ne retire aucune cellule.

### 500 000 corps (501 445 nœuds avec le sol)

| | `off` | témoin `off` n°2 | **`grid`** | `grid` zone ouverte |
|---|---:|---:|---:|---:|
| `gl.render` CPU, moyenne | 0,706 | 0,719 | **1,422** | 2,001 |
| dont marche des matrices | 0,328 | 0,289 | 0,524 | 1,128 |
| `follow` | 0,000 | 0,001 | **0,041** | 0,015 |
| GPU | 3,363 | 3,465 | **1,876** | 2,531 |
| appels de dessin | 159 | 159 | 397 | 432 |
| instances dessinées | 231 397 | 231 397 | **31 506** | 34 311 |
| triangles | 19 767 548 | — | **11 464 392** | 12 402 400 |
| meshes dans la scène | 1 235 | 1 235 | 1 404 | 6 912 |
| cellules dessinées | — | — | **53** | 257 |
| appels de moins de 16 instances | 0 | 0 | **52** | 385 |

**Ce que la partition rend :** les instances sont divisées par **7,3** (231 397 → 31 506), les
triangles par 1,7, le GPU passe de **3,36 à 1,88 ms (−44 %)**, et la zone active coûte **0,041 ms**
par frame — requête et diff compris. Les deux témoins `off` tiennent à 0,013 ms de CPU et 0,10 ms
de GPU l'un de l'autre, donc ces écarts-là se lisent. **[M]**

**Ce qu'elle coûte : le CPU de soumission, ×2,0 (0,71 → 1,42 ms).** La cible du § 1 était la
PARITÉ avec le témoin ; la production s'en écarte bien au-delà de ±20 %. La cause est mesurée et
tient en une ligne : **la soumission suit le nombre d'appels**, à ~3,5 µs l'appel des deux côtés
(0,706/159 = 4,4 · 1,422/397 = 3,6), et la partition multiplie les appels par 2,5. **[M]**

Pourquoi 397 appels ici et 244 au banc de spike : les deux ne regroupent pas de la même façon — la
production clé sur (descripteur de géométrie, descripteur de matériau, drapeaux d'ombre, marque
d'outil) et découpe sur une grille ancrée à l'origine, le spike sur (forme, couleur) et une grille
ancrée sur les corps. Le témoin lui-même diffère déjà : 159 appels en production contre 125 au
spike. **[H]** pour l'attribution, **[M]** pour les deux comptes.

### Les petits mondes — ce que le témoin autorise à dire, et rien de plus

| 5 000 corps | `off` | témoin | `grid` |
|---|---:|---:|---:|
| CPU | 0,153 | 0,203 | 0,234 |
| GPU | 0,733 | 0,765 | 1,118 |
| appels · instances | 51 · 5 030 | — | 86 · 3 118 |

| 500 corps | `off` | témoin | `grid` |
|---|---:|---:|---:|
| CPU | 0,230 | 0,169 | 0,231 |
| GPU | 0,889 | 0,351 | 0,520 |
| appels · instances | 54 · 514 | — | 80 · 268 |
| appels de moins de 16 instances | 0 sur 24 | — | **96 sur 96** |

**À 500 corps, RIEN n'est mesurable** : le témoin `off` s'écarte de `off` de 0,061 ms en CPU et
d'un facteur 2,5 en GPU, soit plus que tout écart `off` → `grid`. Une régression annoncée ici
serait une lecture de bruit. **[M]**

**À 5 000, un seul écart dépasse le témoin : le GPU, +0,35 ms**, alors que la partition dessine
1,8 fois moins de triangles — le prix fixe des 35 appels supplémentaires. **Et les 96 appels sur
96 de la scène à 500 disent où l'étape 3 doit mordre**, indépendamment de toute mesure de temps.
**[M]**

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

## 5. Le défaut trouvé par la mesure

Première version : une cellule hors zone était **éteinte** (`visible = false`).

`visible` arrête `projectObject` et **rien d'autre** : `Object3D.updateMatrixWorld` de three 0.185
descend dans tous les enfants quoi qu'en dise le drapeau, et la garde sur `matrixWorldAutoUpdate`
épargne la matrice, jamais la descente. Une cellule hors zone **sort** donc de la scène. La colonne
`zone ouverte` du § 3 chiffre encore ce que coûtait l'autre version — **6 912 meshes tenus contre
1 404, 1,128 ms de marche de matrices contre 0,524, et 2,001 ms de soumission contre 1,422**.
**[M]** + **[C]**

## 6. Le coût d'un changement de document

`apply` d'un état où **un corps est ajouté**, puis d'un état où il est **retiré**, médiane de 5
passes :

| | `off` | témoin | `grid` |
|---|---:|---:|---:|
| 500 corps | 0,53 / 0,57 ms | 0,51 / 0,52 | 0,62 / 0,63 |
| 5 000 corps | 5,24 / 4,65 ms | 5,64 / 5,66 | 6,82 / 6,80 |
| 500 000 corps | 1 341 / 1 292 ms | 1 254 / 1 273 | 1 410 / 1 416 |

**L'invalidation par cellule EXISTE et elle est prouvée par le test unitaire** — « keeps the cells
nothing touched, and builds again only the one that changed » : le mesh de la cellule intacte est
le MÊME objet après la reconstruction, seule la cellule touchée en reçoit un neuf, et les matrices
des cellules intactes ne sont réécrites que si elles ont vraiment bougé.

**Mais elle ne se voit pas en millisecondes**, et il faut le dire ainsi : à 500 000, `apply` est
dominé par la réconciliation du studio sur 501 445 nœuds, pas par le regroupement — l'écart
`grid` − `off` (+8 %) est du même ordre que l'écart entre les deux passes de `off` (+7 %). À 5 000
l'écart est de 1,5 ms, hors témoin celui-là. **[M]**

## 7. Ce que la revue a corrigé, et ce qu'elle a laissé

Corrigé dans le lot : **l'aperçu en incrustation rouvrait la zone en grand à chaque frame.**
`onInset` passe par `hideWorkshop`, appelé une fois par frame tant que la préview est montrée ; le
niveau entier rentrait dans la scène puis en ressortait deux fois par frame, et l'aperçu dessinait
des cellules avec des cartes d'ombre tracées pour la zone des panneaux, `needsUpdate` ayant déjà
été consommé. L'incrustation a une caméra : elle la donne désormais. **[C]**

**Hors périmètre, signalé et non corrigé** — trois défauts de `SceneRenderer` que ce lot ne touche
pas et qui existaient avant lui : `withHungUnder` ré-ajoute une source déjà accrochée puis retire
les DEUX copies (un glisser multi-sélection de corps instanciés ne rapporte alors aucune
transformation) · `onGizmoChange` écrit `selectedIds` sans leur descendance, là où
`regroupInstances` a été corrigé pour le faire · `refreshAids` en `boundingBoxes: 'all'` accroche
et décroche toutes les sources à chaque `apply`.

## 8. Étape 3 — le bypass géométrique

### Ce que la mesure a dit AVANT d'écrire quoi que ce soit

Trois conceptions ont été mesurées puis écartées, et c'est le contrôle qui les a écartées.

**Le contrôle**, d'abord : le banc compte les instances qu'un frustum retient VRAIMENT, sphère du
corps comprise. Il rend **9 116 instances visibles, identiques dans les quatre colonnes** — même
monde, même caméra, quelle que soit la stratégie. Une mesure qui ne rend pas ce nombre est fausse.

| | soumises | visibles | sur-soumission |
|---|---:|---:|---:|
| `off` | 231 397 | 9 116 | **×25,4** |
| `grid`, étape 2 | 31 506 | 9 116 | ×3,5 |

1. **« Fusionner les lots peu peuplés »** — écartée. Sur les 191 appels qui ne dessinaient AUCUNE
   instance visible, **aucun** n'était un appel de moins de 16 instances (`emptyThinCalls = 0`).
   La fusion n'aurait retiré aucun appel vide, et aurait rendu 18 appels permanents.
2. **« Un seuil sous lequel on ne partitionne pas »** — écartée : il n'y a **pas de régression** à
   500 ni à 5 000. L'écart `off` → `grid` y tenait dans l'écart du témoin `off` à lui-même.
3. **Ce qui restait, et qui a été écrit** : three teste un `InstancedMesh` par sa **sphère**. Sur un
   lot étalé dans une cellule de 256, cette sphère mord le frustum sans qu'aucune de ses instances
   n'y soit. La **boîte** des instances est toujours contenue dans cette sphère : un lot qu'elle
   rate ne peut rien montrer. Mesuré avant écriture : **la boîte rejette 155 des 381 appels**, tous
   pris parmi les 191 vides.

### Ce que ça donne

500 000 corps, `D = 500`, 8 cycles, machine au repos, **campagne d'une seule taille de monde**
(voir le § 12). La colonne « étape 2 » est la campagne du lot précédent, même machine, même repos.

| | `off` | témoin `off` | étape 2 | **étape 3** |
|---|---:|---:|---:|---:|
| appels de dessin | 159 | 159 | 397 | **246** |
| `gl.render` CPU | 0,719 | 0,789 | 1,422 | **0,942** |
| `follow` | 0,000 | 0,000 | 0,041 | **0,268** |
| **total par frame** | **0,719** | **0,789** | **1,463** | **1,210** |
| GPU | 3,524 | 3,370 | 1,876 | **1,431** |
| instances soumises | 231 397 | 231 397 | 31 506 | **17 848** |
| instances visibles | 9 116 | 9 116 | 9 116 | 9 116 |
| sur-soumission | ×25,4 | — | ×3,5 | **×2,0** |
| nœuds visités | — | — | non publié | **80** |
| cellules rendues / connues | — | — | — | **52 / 256** |

**−38 % d'appels, −43 % d'instances soumises, −24 % de GPU, −17 % de CPU total.** Le rapport au
témoin passe de ×2,1 à **×1,5**. Image : les deux pixels du § 4, inchangés — aucun de plus. **[M]**

**Deux étages, et c'est une mesure qui l'a imposé.** À plat, sur tous les lots de toutes les
cellules debout, le test coûtait **0,42 ms de `follow` par frame** — plus de la moitié de ce qu'il
rendait. La cellule d'abord, ses lots seulement si elle est dans le champ : **0,27 ms**. **[M]**

**Trois défauts de correction, tous trouvés par relecture et non par la mesure — tous du même côté
de l'invariant : ils CACHAIENT ce que le rendu montrerait.**

1. La boîte d'une cellule est l'union de celles de ses lots. Une reconstruction qui ne fait que
   **réécrire** des matrices la laissait sur l'union des places PRÉCÉDENTES.
2. **Un glisser** passe par `moved`, jamais par une reconstruction : la boîte du lot grandissait,
   celle de la cellule non — et la cellule entière disparaissait pour toute la durée du geste.
3. **`getMaxScaleOnAxis` n'est pas une borne supérieure sous cisaillement.** Un enfant tourné d'un
   huitième de tour sous un parent d'échelle (1, 1, 3) s'étire de 3 et il répond 2,236 : une boîte
   lue dessus est 34 % trop petite. La norme de Frobenius n'est jamais en dessous de la vraie, pour
   neuf carrés — elle coûte 4 appels et 365 instances sur les 246 et 17 848 du tableau.

Le premier en détail, parce qu'il est le moins visible : La boîte d'une cellule est l'union
de celles de ses lots. Une reconstruction qui ne fait que **réécrire** des matrices — un corps
reparenté, qui garde sa cellule et ses voisins — mettait à jour la boîte du lot et laissait celle
de la cellule sur l'union des places PRÉCÉDENTES : un corps ramené dans le champ restait caché avec
sa cellule. Corrigé, et tenu par un test qui échoue à vue quand on retire la ligne. **[C]**

### Les petits mondes

| | CPU `off` | témoin | CPU `grid` | GPU `off` | témoin | GPU `grid` | appels | soumises / visibles |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 500 | 0,325 | 0,325 | **0,452** | 0,887 | 0,888 | **0,434** | 54 → 77 | 514 → **248** / 134 |
| 5 000 | 0,285 | 0,324 | **0,430** | 0,63 | 1,30 | 1,11 | 51 → 83 | 5 030 → **2 964** / 1 298 |

**À 500 les deux témoins tiennent à 0,001 ms des deux côtés, donc tout se lit : la partition coûte
+0,13 ms de CPU et rend 0,45 ms de GPU.** À 5 000, le CPU coûte +0,11 à +0,15 ms ; le GPU y est
illisible, les deux témoins s'écartant de 0,67 ms l'un de l'autre. 0 pixel dans les six
comparaisons. **[M]**

**C'est plus cher qu'à l'étape 2** (+0,06 alors) : le rejet par boîte se paie sur les petits mondes
sans rien y rendre, puisqu'il n'y a presque rien à rejeter. Un seuil qui le désactiverait sous une
certaine taille est le sujet le plus naturel d'un lot suivant — mais il n'est pas dans celui-ci, et
0,13 ms ne le justifie pas à lui seul.

## 9. Le rayon de zone — ce que je vous ai annoncé était faux

**Correction.** Les « 54 appels de gaspillage pur » que j'ai avancés reposaient sur un test
faux : il comparait une distance **euclidienne** à `camera.far`, qui est une profondeur sur l'axe
de vue. Un corps à 600 unités peut se tenir à z = 450 et être parfaitement visible.

Le test qui prouve vraiment un appel gaspillé est celui du § 8 — aucune de ses instances dans le
frustum — et il dit que **le rayon n'a rien à rendre** :

- Le disque doit contenir tout ce que le frustum peut montrer. Son coin lointain est à
  `hypot(far, h, h·aspect)` = **774** pour `far = 500`, pas 500 ; les 500 du banc de spike sont
  **plus petits que son propre frustum** — il pouvait retirer des cellules visibles, et n'a coûté
  0 pixel que sur la vue qu'il mesurait.
- Le `+ cellSize / 2` s'ajoute parce qu'un corps de portée ≤ 128 déborde de sa cellule d'autant, et
  que la requête teste le RECTANGLE de la cellule.
- **La forme est porteuse, pas seulement la taille** : le disque ignore la direction de la caméra
  exprès. Une cellule hors du champ peut porter une ombre DANS le champ, et la passe d'ombre
  regarde depuis la lumière. Rétrécir le disque à ce que la caméra voit casserait les ombres — ce
  que le rejet par boîte du § 8 fait déjà, et qui est écrit au § 10 comme angle mort.

**Rien n'a donc été changé au rayon.** Il est déjà minimal-correct. **[M]** + **[C]**

## 10. La piste laissée pour plus tard

**27 lots par cellule**, des deux côtés — production 6 912 meshes / 257 cellules = 26,9 ; spike
6 075 / 225 = 27,0. Une cellule coûte ses 27 appels même quand trois de ses lots seulement sont
réellement peuplés, et c'est le plafond que ni l'étape 3 ni le grain ne franchissent : le nombre
d'appels reste `27 × cellules retenues`.

Piste notée, **hors de ce lot** : ramasser les lots peu peuplés d'une cellule dans un mesh résiduel
par macro-chunk, ou tout autre moyen de ne pas payer un appel par lot déclaré quand la cellule n'en
remplit que quelques-uns.

## 12. L'ombre d'un corps hors champ — elle POPPAIT

`spike/webgpu/shadowZone.{ts,html}` : un sol, **32 piliers hauts groupés franchement de côté**
(78° hors de l'axe), un soleil bas en +z dont l'ombre revient à 30°, donc dans le champ. La caméra
tourne sur place de 0 à 60°, et l'on compare `off` et `grid` à chaque cap.

**Trois contrôles, sans lesquels le relevé ne dit rien** — et les trois ont servi :

- **l'image bouge-t-elle ?** 60,4 % des pixels changent entre le cap 0 et le cap 60. Une première
  version visait `y = 8` à UNE unité devant une caméra posée à 12 : un piqué de 63°, la caméra
  regardait le sol sous elle et tout rendait « 0 différent » ;
- **l'ombre est-elle dans l'image ?** 2,3 à 3,1 % des pixels diffèrent entre ombres allumées et
  éteintes, à chaque cap ;
- **le rejet est-il engagé ?** 5 à 8 lots sur 17 sont cachés. Un premier comptage n'a lu que
  `mesh.visible` et annonçait 0 : c'est le GROUPE de la cellule que le premier étage éteint.

### Le défaut, mesuré

| cap | part ombrée | témoin `off`/`off` | **`grid` contre `off`** | piliers dessinés |
|---:|---:|---:|---:|---|
| 0 | 2,31 % | 0 | **2,03 %** | `off` oui · `grid` **non** |
| 10 | 2,66 % | 0 | **2,39 %** | `off` oui · `grid` **non** |
| 20 à 60 | 2,7 à 3,1 % | 0 | 0 | oui des deux côtés |

**Presque toute l'ombre disparaissait** — 2,03 % de pixels changés pour 2,31 % d'ombre — dès que le
caster sortait du champ, et revenait au cap 20 quand il y rentrait. C'est le pop. **[M]**

### Pourquoi ni `visible` ni un calque ne peuvent le corriger

`WebGLShadowMap.renderObject` de three 0.185, dans l'ordre : `if ( object.visible === false )
return;` puis `const visible = object.layers.test( camera.layers );` — et ce `camera` est la caméra
**de VUE**, pas la lumière. Les deux leviers que le dépôt utilise déjà pour retirer un objet de la
passe couleur le retirent donc aussi de la passe d'ombre. **Limiter le rejet à la passe couleur
n'est pas exprimable dans cette version de three.** **[C]**

### Ce qui a été fait à la place

**Un lot n'est rejeté que si NI LUI NI SON OMBRE n'atteignent le champ.** La boîte testée est
l'union de la boîte du lot et de cette même boîte tombée sur le sol le long de la lumière — le
volume balayé est leur enveloppe convexe, que cette union contient. `SceneRenderer` publie la
direction du soleil et le plancher de la scène (`ShadowThrow`), lus là où la caméra d'ombre est
déjà ajustée.

| après correction | |
|---|---|
| `grid` contre `off`, tous caps | **0 pixel** |
| lots encore cachés | **5 à 8 sur 17** — le rejet travaille toujours |
| 500 000 corps, ombres ALLUMÉES | **246 appels, 17 848 instances** |
| 500 000 corps, ombres éteintes | **246 appels, 17 848 instances** |

**Le balayage ne coûte rien de mesurable sur ce monde** : le soleil y est à 30° et les corps font
une à cinquante unités, donc la boîte grandit de trois unités pour un accessoire. Il coûtera sur un
soleil rasant et des casters hauts — c'est-à-dire exactement quand il est nécessaire. GPU sur ce
monde, ombres allumées : **4,24 → 1,61 ms**. **[M]**

**Ce que le décor a appris au passage** : la boîte d'un lot est grossie du rayon de sa sphère fois
l'étirement, **isotropiquement** — 76 unités pour un pilier de 5 × 87 × 5. Un décor calé à un degré
près ne rejetait donc jamais rien. Une boîte serrée sur la vraie enveloppe rejetterait davantage ;
ce n'est pas dans ce lot.

## 13. Étape 4 — la couche dynamique

`spike/webgpu/dynamicLayer{Bench.ts,.html}`, 500 000 corps, 40 frames de mouvement après chauffe.

**Ce qui est écrit.** Un corps qui passe par `moved` est promu **une fois pour toutes** sur le lot
de son groupe, hors de toute cellule : slot à vie, matrice réécrite en place, sortie par
**swap-remove** — la dernière instance recouvre le trou et le compte baisse d'un, là où un
`splice` décalerait toutes les matrices suivantes. Un mobile n'est **pas cullé** : une sphère
mesurée une fois est fausse à son premier pas.

### Ce que ça donne

| | mobiles | **couche, moyenne** | pic | 1re passe (promotion) | document, hors couche | meshes | statiques refaits |
|---|---:|---:|---:|---:|---:|---:|---:|
| `off` · 1 % | 5 015 | **1,24** | 5,30 | 5,76 | 1,32 | 1 235 → 1 235 | **0** |
| `grid` · 1 % | 5 015 | **2,29** | 6,59 | 22,01 | 2,82 | 6 912 → **6 920** | **0** |
| `off` · 5 % | 25 073 | **21,21** | 25,32 | 28,91 | 20,33 | 1 235 → 1 235 | **0** |
| `grid` · 5 % | 25 073 | **20,82** | 21,78 | 89,55 | 24,08 | 6 912 → **6 920** | **0** |

| spawn (200 corps retirés par passe, 12 passes) | `rebuild` seul | `apply` complet |
|---|---:|---:|
| `off` | 918 ms | 1 437 ms |
| `grid` | 1 271 ms | 1 617 ms |

**Ce qui marche, et qui est le contrat de l'étape** : **zéro mesh statique reconstruit** pendant le
mouvement, des deux côtés et aux deux taux. Huit lots de mobiles naissent (6 912 → 6 920), un par
groupe rencontré. Le swap-remove tient : un test vérifie que le dernier corps vient occuper le
trou plutôt que de décaler la suite. **[M]**

### 🛑 Ce que la mesure dit et qu'il faut lire en entier

**Le ×21 de C5-B2 § 4 ne se retrouve PAS en production, et c'est explicable : il était mesuré
contre une structure que la production n'a jamais eue.** B2 comparait la couche séparée à une
structure UNIQUE qui reconstruisait 947 meshes par frame de mouvement. Le `moved` de la production
écrit ses matrices en place depuis toujours — `instancing.ts` comme `cellInstancing.ts` — donc son
point de départ était déjà celui que B2 présentait comme l'arrivée : **0,90 ms mesuré par B2 pour
la couche séparée, 1,24 ms mesuré ici pour la production SANS couche, sur le même nombre de
mobiles.**

**Sur ces scénarios, la couche coûte plus qu'elle ne rend** : +1,05 ms à 1 % (mesuré deux fois,
+1,07 puis +1,05), et à parité à 5 %. La promotion est un coût ponctuel réel — **22 ms** pour
5 015 corps, **90 ms** pour 25 073 — payé à leur premier mouvement.

**Ce qu'elle rend n'est pas capté par ces scénarios** : une cellule cesse de grandir autour d'un
mobile, et aucun changement de contenu ne la reconstruit plus pour lui. Le décor de mesure déplace
les corps de 0,01 unité par frame, soit 0,4 unité en tout — une boîte de cellule ne s'en déforme
pas. Le bénéfice se verrait sur un mouvement long ou un changement de contenu fréquent ; **il n'est
pas mesuré ici, et je ne le présente pas comme acquis.** **[H]**

**Garder ou retirer la couche est donc une décision à prendre avec ces chiffres**, pas une
conclusion de ce rapport.

**Un défaut trouvé par la relecture adversariale, pas par la mesure** : `dispose` ne parcourait que
les cellules, et un lot de mobiles ne pend d'aucune d'elles — son mesh restait dans la scène et son
tampon d'instances sur le GPU. Le test de démontage existant ne promouvait aucun corps, donc il
passait vert sur exactement ce chemin. Corrigé, et tenu par un second cas qui promeut d'abord.

## 14. La couche dynamique, tranchée sur un VRAI déplacement

Le décor du § 13 déplaçait les corps de 0,4 unité en tout : il ne mesurait rien de ce que la
couche doit rendre. Celui-ci — `spike/webgpu/crossing{Bench.ts,.html}` — déplace **1 % des corps à
1 m par frame**, la vitesse `run` de C5-B0, sur 300 puis 900 frames. À un grain de 256, 300 frames
font **1,17 cellule** et 900 en font **3,52** : les deux sont donnés, parce que « 300 frames » et
« plusieurs cellules » ne tiennent pas ensemble à cette vitesse.

Le bras **sans couche** est le code d'avant l'étape 4 (`717f00e7b`), rejoué par le même banc.

### Sans la couche — le chemin en place ne tient pas

| 900 frames, 4 848 mobiles | `off` | **`grid` SANS couche** |
|---|---:|---:|
| corps **non dessinés** | 0 | **3 273 sur 4 848 (68 %)** |
| dérive maximale | 0 | **900 unités** |
| cellule la plus large | — | **531,8 → 2 142,2** (×4,03) |
| `moved`, moyenne | 2,49 | **7,72** |

**Un corps qui a quitté sa cellule n'est plus dessiné du tout dès que sa cellule d'origine sort de
la zone** : il part avec elle, et il en est parti 68 % au bout de 3,5 cellules. Et la boîte de la
cellule la plus large **quadruple**, parce qu'elle ne fait que croître autour des corps qui la
traversent — le rejet du § 8 s'émousse à mesure. **[M]**

🛑 **Sur cette caméra, cela n'a coûté AUCUN pixel** : les 3 273 absents étaient tous hors du champ
(`adriftInView = 0`). Le défaut est structurel et mesuré ; il ne s'est pas VU sur cette vue-là, et
je ne le présente pas autrement. Une caméra tournée vers leur destination le montrerait.

### Avec la couche

| | `off` | `grid` promotion | **`grid` déclaré** |
|---|---:|---:|---:|
| corps non dessinés | 0 | **0** | **0** |
| cellule la plus large | — | **531,8 → 531,8** | **531,8 → 531,8** |
| `moved`, 300 frames | 1,84 | 2,03 | **1,90** |
| `moved`, 900 frames | 2,55 | 3,21 | **2,61** |
| **première passe** | 5,44 | **19,3 à 23,0** | **5,4 à 5,9** |
| pixels contre `off` | — | **0** | **0** |

**Décision : la couche reste.** Le chemin en place sans elle n'est pas correct sur un vrai
déplacement — il perd les deux tiers des mobiles et laisse la boîte de cellule enfler d'un facteur
quatre. **[M]**

### Ce que la déclaration change

**Elle supprime le pic de première passe** : 19 à 23 ms de promotion pour 4 848 corps deviennent
**5,4 à 5,9 ms**, soit le coût de `off` lui-même (5,4). Un corps déclaré n'est jamais mis dans une
cellule, donc son premier mouvement n'a plus rien à promouvoir et aucune cellule n'est défaite pour
lui. En régime, la couche déclarée est à **+0,06 ms** de `off` à 300 frames et **+0,06** à 900 —
sous l'écart des témoins. La promotion reste, pour ce qui bouge sans l'avoir dit. **[M]**

Le modèle ne crée **aucun type neuf** : `movesOnItsOwn` lit `Movement`, `RigidBody` ou
`CharacterController`, que le dépôt déclare déjà — sa propre règle veut qu'un composant sans
système soit un champ de formulaire qui ne fait rien.

### Le défaut que la relecture a trouvé, et que la mesure ne pouvait pas voir

Un mobile déclaré qui **change de groupe** — une peinture ou une forme modifiée, la déclaration
inchangée — restait dans son ancien lot : **dessiné deux fois, dans deux matériaux, tant qu'il
continuait à se déclarer mobile.** `shed` demandait « ce corps a-t-il été vu ? » au lieu de « a-t-il
été vu POUR CE LOT ? ». Corrigé, et tenu par un test qui échoue à vue quand on remet la question
globale. **[C]**

## 15. Un défaut de banc, à ne pas repayer

**Une campagne qui enchaîne plusieurs tailles de monde dans la même page rend des relevés faux.**
Mesuré : `counts=500000,5000,500` a rendu un témoin `off` qui différait de `off` sur **2 972 888
pixels** et n'affichait pas les mêmes comptes (148 appels contre 159, 9 153 instances visibles
contre 9 116) — alors que rien du chemin `off` n'avait changé. Rejouées taille par taille, les deux
campagnes sont propres et le témoin retombe à 0 pixel. **Le relevé faux n'est pas conservé sur le
disque** : `c5p1-check.json` (500 000) et `c5p1-small.json` (5 000 et 500) sont ceux du tableau.

Douze moteurs montés dans une page, dont quatre portant 500 000 nœuds, dépassent ce que la page
tient. **Une taille de monde par campagne**, et le témoin `off` joué deux fois reste le seul juge
de la validité d'un relevé.

**Trois autres, payés sur le décor du § 14.** `redraw()` ne dessine pas, il **demande** une frame :
lire le canvas juste après rend un tampon quelconque, et la comparaison annonçait **85 % de pixels
différents entre deux rendus identiques** — on dessine soi-même et on lit dans la foulée. Une
vérification « chaque mobile est-il dessiné au bon endroit » écrite lot par lot est en O(mobiles ×
instances) et ne finit pas ; elle se fait en une passe sur les abscisses dessinées, puis par
recherche dichotomique. Et un groupe d'UN corps est sous le plancher d'instanciation, donc jamais
groupé : un décor qui fait changer un corps de groupe doit laisser les deux groupes au-dessus de
seize, sans quoi il ne mesure rien.

**Un incident sans perte, mais à connaître.** Les douze `RAPPORT-*.md` de `spike/webgpu/` ont
disparu du disque en cours de session alors qu'ils étaient suivis par git. Ce sont les gardes
larges — qui lisent chaque fichier suivi — qui l'ont signalé, et `git checkout` les a tous rendus :
rien n'était perdu, tout était commité. **La cause n'est pas établie** : ni `pnpm check`, ni
`pnpm format`, ni `run.mjs` ne le reproduisent, et `run.mjs` n'appelle aucune fonction de
suppression. Écrit ici parce qu'un fichier suivi qui s'efface sans bruit se reverra peut-être.

## 16. Ce que le lot ne fait pas

- Le CPU de soumission ne rejoint toujours pas la parité du § 1 : ×1,6 après l'étape 3, contre
  ×2,1 avant. Ce qui reste est le plafond du § 10.
- **Les cartes d'ombre d'une frame sont tracées pour la zone des PANNEAUX.** Un aperçu ou un film
  qui regarde ailleurs voit des corps dont l'ombre manque, jusqu'à ce que les cartes soient
  redemandées. Sous `off` la question ne se pose pas, toutes les cellules étant toujours là.
- **Aucun nombre de nœuds visités n'est publié par la production** : `worldPartition` le compte
  (`stats()`), mais rien ne l'expose au travers du contrat `InstancedGroups`. Le 45 du § 2 est
  celui du banc de spike ; le test unitaire tient la borne (< 80 pour une zone de 500 sur 10 000
  cellules).
- Un corps qui traverse une frontière de cellule **pendant un geste** reste dessiné par sa cellule
  d'origine jusqu'au prochain changement de contenu : `moved` élargit les bornes plutôt que de
  redécouper, comme `instancing.ts` le fait déjà pour ses régions. C'est l'étape 4 qui traite les
  mobiles.
- Ni C3 (LOD), ni l'activation par défaut.

## 17. Étape 5 — la grille par défaut

### État Git

Ouverture : worktree `.claude/worktrees/open-world`, branche `feat/open-world`, `db1b0b6e1`,
**arbre propre**. Clôture : `18c2ad464`, **arbre propre**, deux commits — le défaut, puis le banc
des scènes du studio. Aucun fichier suivi n'a disparu du disque cette session (l'incident du § 15
ne s'est pas reproduit ; `git status` a été lu quatre fois).

### Ce qui a changé

**Un seul endroit lit le flag, et c'est tout ce qu'il a fallu toucher** : `groupsFor`, dans
`SceneRenderer.ts`. Aucun appelant de production ne passait `partition` — ni `SceneDocument`, ni
`GameWindow`, ni `sceneStage` — et **rien dans `docs/` ne le mentionne**. Le défaut se décide donc
là, exactement comme celui de `grouping`.

```ts
const partition = options.partition ?? (options.grouping ? 'off' : 'grid')
```

**Nommer un `grouping` est ce qui fait sortir des cellules.** Sans cette moitié, un appelant qui
demande `batched` recevrait la grille et le mot n'aurait plus de sens ; `partition` explicite bat
toujours les deux. `off` reste disponible **comme option du moteur**, au même titre que `batched`
— **il n'y a pas de réglage utilisateur**, ni pour l'un ni pour l'autre, et ce lot n'en crée pas.

### `pnpm validate` dans les deux positions

| position | résultat |
|---|---|
| défaut `grid` (le commit) | **vert** — 1 163 fichiers, **15 023 tests**, 78 s |
| défaut `off` forcé sur place | **vert** — 1 163 fichiers, **15 023 tests** |

**Aucun test du dépôt ne supposait le défaut `off`** : la suite entière passe avec la partition
active, sans une ligne touchée. **[M]**

### Les images du banc, campagne par taille

`productionPartition`, une taille de monde par campagne (§ 15), `off` joué deux fois.

| | témoin `off`/`off` | `grid` contre `off` | `gridWide` contre `off` |
|---|---:|---:|---:|
| 500 000 | **0** | **2** — `1268,808` et `1452,1165`, écart 35 | **2**, mêmes coordonnées |
| 5 000 | **0** | **0** | **0** |
| 500 | **0** | **0** | **0** |

**Aucun pixel nouveau.** Les deux acceptés sont aux mêmes coordonnées et de la même valeur qu'à
l'étape 3. **[M]**

Les chiffres de la campagne, pour mémoire. **Deux passes de 500 000** ont été jouées, avant et
après les corrections de la revue : **appels, instances et images identiques au chiffre près** des
deux fois ; seuls les temps bougent avec la charge de la machine, ce qui est le rappel utile —
ces colonnes-là ne se comparent qu'à leur propre témoin.

| 500 000, passe finale | `off` | témoin | **`grid`** |
|---|---:|---:|---:|
| `gl.render` CPU | 0,679 | 0,746 | **0,888** |
| GPU | 3,542 | 3,440 | **1,286** |
| appels | 159 | 159 | **246** |
| instances | 231 397 | 231 397 | **17 848** |

### La scène produit la plus lourde — et ce qu'elle ne mesure pas

**🛑 Le dépôt ne porte aucune scène produit lourde, et c'est le résultat le plus important de ce
paragraphe.** Les candidates sont les neuf modèles de `sceneTemplates`, seules scènes que le studio
livre ; il n'y a ni `.gltf` ni projet dans l'arbre. Pesées avant toute mesure :

| modèle | nœuds | meshes |
|---|---:|---:|
| `firstPerson` · `thirdPerson` · `topDown` | **38** | 32 |
| `postProcessing` | 9 | 4 |
| `photoStudio` | 6 | 2 |
| `basic` · `cinematic` | 5 | 1 à 2 |
| `empty` · `archvis` | 3 | 0 à 1 |

Les trois plus lourdes sont ex æquo — elles ouvrent sur le même `playgroundLevel` et ne diffèrent
que par la caméra. `firstPerson` et `thirdPerson` mesurées :

| 38 nœuds | `off` | témoin `off` | **`grid`** |
|---|---:|---:|---:|
| `gl.render` CPU | 0,229 | 0,272 | **0,238** |
| `follow` | 0,000 | 0,000 | **0,008** |
| GPU | 0,349 | 0,413 | **0,538** |
| appels · instances · triangles | 51 · 47 · 1 372 | idem | **51 · 47 · 1 372** |
| `InstancedMesh` construits | **0** | 0 | **0** |
| pixels contre `off` | — | **0** | **0** |

**La partition n'y regroupe RIEN et ne peut rien y changer** : les 32 corps du niveau sont tous
différents, aucun groupe n'atteint `WORTH_INSTANCING` (16), donc les deux côtés dessinent les mêmes
51 appels. Les écarts de temps sont sous le témoin — qui s'écarte de `off` de 0,043 ms en CPU et de
0,064 ms en GPU sur `firstPerson`, et de 0,196 ms en GPU sur `thirdPerson`. **Une régression
annoncée ici serait une lecture de bruit.** Le seul coût réel est la requête de zone sur un index
vide : **0,006 à 0,008 ms**, 64 macro-chunks visités pour zéro cellule. **[M]**

**Ce relevé est donc vert pour une mauvaise raison**, et l'écrire autrement serait mentir. Les
gestes d'édition ont été rejoués sur un monde où la partition MORD — `openWorld` à 5 000 corps, le
seul du dépôt dont un groupe passe le plancher.

### Les cinq gestes d'édition

`spike/webgpu/productLevel.{ts,html}`. Les commandes sont **celles du studio** (`addNode`,
`setTransform`, `removeNode`) et **l'undo est leur propre `revert`** — rejouer un état mémorisé à
la main prouverait que le banc sait revenir en arrière, pas que le studio le sait. Le glisser
multi-sélection passe par `groups.moved`, jamais par un `apply` : c'est le chemin qu'un geste
emprunte entre son début et son relâchement.

| geste | `firstPerson` · `thirdPerson` (38 nœuds) | `world:5000`, caméra DANS le niveau |
|---|---:|---:|
| ouverture | 0 | **0** |
| ajout d'un corps | 0 | **0** |
| déplacement d'un objet | 0 | **0** |
| glisser multi-sélection (6 corps) | 0 | **0** |
| relâchement rendu au document | 0 | **0** |
| suppression | 0 | **0** |
| undo de l'ajout | 0 | **0** |

**Zéro pixel sur les sept étapes, des deux décors**, témoin `off`/`off` à 0 partout. À 5 000 la
partition travaille vraiment : 51 → 124 appels, 35 → 108 lots, 4 cellules connues. **[M]**

### 🛑 Ce que la vue de DEHORS montre, et que rien n'avait mesuré

**Le même décor à 5 000, cadré par `frameContents` au lieu d'une caméra posée dedans, rend
412 pixels d'écart entre `off` et `grid`** — témoin `off`/`off` à **0**. C'est le seul résultat
rouge du lot, et il est expliqué :

| contrôle | pixels | écart max |
|---|---:|---:|
| caméra DANS le niveau | **0** | 0 |
| cadré de dehors, ombres allumées | **412** | 24 sur 765 |
| cadré de dehors, ombres **éteintes** | **376** | 11 sur 765 |

**Ce n'est pas la zone, et ce n'est pas l'ombre.** Les instances DESSINÉES sont identiques au
chiffre près des deux côtés — **5 030 contre 5 030**, 5 016 instances soumises contre 5 016 :
sur cette vue la partition ne retire rien, elle réordonne. Et les teintes le disent : `37,38,35`
contre `37,39,35`, `69,72,66` contre `70,74,67` — des voisines à un ou deux crans, jamais un corps
contre du ciel. Éteindre les ombres n'enlève que 36 pixels et fait tomber l'écart max de 24 à 11.

**C'est la cause [H] des deux pixels du § 4, à une autre échelle** : une vue qui met 5 000 corps à
distance dans un seul cadre multiplie les silhouettes où le tampon de profondeur départage deux
surfaces autrement selon l'ordre de dessin. **La règle « 0 pixel » du lot ne tient donc pas sur une
vue qui cadre tout un monde de l'extérieur** — 0,012 % des pixels, 3 % d'écart maximal par canal.
**[M]** pour tout, sauf la cause, **[H]**.

### Ce que la revue a corrigé, et ce qu'elle a laissé

**Trois corrections de production, toutes trouvées par relecture et aucune par la mesure :**

1. **La JSDoc de `grouping` affirmait encore « `instanced` — the default ».** Elle et celle de
   `partition` se contredisaient à six lignes d'écart dans le même type, et **aucune garde ne voit
   ça**. Elle dit désormais ce que la ligne fait : nommer un `grouping` éteint la partition.
2. **`sceneRendererGroups.test.ts` épinglait encore `{ partition: 'grid' }`** là où son
   commentaire annonçait le défaut. **Rien n'exerçait donc le nouveau chemin** — le défaut pouvait
   repasser à `off` sans qu'un cas rougisse. L'entrée est maintenant `{}`, et c'est elle qui tient
   le défaut.
3. L'alias `const partition = …` d'un seul usage, portant le nom du champ qu'il ne valait pas, est
   inliné.

**Trois corrections de banc, dont une qui change ce que le banc PROUVE :** le relâchement d'un
glisser écrivait **six** `setTransform`, là où le studio écrit **une** commande par geste
(`moveNodes`, « One drag, one entry, however many nodes moved »). Le banc promettait « les vraies
commandes » et ce pas-là n'était pas le geste du studio. Corrigé — **et les images sont
identiques**, avant comme après. Les deux autres : l'état du monde était rebâti **six fois** par
campagne (mémoïsé), et une frame entière était dessinée puis jetée avant chaque boucle de cycles.

**Laissé, et pourquoi.** Les huit bancs de `spike/webgpu/` partagent un montage de moteur, un
`draw` et une boucle de cycles quasi identiques ; seuls `hostOf` et `differing` ont été hissés dans
`benchShared.ts` — un `mountBench` commun est une refonte des huit, hors de ce lot. **`spike/` n'est
ni linté, ni formaté, ni typechecké, ni mesuré par jscpd** (`.jscpd.json` porte sur `src` seul) :
aucune de ces duplications ne peut rougir, c'est la relecture ou rien.

### Deux constats de la revue qui ne sont pas des correctifs

**🛑 La couverture s'est déplacée sans que rien le dise.** **33 montages de `SceneRenderer`** dans
les tests d'`engines/scene/` ne passent aucun flag : ils basculent **tous** sur `createCellGroups`.
Aucun n'affirme quoi que ce soit sur `InstancedMesh` ou `BatchedMesh`, donc rien ne rougit — mais
le chemin `instanced`, ci-devant défaut, n'est plus exercé au niveau moteur que par le
`grouping: 'instanced'` explicite de `sceneRendererGroups.test.ts`. **C'est écrit ici parce que
personne d'autre ne l'écrit.**

**`follow` n'a aucun plancher.** Tout moteur qui ne nomme pas de `grouping` paie désormais, par
frame, une requête de zone et une boucle sur les cellules debout — y compris sur une scène qui ne
regroupe rien. **Mesuré sur les modèles du studio : 0,006 à 0,008 ms**, 64 macro-chunks visités
pour zéro cellule, soit 0,05 % d'un budget de 16 ms. Une sortie anticipée quand l'index est vide
est le correctif naturel ; il n'est pas dans ce lot, et 0,008 ms ne le justifie pas seul.

### Défauts hors périmètre trouvés

- **`spike:apply` est rouge et l'était déjà** : `tsc -p spike/webgpu/tsconfig.json` rend **six**
  erreurs, dans `batchedCells`, `partitionBench`, `spatialGrid`, `submissionProbe`, `worldBench` et
  `worldBodies` — aucune dans le code de ce lot. Non corrigé : hors du lot, et hors de
  `pnpm validate`, qui ne lit pas ce tsconfig.
- Les trois défauts de `SceneRenderer` signalés au § 7 (`withHungUnder`, `onGizmoChange`,
  `refreshAids`) n'ont pas été touchés — ils ne bloquent pas le défaut, et le glisser
  multi-sélection du banc passe par `moved`, qui n'est pas leur chemin.

### Ce qu'il faudrait pour merger `feat/open-world`

1. **L'arbitrage sur les 412 pixels de la vue cadrée de dehors.** Le lot a été livré sous la règle
   « 0 pixel » ; elle ne tient plus sur cette vue-là. Aucun corps n'est perdu et l'écart est de
   3 % par canal au pire, mais c'est à l'utilisateur de dire si l'ordre de dessin est un prix
   acceptable — la réponse conditionne le reste.
2. **La passe d'ombre dessine encore tout le monde.** C'est le lot suivant, annoncé comme tel : le
   rejet du § 8 ne travaille que sur la passe couleur, et les cartes d'une frame restent tracées
   pour la zone des PANNEAUX (§ 16) — un aperçu ou un film qui regarde ailleurs voit des ombres
   manquantes jusqu'à ce qu'elles soient redemandées.
3. **Le CPU de soumission reste à ×1,3 du témoin** (0,546 → 0,713 sur 500 000), plafonné par les
   27 lots par cellule du § 10. Ce n'est pas un bloqueur, c'est un chiffre à assumer.
4. **Rien n'a jamais été mesuré sous Windows ni sous Linux** : la porte ne tourne que sur
   `ubuntu-latest` et ne joue aucun de ces bancs, qui exigent une fenêtre Electron et un contexte
   WebGL. Ce que ce lot affirme, il l'affirme sur ce Mac.
5. Le rebase sur `develop` et un `pnpm validate` vert **après** lui — non fait : `develop` porte
   **50 commits** que cette branche n'a pas, la base commune étant `04b1b6457`.
6. **Une décision à prendre, pas un bloqueur : fusionner `partition` et `grouping` en une seule
   union.** Ce ne sont pas deux axes — les trois fabriques ont la MÊME signature, et
   `{ partition: 'grid', grouping: 'batched' }` typecheck en jetant `grouping` en silence.
   `partition: 'off'` ne veut pas dire « pas de partition », il veut dire « instanced » : le flag
   ment sur son nom. Un `draw?: 'instanced' | 'batched' | 'grid'`, défaut `grid`, plus une table,
   ferait disparaître le ternaire de couplage et rendrait les états illégaux inécrivables — 2 types,
   1 test de `src/`, ~6 fichiers de `spike/`. **Le croisement « grille de lots batchés » est déjà
   mesuré-perdant** (C5-B2 § 3), donc rien d'orthogonal n'est à préserver. Hors de ce lot.
