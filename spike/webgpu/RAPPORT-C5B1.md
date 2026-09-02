# C5-B1 — spike World Partition : grille hiérarchique contre loose quadtree

Sources : **[M]** mesuré · **[C]** lu dans le code · **[H]** hypothèse.

## 1. État Git

Worktree `.claude/worktrees/open-world`, branche `feat/open-world`, partie de `feat/shadow-view`.
Aucune branche créée. **Diff `src/` contre `feat/shadow-view` : VIDE**, avant comme après. Tout vit
dans `spike/webgpu/`. Le typecheck de `spike/` n'est couvert par aucune gate ; monté à la main sur
les onze fichiers du banc : **zéro erreur**. **[M]**

## 2. Mesurer sous le clamp

`run.mjs` sert désormais la page en **isolation cross-origin** (`COOP: same-origin` +
`COEP: require-corp`). Relevé dans chaque ligne de résultat : `crossOriginIsolated: true`,
**plus petit pas d'horloge non nul = 0,005 ms**. Un critère à 0,05 ms tient donc sur dix pas. **[M]**

🛑 **Lever le clamp n'a pas suffi, et c'est le principal enseignement de méthode.** Trois passes
séparées ont donné 0,318 · 0,105 · 0,188 ms pour le MÊME natif — un facteur 3. La variance ne
venait pas de l'horloge mais de deux causes trouvées l'une après l'autre :

1. **la stratégie mesurée en premier portait tout le démarrage** — corrigé en alternant les
   stratégies dans un seul processus ;
2. **construire et détruire 6 075 `InstancedMesh` entre deux mesures** rendait le ramasse-miettes
   actif dans la fenêtre suivante — corrigé en construisant toutes les stratégies UNE fois et en
   ne les détruisant qu'à la fin.

Après les deux, la dispersion tombe à ±20 % et les médianes se comparent. **Toutes les mesures du
§ 6 sont prises ainsi : 12 cycles, stratégies gardées, alternées.** **[M]**

## 3. 🛑 Trois défauts du banc, et ce qu'ils invalident

| défaut | ce qu'il produisait | invalide |
|---|---|---|
| **deux stratégies partageant un `CellPlan`** — un `Group` n'appartient qu'à une scène, donc la seconde construite VOLAIT les cellules de la première | la grille rendait **0 instance en 0,043 ms**, ce qui se lisait comme une victoire écrasante | `c5b1-cycles2.json`, jeté |
| un champ `buildMs` de l'index écrasant celui de la stratégie | le temps de prébuild était perdu | corrigé avant toute conclusion |
| attendre l'apparition du fichier de sortie | `run.mjs` écrit un PARTIEL à chaque sondage : j'ai lu une passe tronquée (4 lignes sur 6) | `c5b1-rep3.json`, écarté |

## 4. La couche commune — instancing par cellule

Grille 2D régulière, côté fixé **indépendamment** de la structure de recherche. Un `InstancedMesh`
par (cellule, lot), un lot étant la paire (géométrie, matériau) — **exactement ce sur quoi la
production regroupe**, donc le témoin et les deux candidats partagent le même découpage en lots et
ne diffèrent QUE par l'espace. **[C]**

**Surdimensionnés** : un corps dont la demi-diagonale au sol dépasse la moitié d'une cellule sort
dans une liste à part. À 500 000 et grain 256, ce sont **1 444 corps — toutes les dalles de sol**,
et elles seules (empreinte 100, demi-diagonale 70,7). Elles se regroupent par lot en un seul
`InstancedMesh` toujours dessiné : coût fixe de 1 444 instances et 17 328 triangles. **[M]**

### Le grain — trois points, une conclusion

500 000 corps, `D_active` 500, repos. Natif 27k pour comparaison : 0,169 ms, 91 meshes, 25 157
instances, GPU 2,23.

| cellule | cellules | meshes prébâtis | actives | calls | instances | submit | **TOTAL** | GPU | nœuds | matrices |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 64 | 3 600 | 91 871 | 223 | 1 694 | 10 852 | 2,625 | **2,687** | 1,89 | 585 | 30,5 Mo |
| 128 | 900 | 23 398 | 62 | 567 | 13 714 | 0,740 | **0,766** | 1,53 | 153 | 30,5 Mo |
| **256** | 225 | 6 075 | 20 | 244 | 20 462 | 0,417 | **0,425** | 2,32 | 45 | 30,6 Mo |
| 512 | 64 | 1 728 | 9 | 136 | 45 774 | 0,276 | **0,285** | 2,95 | 18 | 30,6 Mo |

**Le CPU suit le nombre de MESHES, pas le nombre d'instances** — c'est la relation qui commande
tout le reste : 244 meshes contre 91 chez le natif font 2,68× ; le CPU fait 2,67×. **[M]**

**256 est retenu** : 128 crée trop de meshes, 512 dessine 45 774 corps et dépasse le plafond de
37 736. Le compromis est bloqué des deux côtés — moins de meshes signifie plus d'instances
dessinées, et l'un ou l'autre casse un critère.

### Prébuild contre à la demande

| | prébuild (ms) | matrices | repos | pic course | **pic frontière** | dont `activeSet` | meshes bâtis d'un coup |
|---|---:|---:|---:|---:|---:|---:|---:|
| grille · prébuild | 127,7 | 30,5 Mo | 0,964 | 5,63 | **2,98** | 0,04 | 0 |
| grille · à la demande | 0 | 2,2 Mo | 0,900 | 7,08 | **8,44** | 6,30 | 624 |
| quadtree · prébuild | 121,5 | 30,5 Mo | 0,950 | 2,55 | **2,88** | 0,03 | 0 |
| quadtree · à la demande | 0 | 2,2 Mo | 0,957 | 13,42 | **11,77** | 9,40 | 624 |

> **Le prébuild est retenu, et c'est une mesure qui le dit.** À la demande économise 28 Mo mais
> paie des pics de 8,4 à 11,8 ms aux frontières — **au-dessus du budget de 8,3 ms d'une frame à
> 120 Hz** — dont 6,3 à 9,4 ms rien qu'à bâtir 624 meshes d'un coup. **[M]**

## 5. Les deux index

**A — grille hiérarchique** : macro-chunks 512 au-dessus des cellules 256. Un macro-chunk vide ne
se visite jamais. Index : **5 Ko**, construit en **0,30 ms**. **[M]**

**B — loose quadtree** : feuilles alignées sur les cellules. **Facteur de relâchement = 1**, et
c'est une mesure qui le justifie : les corps débordants sont déjà sortis dans `oversized`, donc une
feuille ne tient que des corps dont l'empreinte au p99 vaut 1,6 % d'elle-même. Un facteur 2 —
l'habitude de la littérature — élargirait les boîtes sans rien rattraper. Index : **76 Ko**,
construit en **0,61 ms**. **[M]**

## 6. Tableau principal — 500 000 / `D_active` 500 / uniforme / grain 256

12 cycles alternés, stratégies gardées. Médiane, avec min et max.

| | CPU min | **CPU méd** | CPU max | instances | draw calls | GPU | nœuds visités |
|---|---:|---:|---:|---:|---:|---:|---:|
| **natif 27k** | 0,116 | **0,169** | 0,247 | 25 157 | 75 | 2,23 | — |
| 500k · témoin production | 0,317 | **0,448** | 0,610 | 223 488 | 125 | 3,26 | — |
| 500k · **A grille** | 0,329 | **0,451** | 0,549 | **20 462** | 244 | **1,97** | **45** |
| 500k · **B quadtree** | 0,354 | **0,449** | 0,582 | **20 462** | 244 | 2,20 | 65 |

Décomposition du CPU au repos (grain 128, où les couches sont les plus lisibles) : `spatialQuery`
0,014 · `activeSetUpdate` 0,007 · `visibility` 0,000 · `sceneSubmission` 0,956. **La recherche et
l'ensemble actif ne pèsent rien ; tout est dans la soumission.** **[M]**

🛑 **`visibility` lit zéro et ce n'est pas un oubli** : la visibilité est portée par l'appartenance
au graphe — une cellule hors zone n'est pas attachée à la scène, donc three ne la parcourt jamais.
Il n'y a pas de couche à isoler. **[C]**

## 7. Scaling

| monde | | CPU | ×témoin | instances | calls | GPU | nœuds |
|---:|---|---:|---:|---:|---:|---:|---:|
| 500 | témoin | 0,110 | 1,00 | 504 | 27 | 0,29 | — |
| 500 | A | **0,118** | 1,08 | 504 | 27 | 0,27 | 10 |
| 500 | B | 0,098 | 0,89 | 504 | 27 | 0,28 | 1 |
| 5 000 | témoin | 0,124 | 1,00 | 5 016 | 35 | 0,75 | — |
| 5 000 | A | **0,185** | 1,49 | 5 016 | 108 | 0,73 | 13 |
| 50 000 | témoin | 0,192 | 1,00 | 44 040 | 107 | 2,41 | — |
| 50 000 | A | 0,386 | 2,02 | **18 244** | 217 | **1,69** | 27 |
| 200 000 | témoin | 0,289 | 1,00 | 109 368 | 109 | 2,82 | — |
| 200 000 | A | 0,349 | 1,21 | **18 170** | 217 | **1,72** | 33 |

## 8. Amas contre uniforme — 500 000

| | CPU | instances | calls | GPU | nœuds |
|---|---:|---:|---:|---:|---:|
| témoin | 0,462 | 224 024 | 140 | 3,75 | — |
| A | 0,493 | 22 724 | 243 | 2,45 | 45 |
| B | 0,490 | 22 724 | 243 | 2,21 | 65 |

À 3 % près des chiffres uniformes : **la répartition ne départage rien**, ce qui retire au quadtree
l'avantage qu'on lui prêtait sur une densité inégale. **[M]**

## 9. Trajectoires — 500 000, grain 256

Ratios rapportés au repos de chaque candidat (A : 0,360 ms · B : 0,499 ms).

| | | moy | p95 | p99 | **pic** | instances |
|---|---|---:|---:|---:|---:|---:|
| marche | A | ×1,12 | ×1,44 | ×1,64 | ×1,93 | 20 462 |
| | B | ×1,09 | ×1,23 | ×1,26 | ×1,29 | 20 777 |
| course | A | ×1,06 | ×1,43 | ×1,69 | **×3,53** | 20 535 |
| | B | ×1,16 | ×1,34 | ×1,46 | ×2,13 | 20 770 |
| rotation | A | **×1,39** | **×1,65** | ×2,00 | **×4,08** | 20 451 |
| | B | ×1,25 | ×1,48 | **×2,83** | **×3,04** | 20 531 |
| vue haute | A | ×1,69 | ×1,88 | ×1,94 | ×2,01 | 26 903 |
| | B | ×1,21 | ×1,42 | ×1,59 | ×2,93 | 26 903 |

**En absolu les pics valent 1,47 ms (A) et 1,52 ms (B)** — six fois sous le budget d'une frame. Le
critère est en RATIO, et un ratio sur une base de 0,36 ms amplifie un bruit de 1 ms. **[M]**

## 10. Frontière

| | moy | p95 | p99 | pic | `activeSet` pic | instances |
|---|---:|---:|---:|---:|---:|---:|
| A | ×1,32 | ×1,50 | ×1,64 | ×2,44 | **0,010 ms** | 18 552 |
| B | ×1,12 | ×1,28 | ×1,45 | ×2,03 | **0,010 ms** | 18 942 |

**Traverser une frontière ne coûte rien** — 0,010 ms d'ensemble actif — parce que le prébuild rend
l'entrée d'une cellule gratuite. C'est le gain que la politique achète avec ses 30 Mo. **[M]**

## 11. Téléportation

| | pic | budget | convergence | cellules entrantes |
|---|---:|---:|---:|---:|
| A | **0,80 ms** | 8,3 ms | **2 frames** | 15 |
| B | **0,685 ms** | 8,3 ms | **1 frame** | 15 |

Dix fois sous le plafond, convergence immédiate. **GO net pour les deux.** **[M]**

## 12. 🛑 Dynamique — le blocage majeur

1 % des corps (5 014) déplacés d'un mètre par frame, 120 frames :

| | `update` moy | p99 | pic | changements de cellule / frame | **meshes refaits** (moy / pic) |
|---|---:|---:|---:|---:|---:|
| A | **17,54 ms** | 24,56 | 25,31 | 20 | **947 / 1 350** |
| B | **17,04 ms** | 27,55 | 27,68 | 20 | **941 / 1 485** |

> **La structure unique ne tient pas.** Vingt changements de cellule par frame suffisent à refaire
> près de mille `InstancedMesh`, parce qu'un lot est un tableau contigu de matrices : en retirer
> une au milieu décale tout, et la cellule entière est reconstruite. 17,5 ms contre un budget de
> 8,3. **[M]**

Les couches statiques, elles, ne bougent pas : la soumission passe de 0,36 à 0,78 ms, ce qui est le
coût des instances déplacées, pas une dégradation de l'index.

**Ce que C5-B0 posait en hypothèse est maintenant mesuré** : il faut un **index séparé pour les
dynamiques**, où un corps qui bouge réécrit sa matrice sans reconstruire de lot. Non implémenté
ici — c'est un changement de conception, pas un réglage. **[H]**

## 13. Petite scène et seuil de bypass

À 500 corps : A coûte **+0,008 ms** (0,118 contre 0,110) et B **−0,012**. Sous le plafond de
+0,05 ms : **GO**. **[M]**

À 5 000 : A coûte **+0,061 ms** et ne rejette **rien** — 5 016 instances des deux côtés.

**Le seuil ne doit pas se dire en objets mais en géométrie**, et la mesure le montre : à 5 000 le
monde fait 190 de demi-côté, donc il tient ENTIER dans une zone active de 500 et la partition n'a
rien à retrancher. À 50 000 (demi-côté 600 > 500) elle divise les instances par 2,4.

> **Bypass proposé : ne bâtir aucun index tant que l'étendue du monde ne dépasse pas `D_active`.**
> Avec la densité du banc, cela tombe à ≈ 35 000 corps, mais c'est la GÉOMÉTRIE qui décide, pas le
> compte — un monde de 2 000 objets très étalés doit être partitionné, un monde de 100 000 objets
> serrés ne le doit pas. **[M]** pour la mesure, **[H]** pour la formulation générale.

## 14. Critères d'acceptation

Natif 27k mesuré dans CE harnais : 0,169 ms · 25 157 instances · GPU 2,23.

| critère | seuil | A grille | B quadtree | verdict |
|---|---|---|---|---|
| passe CPU totale | ≤ 0,338 ms | 0,451 (×2,67) | 0,449 (×2,65) | 🛑 **NO-GO** les deux |
| objets dessinés | ≤ 37 736 | **20 462** | **20 462** | ✅ GO |
| GPU | ≤ 3,35 ms | **1,97** | **2,20** | ✅ GO |
| nœuds visités | ≤ 128 | **45** | **65** | ✅ GO |
| petite scène 500 | ≤ +0,05 ms | **+0,008** | **−0,012** | ✅ GO |
| mouvement, moy ≤ 1,2× | | course 1,06 ✅ · rotation **1,39** | course 1,16 ✅ · rotation 1,25 | 🛑 NO-GO (rotation) |
| mouvement, pic ≤ 3× | | course **3,53** · rotation **4,08** | rotation **3,04** | 🛑 NO-GO les deux |
| téléportation | ≤ 8,3 ms · ≤ 10 frames | **0,80 ms · 2 f** | **0,685 ms · 1 f** | ✅ GO |
| dynamique 1 % | budget de frame | **17,54 ms** | **17,04 ms** | 🛑 **NO-GO** les deux |

**Cinq critères sur huit passent pour les deux candidats. Trois bloquent.**

### Ce qui bloque, et de combien

1. **CPU total : ×2,67 contre ×2,00 demandé.** Dépassement de 33 %. La cause est mesurée et
   structurelle : le CPU de soumission est linéaire en nombre de meshes, et le nombre de meshes
   vaut `cellules actives × lots présents`. Avec 27 lots dans ce monde, descendre à 182 meshes
   imposerait 512 de cellule — qui casse alors le critère « objets dessinés ». **Le témoin
   production échoue lui aussi ce critère (×2,65)** : il ne sépare donc pas les architectures, il
   dit que le natif 27k n'est pas une cible atteignable par une partition à 27 lots. **[M]**
2. **Pic de mouvement : ×3,53 à ×4,08 contre ×3 demandé.** En ABSOLU, 1,47 et 1,52 ms — six fois
   sous le budget d'une frame. Le critère en ratio se retourne contre un candidat dont le repos est
   bas : plus la base descend, plus un bruit fixe d'une milliseconde paraît grand. **[M]**
3. **Dynamique : 17,5 ms.** Le seul blocage qui exige un changement de conception. **[M]**

## 15. Recommandation : **A, la grille hiérarchique** — mais l'écart est mince

Sur le CPU les deux sont **indépartageables** : 0,451 contre 0,449, soit 0,4 % d'écart pour une
dispersion de ±20 %. Aucune mesure ne les sépare là. Ce qui les sépare :

| | A grille | B quadtree | avantage |
|---|---:|---:|---|
| nœuds visités | 45 | 65 | A, −31 % |
| mémoire d'index | 5 Ko | 76 Ko | A, ×15 |
| construction | 0,30 ms | 0,61 ms | A, ×2 |
| GPU | 1,97 | 2,20 | A, −10 % |
| pics en mouvement | ×3,53 / ×4,08 | ×2,13 / ×3,04 | **B** |
| téléportation | 2 frames | 1 frame | **B** |

**A est recommandée** pour les nœuds visités, la mémoire, la construction, et surtout parce qu'un
retrait/insertion en O(1) sur une grille est le geste dont le dynamique aura besoin — le point qui
bloque aujourd'hui. **[M]** pour les chiffres, **[H]** pour le dernier argument.

**B est meilleure sur les pics**, et cet avantage n'est pas expliqué. Si le NO-GO « pic de
mouvement » devait être tenu tel quel, B redeviendrait le candidat. **[M]**

## 16. Ce qu'il faudra pour composer avec C3

Le LOD choisit un niveau par corps selon sa taille écran ; la partition choisit quelles cellules
considérer. Deux conditions pour qu'ils se composent :

- le rig de C3 se construit en traversant la scène et en prenant tout `InstancedMesh` d'une forme
  connue **[C]** — or les cellules entrent et sortent du graphe. Le rig devrait donc se construire
  PAR CELLULE et suivre son cycle de vie, ou lire le plan plutôt que la scène. **[H]**
- C3 mesurait 648 étagères pour un rig ; par cellule active, cela ferait 20 × ses étagères.
  L'interaction n'est pas mesurée. **[H]**

**Aucune composition n'a été tentée ici**, comme le brief l'exige : B1 devait prouver que la
partition tient seule, et le § 14 dit qu'elle ne tient pas encore.

## 17. Plan de migration proposé — non exécuté

1. **Régler d'abord le dynamique** : index séparé, matrices réécrites en place, aucun lot
   reconstruit. C'est le seul blocage de conception.
2. **Rejouer les huit critères** sur la structure corrigée, et **reformuler les deux critères en
   ratio** — CPU et pic de mouvement — en seuils ABSOLUS, un ratio sur une base de 0,17 ms
   n'étant pas mesurable de façon stable sur cette machine.
3. **Brancher derrière un flag**, comme C1 l'a fait pour `batched` : l'ancien chemin reste le
   défaut, le nouveau se mesure sur les scènes du produit.
4. **Poser le bypass géométrique** du § 13 et vérifier qu'il ne coupe ni 500 ni 5 000.
5. **Capturer l'image à chaque étape** : trois défauts majeurs de ce chantier n'ont été trouvés que
   par les pixels ou par un contrôle, jamais par un tableau.
6. **Puis seulement** composer avec C3.

## 18. Hors périmètre, noté

- **Ombres** : la partition permettrait `castersInfluencing(zone)` — les cellules dont la boîte
  étendue le long de l'axe de la lumière coupe la zone visible. Non implémenté, non mesuré. **[H]**
- **Streaming, UI, mode AUTO, C3** : rien touché.
- Le défaut `near`/`far` des cartes d'ombre de C5-A reste ouvert.
