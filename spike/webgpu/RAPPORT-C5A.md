# Chantier C5-A — le banc du monde ouvert, et la mesure (a) du grain de région

Branche `feat/open-world`, partie de `feat/shadow-view`. Mesuré le 2026-09-02, **Apple M2 Max**,
Electron 43 / Chromium 150, three 0.185.1, WebGL.

🛑 **CORRIGÉ APRÈS COUP — la résolution annoncée ici était fausse.** Ce rapport disait « 1600×900,
`pixelRatio` 1 » ; le banc demandait bien 1 à `prepareOffscreen`, mais `configure` repose ensuite
`pixelRatioFor(quality)`, et le produit livre `balanced` — soit **1,5**. Le tampon RELEVÉ sur la
machine est donc **2400 × 1350** pour une fenêtre de 1600 × 900 CSS. Les rapports C1 à C4 portent
le même motif et probablement la même erreur. **Les rapports de ce rapport tiennent** — grains,
tailles et répartitions sont tous mesurés à la même résolution — mais les millisecondes de GPU sont
celles d'un rendu 2400 × 1350, pas 1600 × 900. Le banc relève désormais `bufferWidth`,
`bufferHeight` et `pixelRatio` dans chaque ligne : cette valeur ne se déduit plus.

**Aucune ligne de production n'a été modifiée.** `TRIANGLES_PER_REGION` est patché entre deux
lancements par `sweepRegions.sh`, qui refuse de partir sur un fichier déjà modifié et restaure la
constante y compris sur interruption — comme C2 le faisait, et sans ajouter de drapeau.

## 1. Le monde, et pourquoi chacun de ses quatre ajouts est un besoin

`sceneField` de C4 étalait `sceneVaried` sur un carré. Ce qui a été ajouté, et la raison :

| ajout | sans lui |
|---|---|
| densité constante, `span = 600·√(count/50000)` | 500 000 mesure une DENSITÉ, pas une taille de monde, et la question du brief perd son sens |
| un sol en **dalles** de 100 | aucune ombre ne se lit ; un plan unique resterait dessiné hors champ et fausserait culling ET carte d'ombre |
| deux classes : 97 % d'accessoires, 3 % de repères hauts | un simple seuil de distance répondrait seul, et la mesure ne dirait rien du produit |
| deux répartitions, uniforme **et** amas | l'uniforme est le pire cas d'une grille ; ne garder que l'amas serait se fabriquer un gain |

🛑 **Les repères ne diffèrent que par leur SCALE, jamais par leurs dimensions de géométrie** : deux
boîtes de tailles différentes sont deux clés de regroupement, donc mille tours tirées au hasard
seraient mille appels de dessin. Le monde mesurerait la déroute du regroupement, pas la partition.

Six scénarios, caméra à hauteur d'yeux : repos, marche (0,05 m/frame), course (1 m/frame),
**rotation sur place**, téléportation, **vue haute**. La rotation est le pire cas d'un culling — la
vue change entièrement sans qu'un corps ne bouge.

🛑 **DEUX DÉFAUTS TROUVÉS APRÈS COUP par la revue, et corrigés depuis.** La **vue haute** se posait
à `span × 0,5`, donc à 500 000 la caméra était à 1 341 de l'origine pour un plan lointain de
1 000 : elle mesurait un CLIPPING pendant que ce rapport la présentait comme la vue qui ne rejette
rien. Elle se pose désormais à `far × 0,45` — à 50 000 elle dessine 50 144 corps là où elle en
dessinait 46 134. Et `placeView` finit sur `repaint()`, qui planifiait une frame du viewport : les
scénarios à caméra mobile dessinaient **deux fois par frame**, la seconde hors de toute mesure. Le
banc pose maintenant la caméra directement. **Les colonnes `rest` et `teleport` ne sont touchées ni
par l'un ni par l'autre — ce sont celles sur lesquelles reposent les conclusions ci-dessous.**

## 2. 🛑 Cinq motifs de mesure essayés et jetés

Tous rendaient des chiffres **plausibles**. C'est ce qui rend cette liste plus utile que les
tableaux qui suivent.

| motif | ce qu'il faisait lire |
|---|---|
| chronométrer `redraw()` | **0,013 ms** de frame sur un monde de 3,5 M de triangles — c'est le coût de poser un drapeau, le viewport dessine à son propre rappel |
| le motif à deux rappels d'`engineBench` | **0 instance, 0 ms de GPU** dès que la caméra bouge : `schedule()` garde une frame en vol, le dessin passe AVANT la remise à zéro |
| lire par différence sur deux rappels | tout gonflé de moitié — la fenêtre captait 1,5 frame |
| `light.shadow.needsUpdate` | passe d'ombre **une frame sur deux** : le viewport pose `shadowMap.autoUpdate = false`, donc three lit `shadowMap.needsUpdate` du RENDERER |
| capturer après un `requestAnimationFrame` | **trois images blanches** lues comme « 0 pixel différent », ombres allumées comme éteintes — pas de `preserveDrawingBuffer` |

Ce qui marche : **`drawFrom` est synchrone**. Rien ne s'intercale entre deux lectures de compteur,
le chronomètre encadre exactement un dessin, et les pixels se lisent dans la foulée.

🛑 **Le dernier n'a été démasqué que par un CONTRÔLE** — rendre la même vue sans ombre du tout.
C'est exactement ce qui manquait à C4, dont la part de sol à l'ombre lisait 0,0003 des trois côtés.
Une mesure qui rend la même chose partout ne distingue rien, et il faut le prouver avant de
conclure.

## 3. Ce que la taille coûte — grain de production

Deux répartitions, caméra au sol. Les deux colonnes se recouvrent partout : **l'amas n'avantage
pas la partition**, donc rien de ce qui suit n'est un artefact de décor.

| | 50 000 | 100 000 | 200 000 | 500 000 |
|---|---:|---:|---:|---:|
| objets, sol compris | 50 144 | 100 289 | 200 576 | 501 444 |
| demi-côté du monde | 600 | 849 | 1 200 | 1 897 |
| régions | 155 | 283 | 531 | 1 235 |
| `apply` | 512 ms | 1 051 ms | 2 073 ms | **5 522 ms** |
| mémoire du processus | — | — | — | **2,6 Go** |
| dessinés au repos | **96 %** | 89 % | 72 % | **52 %** |
| après téléportation | 63 % | 53 % | 40 % | 30 % |
| passe de scène | 0,45 ms | 0,85 ms | 2,17 ms | 2,44 ms |
| GPU au repos | 5,2 ms | 9,2 ms | 16,5 ms | **20,7 ms** |

**500 000 tient** : `apply` reste sous les 10 s, la mémoire est raisonnable, le banc reste
exploitable. Le culling ne mord qu'à partir de 200 000 — jusque-là le `far` de 1 000 du produit
dépasse le demi-monde, donc la caméra voit presque tout.

## 4. Mesure (a) — le grain de région, DÉJÀ en production

200 000 corps, uniforme, caméra au sol :

| grain | régions | GPU repos | passe CPU | dessinés | appels | après téléport |
|------:|--------:|----------:|----------:|---------:|-------:|---------------:|
| 150 000 | 531 | 16,51 | 1,11 | 146 054 | 238 | 80 663 · 40 % |
| 50 000 | 1 467 | 8,87 | 7,67 | 127 375 | 519 | 62 847 · 31 % |
| **15 000** | 4 889 | **7,13** | 5,49 | **95 438** | 1 263 | **13 077 · 6,5 %** |
| 5 000 | 14 274 | 6,42 | **16,08** | 68 491 | 3 071 | 6 466 · 3,2 % |

🛑 **C2 avait conclu que ce grain ne rend RIEN. Cette conclusion tient toujours — pour le cube
dense sur lequel elle a été prise.** Sur un monde plat vu depuis dedans elle s'inverse.

Répété **trois fois, dans les deux ordres de grain**, à requête identique :

| grain | GPU repos | passe CPU |
|------:|---|---|
| 150 000 | 16,51 · 14,97 · 17,25 | 1,11 · 1,23 · 1,43 |
| 15 000 | **7,13 · 6,92 · 7,02** | 5,49 · 5,04 · 5,05 |

Les plages ne se recouvrent d'aucun côté, et les comptes — dessinés, appels, corps après
téléportation — sont **identiques d'une passe à l'autre** : ce sont des comptes exacts, pas des
mesures bruitées. Le premier gain de C2 était du bruit ; celui-ci ne l'est pas.

### Et il ne passe PAS l'échelle

500 000, mêmes deux grains :

| grain | régions | GPU repos | passe CPU | dessinés | après téléport |
|------:|--------:|----------:|----------:|---------:|---------------:|
| 150 000 | 1 235 | 20,65 | 2,44 | 260 802 · 52 % | 152 540 |
| 15 000 | 12 040 | **8,75** | **13,15** | 97 513 · 19 % | 17 484 |

**Le goulot bascule du GPU vers le CPU.** Un grain fixe en triangles produit 12 040 régions à
500 000, et parcourir 12 040 sphères par frame coûte 13 ms — hors budget. Ce qui est bon à 200 000
est mauvais à 500 000 : **le grain optimal dépend de la taille du monde, et une constante ne peut
pas le tenir.**

## 5. La réponse à la question du brief

> Une map de 500 000 objets dont ~30 000 sont pertinents coûte-t-elle comme 500 000 ou comme
> ~30 000 ?

**Ni l'un ni l'autre, et (a) ne suffit pas.** Au grain de production elle coûte comme 260 000 ; au
grain fin, comme 97 000, et le CPU passe à 13 ms. La partition par région rapproche
beaucoup — elle divise par 2,7 ce qui est dessiné, et par 8,7 ce qu'une téléportation laisse — mais
elle ne descend pas au pertinent, et son prix croît avec le nombre de régions.

Deux causes, toutes deux mesurées : le `far` de **1 000** du produit laisse voir presque tout un
monde de 2 400, et **rien n'est hiérarchique** — three teste chaque région, une par une, à chaque
frame.

## 6. 🛑 Un défaut de production : la carte d'ombre ne dessine plus rien

Le studio n'écrit **jamais** `near`/`far` de la caméra d'ombre — `fitShadowCamera` ne touche que
les côtés, ce que C4 disait déjà. Three les laisse donc à **0,5 et 500**, quelle que soit la scène.

| | 50 000 | 200 000 | 500 000 |
|---|---:|---:|---:|
| côté de la carte | 1 712 | 3 410 | 5 384 |
| profondeur | **500** | **500** | **500** |
| triangles d'ombre dessinés | 16,9 M | 36,8 M | 59,3 M |

Mesuré en images, **avec son contrôle** :

- **50 000** — les ombres se voient : **91,35 %** des pixels changent quand on les éteint. Ouvrir la
  profondeur ne change **rien**, 0 pixel. La troncature ne mord pas encore.
- **200 000** — l'image avec ombres est **identique pixel pour pixel** à l'image sans ombres,
  pendant que la passe d'ombre dessine 36,8 M de triangles. Ouvrir `far` en change **87,7 %**.

**Le studio paie donc une passe d'ombre entière pour un résultat que personne ne peut distinguer
d'ombres éteintes.** Réparer la profondeur coûte **+47 %** de triangles d'ombre (36,8 → 54,0 M à
200 000) : c'est ce qui remet une distance max d'ombre au centre de C4.

Ce n'est pas corrigé ici — c'est un lot à part, et il n'appartient pas au périmètre validé.

## 7. Ce que ce lot ne mesure pas

- **(b)**, le chunk comme unité de CONSTRUCTION, non ouvert : c'est la décision qui suit ce rapport.
- **La distance maximale de rendu.** Le `far` du produit n'a pas été balayé, alors que le § 5 le
  désigne comme la seconde cause. C'est la mesure la moins chère qui reste.
- **Le LOD de C3 par-dessus la partition** : les deux ne sont pas encore composés, délibérément —
  deux leviers dans la même passe ne seraient plus attribuables.
- **Le grain de 50 000**, mesuré UNE fois et non monotone (7,67 ms de passe contre 5,49 à 15 000).
  Les deux grains répétés sont 150 000 et 15 000 ; celui-là reste une mesure isolée.
- **Ce que le studio met autour d'une frame** — post, incrustation, atelier. `drawFrom` dessine la
  scène et la carte d'ombre, rien d'autre.
- **Une seconde lampe qui projette**, qui doublerait la passe du § 6.
- **Windows et Linux** : un poste, un pilote.

## 8. Rejouer

```bash
SPIKE_PAGE=world.html SPIKE_QUERY="counts=50000,100000,200000&spreads=uniform,clustered" SPIKE_OUT=c5a-scale-r150k.json npx electron spike/webgpu/run.mjs
SPIKE_PAGE=world.html SPIKE_QUERY="counts=500000&spreads=uniform" SPIKE_OUT=c5a-500k-r150k.json npx electron spike/webgpu/run.mjs
SPIKE_PAGE=world.html SPIKE_QUERY="counts=200000&spreads=uniform&shadowDepth=fit" SPIKE_OUT=c5a-200k-fit.json npx electron spike/webgpu/run.mjs
SPIKE_PAGE=worldShot.html SPIKE_QUERY="bodies=200000" SPIKE_OUT=c5a-shot-200000.json npx electron spike/webgpu/run.mjs
./spike/webgpu/sweepRegions.sh 200000 uniform,clustered 150000,50000,15000,5000
```

Les relevés sont les fichiers `c5a-*.json` et `c5-200000-r*.json` ; les captures, les
`c5a-shot-*.png`. Les deux relevés pris sous le décor au soleil mobile ont été **jetés** plutôt que
gardés à côté des bons.
