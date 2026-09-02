# C5-B0 — zone active, données réelles, et choix d'architecture

Chaque affirmation porte sa source : **[M]** mesurée sur ce banc · **[C]** lue dans le code
existant · **[H]** hypothèse à vérifier en C5-B1.

## 1. État Git

Worktree `.claude/worktrees/open-world`, branche **`feat/open-world`**,
partie de `feat/shadow-view`. Aucune branche créée pour ce lot. Arbre propre au départ,
`TRIANGLES_PER_REGION` à `150_000`. **Aucune ligne de production modifiée**, avant comme après.

Mesuré le 2026-09-02, Apple M2 Max, Electron 43 / Chromium 150, three 0.185.1, WebGL.
Fenêtre 1600 × 900 CSS, **tampon 2400 × 1350** (`pixelRatio` 1,5, relevé dans chaque ligne).

🛑 **Le banc a d'abord été réparé.** Une revue a trouvé six défauts, dont trois touchant des
chiffres publiés en C5-A : la résolution était annoncée 1600 × 900 alors que `configure` repose
`pixelRatioFor('balanced')` = 1,5 · la vue haute, posée à `span × 0,5`, mesurait un **clipping** à
500 000 · `placeView` planifiait une seconde frame non mesurée, donc les scénarios mobiles
dessinaient **deux fois par frame**. Corrigés ; `rest` et `teleport`, qui portent les conclusions
de C5-A, n'étaient touchées par aucun des deux derniers. Les huit comptes exacts sont identiques
après correction. **[M]**

## 2. C5-B0.1 — le balayage de la zone active

500 000 corps, densité constante, span 1 897, répartition uniforme, caméra à hauteur d'yeux, repos.

| `far` | dans la zone | dans le frustum | **dessinés** | dessinés / frustum | régions vues | triangles | GPU | passe CPU |
|------:|-------------:|----------------:|-------------:|-------------------:|-------------:|----------:|----:|----------:|
| 1000 | 102 021 | 35 483 | **260 802** | 7,4× | 247 | 34,5 M | 21,58 | 2,64 |
| 750 | 61 589 | 19 861 | **244 440** | 12,3× | 179 | 24,6 M | 17,21 | 2,79 |
| 500 | 27 241 | 8 879 | **223 488** | 25,2× | 125 | 17,1 M | 15,16 | 2,76 |
| 300 | 9 786 | 3 153 | **219 513** | 69,6× | 104 | 14,1 M | 13,51 | 3,41 |
| 150 | 2 401 | 798 | **216 149** | 270,9× | 82 | 10,9 M | 12,42 | 2,51 |

🛑 **Le résultat central de ce lot : réduire la zone active ne réduit presque pas le travail.**
De 1 000 à 150, ce que la caméra cadre est divisé par **44** (35 483 → 798) et ce que le moteur
dessine ne baisse que de **17 %** (260 802 → 216 149). La passe CPU ne baisse **pas du tout**
(2,64 → 2,51, dans le bruit). **[M]**

Il existe donc un **plancher d'environ 216 000 corps dessinés** qu'aucune distance ne franchit.
L'architecture actuelle est structurellement insensible à la zone active — ce n'est pas un réglage
à trouver.

En **amas**, mêmes chiffres à 2 % près (103 749 / 43 030 / 258 220 à 1 000 ; 26 310 / 12 039 /
224 024 à 500) : le plancher n'est pas un artefact de décor. **[M]**

### `D_active` et `N_active`

La fourchette demandée est 20 000 – 50 000 objets pertinents. La zone de rayon **500** en contient
**27 241** (uniforme) et 26 310 (amas).

> **`D_active` = 500 · `N_active` ≈ 27 000** — scénario principal de C5-B1. **[M]**

Aucun point supplémentaire n'a été ajouté : la relation est monotone et 500 tombe au milieu de la
fourchette. Un point à 600 aurait donné ~39 000, également valable ; 500 est retenu pour laisser de
la marge au-dessous du haut de fourchette.

## 3. C5-B0.1b — les bancs de référence natifs

Renderer actuel, sans partition, même densité et même distribution.

| monde | `far` | span | objets | dans la zone | dessinés | régions | appels | triangles | GPU | **passe CPU** | apply |
|------:|------:|-----:|-------:|-------------:|---------:|--------:|-------:|----------:|----:|----------:|------:|
| 500 | 1000 | 60 | 504 | 504 | 503 | 24 | 41 | 176 624 | 1,18 | **0,22** | 13,8 |
| 5 000 | 1000 | 190 | 5 016 | 5 016 | 5 016 | 35 | 35 | 1,78 M | 2,24 | **0,17** | 58,1 |
| **27 000** | **500** | 441 | 27 081 | 18 390 | **25 157** | 91 | 75 | 7,75 M | **3,88** | **0,28** | 295,1 |
| 50 000 | 1000 | 600 | 50 144 | 48 685 | 48 185 | 155 | 139 | 15,9 M | 5,32 | **0,52** | 555,8 |

### La cible, et l'écart d'aujourd'hui

| | 500k / `far` 500 | natif 27k | **ratio actuel** |
|---|---:|---:|---:|
| passe CPU | 2,76 ms | 0,28 ms | **9,9×** |
| GPU | 15,16 ms | 3,88 ms | **3,9×** |
| corps dessinés | 223 488 | 25 157 | **8,9×** |
| triangles | 17,1 M | 7,75 M | 2,2× |
| appels | 125 | 75 | 1,7× |

C'est l'écart que C5-B1 doit fermer. **[M]**

## 4. C5-B0.2 — ce que le moteur contient vraiment

### Le monde

| | valeur |
|---|---:|
| étendue X/Z | 3 794,7 |
| étendue Y | 50,5 |
| **aplatissement (XZ / Y)** | **75,2** |
| densité | 0,0347 objet / unité² |
| corps, sol compris | 501 444 |

### Empreinte au sol et hauteur, par classe

| classe | n | min | médiane | p90 | p99 | max |
|---|---:|---:|---:|---:|---:|---:|
| accessoires | 484 861 | 0,60 | **1,30** | 1,86 | 1,99 | 2,00 |
| repères | 15 139 | 4,00 | **6,99** | 9,43 | 9,94 | 10,00 |
| dalles de sol | 1 444 | 100 | **100** | 100 | 100 | 100 |
| hauteur des repères | | 16,0 | 33,1 | 46,5 | 49,6 | 50,0 |

**Trois classes nettes, rapport 77×** entre la dalle et l'accessoire médian. Les accessoires sont
minuscules devant le monde : 1,30 / 3 794 = **0,03 %**. **[M]**

### 🛑 Les régions telles que le moteur les pose — la cause racine

`cells = ceil(instances × triangles / TRIANGLES_PER_REGION)` : le budget est en **triangles**,
jamais en espace. **[C]** Conséquence mesurée :

| forme | tri / instance | régions | instances | médiane inst./région | **côté médian d'une région** |
|---|---:|---:|---:|---:|---:|
| cube | 12 | **19** | 178 261 | 10 096 | **3 794 — le monde entier** |
| cylindre | 128 | 160 | 161 621 | 1 010 | 947 |
| sphère | 960 | 1 056 | 161 562 | 153 | 341 |

Sur les 1 235 régions, le côté rapporté au monde a une médiane de 0,09 mais un **p99 de 1,00** :
le centième le plus large couvre le monde entier. **[M]**

> **Une forme légère ne se découpe pas dans l'espace.** 178 261 cubes tiennent en 19 régions dont
> chacune couvre le monde : elles touchent tout frustum, donc elles sont dessinées quoi que la
> caméra regarde. **C'est le plancher de 216 000 du § 2, et il est expliqué, pas seulement
> constaté.** **[M]**

Mêmes chiffres en amas (19 / 160 / 1 056 régions, mêmes côtés) : la répartition n'y change rien.

### Chevauchement

Le grain actuel range un objet par son **centre** **[C]** : aucun objet n'appartient à deux
régions, mais sa géométrie déborde. Rapporté à une cellule de 128 (§ 7) : un accessoire au p99
occupe **1,6 %** d'une cellule, un repère **7,8 %**, une dalle **78 %** — donc 1 à 4 cellules.
Le chevauchement est **négligeable pour 99,7 % des corps** et borné à 4 cellules pour le sol. **[M]**

### Mobilité

**[C]** — lu dans le code, non mesuré. Le regroupement se refait quand le CONTENU change
(`markContentChanged`), et un nœud qui ne fait que bouger passe par un chemin rapide qui réécrit
ses seules matrices : C1 mesurait « 1 bougé » à 3,2–4,1 ms sur 50 000 contre 96–113 ms pour
« 1 ajouté ». Rien dans le moteur ne distingue aujourd'hui un objet **statique** d'un objet
**dynamique** : la distinction n'existe pas, elle est à créer. **[C]**

## 5. C5-B0.3 — trajectoires déterministes

Format : `trajectories.ts`. Une trajectoire porte `name`, `seed` (la graine du MONDE qu'elle
parcourt), `frames`, une fonction **pure** `poseAt(at)` — sans état, sans horloge, sans
`Math.random` — et un `warmFrom` facultatif, sans lequel une téléportation ne s'exprime pas : une
fonction pure du rang ne connaît pas d'avant.

La frontière du scénario `boundary` est **mesurée**, pas devinée : le banc avance la caméra par pas
et retient l'abscisse où le nombre d'appels saute le plus — **x = 347,85, saut de 23 appels**. **[M]**

### Preuve de reproductibilité

Chaque trajectoire jouée **deux fois** sur le renderer actuel, comparée frame par frame sur les
appels, les triangles et les instances :

| scénario | frames | pré-roll | **identique** | diverge à | instances min | max | amplitude |
|---|---:|---:|:---:|---:|---:|---:|---:|
| repos | 240 | 0 | **oui** | — | 537 995 | 537 995 | 0 |
| marche | 300 | 0 | **oui** | — | 533 958 | 537 995 | 4 037 |
| course | 300 | 0 | **oui** | — | 522 194 | 562 766 | 40 572 |
| rotation | 180 | 0 | **oui** | — | 543 977 | 555 572 | 11 595 |
| frontière | 200 | 0 | **oui** | — | 547 924 | 556 492 | 8 568 |
| téléportation | 180 | 60 | **oui** | — | 467 047 | 467 047 | 0 |
| vue haute | 240 | 0 | **oui** | — | 569 495 | 569 495 | 0 |

**Sept sur sept, aucune divergence.** Les comptes incluent la passe d'ombre, d'où l'ordre de
grandeur double du § 2. **[M]**

## 6. C5-B0.4 — audit architectural

### Éliminées, une ligne chacune

- **Octree** — aplatissement mesuré **75,2** : les trois premiers niveaux ne couperaient rien en Y,
  et 7 des 8 enfants seraient vides.
- **Spatial hash plat** — aucun rejet hiérarchique : la requête reste proportionnelle aux cellules
  de la zone, sans niveau où accrocher le LOD ni le futur streaming.
- **BVH** — C2 mesurait sa construction à 6,66 ms pour 50 000 contre 1,76 pour la grille ; à
  500 000 elle domine, et un objet dynamique impose un refit qui remonte à la racine.
- **Quadtree STRICT** — les 1 444 dalles de 100 et les repères de 10 chevauchent les frontières et
  remontent vers la racine, où ils redeviennent testés à chaque requête : exactement le défaut des
  19 régions de cubes qu'on cherche à supprimer.

### Les deux finalistes

**A — grille hiérarchique 2D** : macro-chunks au-dessus de cellules, plus une liste des objets dont
l'empreinte dépasse la cellule.

**B — loose quadtree 2D.**

Dimensionné sur le monde mesuré (3 794,7 ; zone active 500) :

| cellule | cellules au total | **visitées pour r = 500** | objets / cellule |
|---:|---:|---:|---:|
| 64 | 3 600 | 192 | 139 |
| 96 | 1 600 | 85 | 313 |
| **128** | **900** | **48** | **557** |
| 192 | 400 | 21 | 1 254 |
| 256 | 225 | 12 | 2 229 |

Au-dessus, un macro-chunk de **512** donne 64 blocs dont **3** intersectent la zone.

| | A — grille hiérarchique | B — loose quadtree |
|---|---|---|
| nœuds visités, 500k / r=500 | **~3 macro + ~48 cellules ≈ 51** | ~48 feuilles + ~21 internes ≈ **69** |
| complexité de requête | O(cellules de la zone) | O(log n + feuilles de la zone) |
| objets gigantesques | liste « surdimensionnés » à part | remontent d'un niveau (le « loose ») |
| monde plat | natif, 2D | natif, 2D |
| niveaux verticaux / intérieurs | une cellule porte une colonne — **[H]** | idem — **[H]** |
| statiques | tableau contigu par cellule | feuille |
| dynamiques | **O(1)** : changer de case | O(log n) + rééquilibrage éventuel |
| déplacement d'objet | retirer / insérer, **O(1)** | remonter puis redescendre |
| insertion / suppression | **O(1)** | O(log n) |
| téléportation caméra | recalcul de l'ensemble actif, borné par la zone | idem |
| mémoire estimée | 900 cellules × (index) ≈ **~4 Mo** pour 500k index 32 bits — **[H]** | + les nœuds internes |
| construction initiale | un balayage O(n), pas de tri | O(n log n) |
| compatible C1/C2 | **oui, et c'est le point** : instancier PAR CELLULE | oui |
| compatible C3 LOD | la cellule porte la distance, le LOD garde le corps | idem |
| futur streaming | le chunk EST l'unité de chargement | la feuille, moins naturelle |

### Recommandation : **A — grille hiérarchique 2D**

Trois raisons, toutes adossées à une mesure :

1. **L'aplatissement 75,2 rend la 3ᵉ dimension inutile**, et la densité uniforme comme en amas
   donne les mêmes coûts (§ 2) — l'avantage du quadtree, qui est de s'adapter à une densité
   inégale, ne se paie pas ici.
2. **Les tailles mesurées sont minuscules devant la cellule** — p99 des accessoires à 1,6 % d'une
   cellule de 128 — donc le chevauchement, qui est la faiblesse d'une grille, ne se produit pas.
   Les seuls objets à cheval sont les dalles, bornées à 4 cellules.
3. **Le dynamique est O(1)** : un ennemi qui bouge change de case et ne reconstruit rien.

**Ce qui départage vraiment A de B ne sera tranché qu'en C5-B1** : la répartition des projets réels
est inconnue, et un monde très inégal avantagerait B. **[H]** Le plan du § 12 mesure les deux
coûts de requête sur le même monde avant de figer.

🛑 **Le vrai gain n'est pas la structure, c'est l'INSTANCING PAR CELLULE.** Le défaut mesuré au § 4
— 19 régions de cubes couvrant le monde — vient de ce que le découpage est décidé par un budget de
triangles. Une cellule qui porte ses propres `InstancedMesh` par (forme, matériau) supprime le
plancher par construction, quelle que soit la structure au-dessus. **[H]**

## 7. Schéma de données runtime proposé

```text
DOCUMENT (source de vérité, inchangé)
   │  outliner · sauvegarde · export · MCP/IA · recherche · scripts
   └────► INDEX SPATIAL RUNTIME  (dérivé, jetable, reconstructible)
                │   grille 2D : macro-chunks 512 → cellules 128
                │   statiques : tableau contigu par cellule
                │   dynamiques : index séparé, même grille
                │   surdimensionnés : liste testée à chaque requête
                └────► ENSEMBLE ACTIF (zone de rayon D_active)
                              └────► FRUSTUM → INSTANCING → LOD → RENDU
```

Un objet hors zone active **existe toujours** dans le document. La partition ne supprime rien, elle
choisit ce que le renderer considère. **[C]** — c'est la contrainte posée par le brief, et rien du
document n'a besoin de changer pour la tenir.

## 8. Statique et dynamique

**Deux index sur la MÊME grille**, et voici pourquoi plutôt qu'un seul :

- le **statique** se construit une fois, se range en tableaux contigus par cellule, et n'est
  jamais réécrit — c'est ce qui permet d'instancier par cellule sans reconstruire ;
- le **dynamique** change de cellule à chaque déplacement ; le garder dans le même tableau
  forcerait à réécrire le lot instancié de la cellule à chaque pas d'ennemi.

Coût de mise à jour d'un dynamique : retirer d'une cellule, insérer dans une autre — **O(1)**, sans
toucher au lot statique. **[H]** — à chiffrer en C5-B1.

Un ennemi qui bouge ne reconstruit donc **rien** de la partition du monde.

## 9. La zone active

Rayon `D_active` autour de la caméra. À chaque frame : les macro-chunks intersectant le disque
(≈ 3), puis leurs cellules intersectant le disque (≈ 48). Une cellule entrant dans la zone rend ses
lots ; une cellule sortante les cache. **Aucun parcours du monde entier, jamais.**

**AUTO et MANUEL** — la distance est une **entrée** de la requête, jamais une constante du code :
un mode AUTO la calculera, un créateur pourra l'écrire. C5-B0 ne fixe ni l'un ni l'autre ; il exige
seulement que l'architecture ne la fige pas. **[H]**

**Accessoires et repères** — la cellule porte la distance, donc un seuil par CLASSE se lit sans
structure supplémentaire : un repère reste considéré au-delà de la distance des accessoires. C3
répond « avec combien de triangles », C5 répond « faut-il encore considérer ». Rien de plus n'est
proposé ici. **[H]**

## 10. Petite scène

Références mesurées : 500 objets → passe 0,22 ms, GPU 1,18 ms, 24 régions. 5 000 → 0,17 ms et
2,24 ms. **[M]**

À 500 objets la grille poserait 900 cellules pour 500 corps : **plus de cellules que d'objets**, ce
qui est absurde. Un **bypass** s'impose — sous un seuil, l'index n'est pas construit et le renderer
garde son chemin actuel. **Le seuil ne se fixe pas ici** : il se mesure en C5-B1, en cherchant le
compte à partir duquel l'index rend plus qu'il ne coûte. **[H]**

## 11. Critères d'acceptation proposés pour C5-B1

Tous dérivés des mesures ci-dessus, aucun choisi à la main.

| # | critère | dérivé de | seuil proposé |
|---|---|---|---|
| 1 | **Scaling CPU** — 500k / `D_active` contre natif 27k | 2,76 contre 0,28 ms, soit 9,9× | **≤ 2× le natif, soit ≤ 0,56 ms** |
| 2 | **Corps dessinés** | 223 488 contre 25 157, soit 8,9× | **≤ 1,5× le natif, soit ≤ 37 700** |
| 3 | **GPU** | 15,16 contre 3,88 ms, soit 3,9× | **≤ 1,5× le natif, soit ≤ 5,8 ms** |
| 4 | **Coût de recherche** | ~51 nœuds attendus contre 1 235 régions testées | **≤ 128 nœuds visités par frame, et JAMAIS O(régions totales)** |
| 5 | **Petite scène (500)** | passe 0,22 ms, proche du clamp de 100 µs | **≤ +0,05 ms absolu** (un pourcentage ne veut rien dire à ce niveau) |
| 6 | **Mouvement** (marche, course, frontière) | repos cible 0,56 ms | moyenne **≤ 1,2× le repos**, p95 **≤ 1,5×**, p99 **≤ 2×**, pic **≤ 3×** (≤ 1,7 ms) |
| 7 | **Téléportation**, mesurée à part | budget d'une frame à 120 Hz ; C3 convergeait en 10 frames | pic **≤ 8,3 ms sur UNE frame**, convergence **≤ 10 frames** |
| 8 | **Non-régression** 5 000 et 50 000 | 0,17 et 0,52 ms | **≤ +0,05 ms absolu** |

Le critère 2 est le plus important : il est le seul qui dise que la partition **fait son travail**
plutôt qu'elle déplace le coût.

## 12. Plan du spike C5-B1

1. **Mesurer les deux finalistes sur le même monde**, sans les brancher au renderer : construire
   l'index, jouer les sept trajectoires, compter les nœuds visités et le temps de requête. Départage
   A / B sur cette seule mesure.
2. **Brancher le vainqueur derrière un flag**, comme C1 l'a fait pour `batched` — l'ancien chemin
   reste le défaut.
3. **Instancier par cellule** et vérifier que le plancher de 216 000 disparaît.
4. **Rejouer les huit critères** du § 11, deux ordres, répétitions.
5. **Chercher le seuil de bypass** en balayant les comptes entre 500 et 50 000.
6. **Capturer l'image** à chaque étape : C3 et C5-A ont chacun trouvé un défaut majeur que seuls
   les pixels ont montré.

## 13. Hors périmètre, noté et non traité

- **Le défaut `near`/`far` des cartes d'ombre** trouvé en C5-A n'est pas corrigé. La future
  partition devra savoir répondre « quels casters peuvent influencer cette zone ? » — c'est une
  requête de la même famille, sur un volume différent.
- **`lodBench.ts` de C3** bouge la caméra à chaque frame avec le motif à deux `requestAnimationFrame`
  que ce lot a démontré faux sous caméra mobile. Ses colonnes « déplacement » méritent d'être
  rejouées avant d'être réutilisées. **[M]**
- **Aucune gate ne lit `spike/`** — ni tsconfig, ni lint, ni vitest, ni knip. Le typecheck des six
  fichiers du banc est monté à la main. **[C]**

### Ce que le futur GAME ne se voit pas interdire

Le chunk est l'unité naturelle du **streaming** (charger/décharger par cellule), de la **physique
locale** (les corps d'une cellule), de la **navigation** (un graphe par cellule), de l'**audio
spatial** et des **triggers** (mêmes requêtes de zone), et du **réseau** (intérêt par cellule). Un
**floating origin** décale l'origine de la grille sans en changer la structure. Aucun de ces points
n'est étudié ici — seulement vérifié qu'aucun n'est fermé. **[H]**
