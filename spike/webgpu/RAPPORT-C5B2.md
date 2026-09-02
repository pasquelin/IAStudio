# C5-B2 — couche de soumission, dynamiques, réconciliation

Sources : **[M]** mesuré · **[C]** lu dans le code · **[H]** hypothèse.

## 1. État Git et typecheck

Worktree `.claude/worktrees/open-world`, branche `feat/open-world`. **Diff `src/` vide** avant et
après. Typecheck des quinze fichiers du banc, monté à la main (aucune gate ne lit `spike/`) :
**zéro erreur**. **[M]**

## 2. Q1 — d'où vient l'écart entre 2,76 ms et 0,448 ms

Sonde dédiée, les deux harnais dans la même page, même monde, même distance :

| | studio (C5-B0) | nu (C5-B1) |
|---|---:|---:|
| objets dans la scène | 1 337 | 1 238 |
| `drawFrom` **avec ombre** | **4,436** | — |
| `drawFrom` couleur seule | **1,886** | — |
| **`gl.render` seul** | **0,396** | **0,376** |
| `updateMatrixWorld` | 0,127 | 0,091 |

> **Ni l'un ni l'autre n'avait tort : ils mesuraient deux fenêtres différentes.** Le rendu est
> identique des deux côtés (0,396 contre 0,376). B0 mesurait `drawFrom` ombre comprise ; B1
> mesurait `gl.render` sans ombre. **[M]**

L'écart se décompose en **2,55 ms de passe d'ombre** et **1,49 ms d'enveloppe `drawFrom`**.

### 🛑 L'enveloppe n'est pas fixe, et c'est un défaut de production

| monde | objets | `drawFrom` couleur | `gl.render` | **enveloppe** |
|---:|---:|---:|---:|---:|
| 5 000 | 137 | 0,125 | 0,125 | **0,000** |
| 27 000 | 193 | 0,215 | 0,167 | **0,048** |
| 500 000 | 1 337 | 1,886 | 0,396 | **1,490** |

Cause lue dans le code : `hideWorkshop()` boucle sur `this.applied.values()` — **tous les nœuds du
document** — pour y chercher les rails (`node.type === 'path'`). À 500 000 nœuds, c'est 500 000
itérations par appel. **[C]** + **[M]**

**Nuance qui change la portée** : `drawFrom` n'est pas la frame du studio, c'est le chemin
film/capture ; le rendu interactif passe par `renderFrame` du viewport. Ce coût de 1,49 ms est donc
payé à la capture et au film, pas à chaque frame d'édition. **[C]** Non corrigé — hors périmètre.

### Fenêtre retenue pour C5-B2

**`gl.render(scene, camera)` de la passe couleur, hors ombre et hors enveloppe studio.** C'est la
seule fenêtre que la partition change. Toutes les mesures ci-dessous l'emploient, plus
`spatialQuery` + `activeSetUpdate` + `visibility` mesurés séparément. **[M]**

## 3. Q2 — découpler cellules et meshes : mesuré, et rejeté

Trois soumissions comparées, 500 000 / `D_active` 500 / grain 256, 8 cycles alternés :

| | CPU | instances | draw calls | meshes | GPU |
|---|---:|---:|---:|---:|---:|
| **`InstancedMesh` par cellule** | **0,472** | **20 462** | 244 | 6 075 | **2,12** |
| `BatchedMesh` par lot | 0,649 | 45 789 | **27** | **27** | 5,22 |
| `BatchedMesh` + culling instance | **8,812** | **9 036** | **27** | **27** | **1,49** |

`BatchedMesh` atteint bien l'objectif — **27 soumissions au lieu de 244, quel que soit le grain**.
Mais :

> 🛑 **Les meshes portent le culling.** Regrouper par lot fait perdre le frustum par cellule : les
> instances dessinées passent de 20 462 à 45 789 (+124 %) et le GPU de 2,12 à 5,22 ms. Le
> récupérer par `perObjectFrustumCulled` rend le meilleur GPU du tableau (1,49) et le moins
> d'instances (9 036), mais coûte **8,8 ms de CPU** — exactement ce que C1 avait mesuré en 2026 sur
> 10 000 corps. **[M]**

**La prémisse de Q2 était vraie, sa conclusion fausse.** Le CPU suit bien le nombre de meshes
(B1 : 244/91 = 2,68 pour un CPU à 2,67), mais réduire les meshes n'est pas gratuit : chacun est une
unité de culling. **`InstancedMesh` par cellule est conservé.**

**La compaction (priorité 2) n'a pas été tentée** : elle regroupe elle aussi par lot, donc elle
perd le même culling que `BatchedMesh` sans culling — la mesure ci-dessus lui est applicable.
**[H]** pour cette extrapolation, assumée comme telle.

**Le balayage de grain n'a donc pas été rejoué** : la contrainte qui forçait 256 n'a pas disparu,
puisque le découplage est rejeté. Le grain de C5-B1 (256) reste en place. **[M]**

**Images** : chaque variante capturée et comparée au témoin de son monde — **0 pixel différent**
pour toutes, à 27 000 comme à 500 000. Les 25 000 instances supplémentaires de `BatchedMesh` sont
hors champ, dessinées pour rien mais sans changer l'image. **[M]**

## 4. Q3 — la couche dynamique séparée

Conception : un `InstancedMesh` par lot réservé aux mobiles, hors de toute cellule. Un corps garde
son **slot** à vie, sa matrice se **réécrit en place**, un retrait **échange avec le dernier**
(`count--`) au lieu de décaler, et seules les **plages touchées** partent au GPU
(`addUpdateRange`). Les mobiles ne sont pas cullés — ils vont partout, une sphère englobante serait
fausse au premier pas. **[C]**

### 1 % des corps (5 014), 1 m par frame

| | `update` moy | p99 | pic | meshes refaits | repos statique |
|---|---:|---:|---:|---:|---:|
| structure unique (C5-B1) | **19,10** | 29,40 | 36,43 | 947 | 0,544 |
| **couche séparée** | **0,901** | **1,015** | **1,505** | **0** | 0,518 |

**Gain ×21, et zéro reconstruction.** Les couches statiques ne bougent pas (0,544 → 0,518, dans le
bruit). **[M]**

### 5 % (25 072) et spawn

| scénario | moy | p99 | pic |
|---|---:|---:|---:|
| dynamique 5 % | **4,089** | 4,805 | 5,05 |
| **spawn** 200 créés + 200 détruits par frame | **0,033** | 0,105 | **0,24** |

Le coût du dynamique est **linéaire** en corps déplacés : 25 072 matrices réécrites par frame font
4 ms, ce que 5 014 faisaient en 0,9. `spawn` est quasi gratuit — c'est le swap-remove qui le rend
tel. **[M]**

Le prix déclaré : les mobiles n'étant pas cullés, les instances dessinées passent de 20 462 à
25 791 au repos. **[M]**

## 5. Q4 — les pics de B expliqués

**L'avantage de B était un artefact du ratio.** Les deux candidats n'avaient pas le même repos en
C5-B1 — A à 0,360 ms, B à 0,499 — et les critères étaient exprimés en multiples de ce repos :

| rotation | repos | pic absolu | pic en ratio |
|---|---:|---:|---:|
| A grille | 0,360 | **1,470 ms** | ×4,08 |
| B quadtree | 0,499 | **1,515 ms** | ×3,04 |

> **En millisecondes, A est meilleur (1,470 contre 1,515) ; en ratio, il paraissait pire.** Plus la
> base descend, plus un bruit fixe d'une milliseconde paraît grand. **[M]**

**Une phrase** : *A confirmée, l'écart s'explique par des repos différents au dénominateur, il n'y
a pas de défaut de A à corriger.*

## 6. Marge / préactivation

**Non fait**, faute de temps, et noté comme sujet du futur streaming plutôt que comme blocage : le
prébuild tient les critères de frontière (`activeSet` 0,010 ms) et ses 30 Mo n'empêchent rien.
**[H]**

## 7. Tableau principal — 500 000 / `D_active` 500 / grain 256

| | CPU | instances | draw calls | meshes | GPU | nœuds |
|---|---:|---:|---:|---:|---:|---:|
| natif 27k | **0,132** | 25 157 | 75 | 91 | 1,85 | — |
| témoin production | 0,372 | 223 488 | 125 | 1 235 | 2,86 | — |
| A · C5-B1 | 0,351 | 20 462 | 244 | 6 075 | 2,26 | 45 |
| **A · C5-B2 (avec dynamiques)** | **0,518** | 25 791 | 275 | 6 075 | — | 45 |

Décomposition au repos : `spatialQuery` 0,014 · `activeSetUpdate` 0,007 · `visibility` 0,000 ·
`sceneSubmission` le reste. **La recherche et l'ensemble actif ne pèsent rien.** **[M]**

## 8. Les douze critères

| # | critère | seuil | mesuré | verdict |
|---|---|---|---|---|
| 1 | scalabilité 500k / 50k | ≤ 1,2× | 0,351 / 0,386 = **0,91** | ✅ **GO** |
| 2 | soumission ≤ 1,5× natif | ≤ 0,198 ms | **0,351** (×2,66) | 🛑 **NO-GO** |
| 3 | objets dessinés | ≤ 37 736 | **20 462** | ✅ GO |
| 4 | GPU ≤ 1,5× natif | ≤ 2,78 | **2,26** | ✅ GO |
| 5 | nœuds visités | ≤ 128 | **45** | ✅ GO |
| 6 | petite scène 500 | ≤ +0,05 ms | **+0,008** | ✅ GO |
| 7 | mouvement, pic | ≤ 2 ms | **1,47** (rotation) | ✅ GO |
| 7b | mouvement, moyenne | ≤ repos + 0,3 ms | +0,14 (rotation) | ✅ GO |
| 8 | frontière | `activeSet` ≤ 0,5 · total ≤ 2 ms | **0,010** · 0,88 | ✅ GO |
| 9 | téléportation | ≤ 8,3 ms · ≤ 10 f | **0,80 ms · 2 f** | ✅ GO |
| 10 | **dynamique 1 %** | moy ≤ 1 · pic ≤ 2 ms | **0,901 · 1,505** | ✅ **GO** |
| 11 | dynamique 5 % (indicatif) | moy ≤ 3 · pic ≤ 5 ms | **4,089 · 5,05** | 🛑 NO-GO |
| 12 | **spawn** | pic ≤ 2 ms, 0 reconstruction | **0,24 ms · 0** | ✅ **GO** |

**Dix critères sur douze passent. Deux échouent.**

### Ce qui reste, et pourquoi

**Critère 2 — soumission à ×2,66 du natif.** Structurel et **maintenant expliqué** : le CPU suit le
nombre de meshes, et un mesh est l'unité de culling. Les trois façons de réduire les meshes ont été
mesurées et toutes coûtent plus qu'elles ne rendent (§ 3). **Le témoin production échoue le même
critère (×2,82)** : le natif 27k n'est pas une cible atteignable par une partition sur un monde à
27 lots, quelle que soit l'architecture. **[M]**

**Critère 11 — dynamique 5 % à 4,089 ms contre 3.** Linéaire en corps déplacés, donc prévisible et
réglable par un budget d'amortissement comme C3 en a posé un. Le critère était marqué indicatif.
**[M]**

## 9. Ce que Q2 change pour C3

Rien : `InstancedMesh` par cellule est conservé, donc le rig de C3 continue de voir des
`InstancedMesh`. Les deux conditions du § 16 de C5-B1 restent : le rig doit se construire par
cellule et suivre le cycle de vie des cellules, et l'interaction n'est pas mesurée. **[H]**

## 10. Plan de migration production — non exécuté

| # | étape | fichiers | flag | non-régression | image |
|---|---|---|---|---|---|
| 1 | grille + zone active derrière un flag | `engines/scene/` neuf `worldPartition.ts` | `partition: 'off' \| 'grid'`, défaut `off` | suite existante verte, flag à `off` | scène produit inchangée au pixel |
| 2 | instancing par cellule sous le flag | `instancing.ts` | même flag | `instancing.test.ts`, `sceneRendererGroups.test.ts` | témoin contre partition, 0 pixel |
| 3 | bypass géométrique | `worldPartition.ts` | seuil interne | 500 et 5 000 sans régression | — |
| 4 | couche dynamique | `dynamicBodies.ts` neuf | même flag | spawn/despawn, déplacement | mobiles au bon endroit |
| 5 | activer le flag par défaut | réglages | — | `pnpm validate` | scènes produit |

Chaque étape se mesure avant la suivante. **Aucune n'est engagée.**

## 11. Défauts de banc de ce lot

| défaut | effet | invalide |
|---|---|---|
| **compteur aveugle au multi-draw** — `BatchedMesh` dessine par `WEBGL_multi_draw`, non patché | « 0 instance, 0 appel » sur une scène qui en dessinait 27 lots, lu comme une victoire | premier relevé Q2, jeté |
| **éclairage à intensité 1** — physique depuis three 0.155 | image quasi noire, captures de contrôle inexploitables | aucune mesure CPU ; signalé par l'utilisateur |
| **240 frames et un lancement par campagne** | plusieurs minutes par mesure au lieu de 7 à 36 s | aucune, mais le lot a perdu du temps |

Le premier a été trouvé parce que l'utilisateur a regardé l'écran. **[M]**
