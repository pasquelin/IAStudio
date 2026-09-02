# Chantier C4 — ajuster la carte d'ombre sur la vue

🛑 **RAPPORT PARTIEL.** Les mesures sont faites ; **le test de non-régression visuel ne l'est
pas**, et le brief dit que la correction passe avant le chiffre. Aucune stratégie n'est donc
recommandée ici. Ce qui manque est écrit au § 5.

Branche `feat/shadow-view`, partie de `feat/lod`. Mesuré le 2026-09-02, **Apple M2 Max**,
Electron 43 / Chromium 150, three 0.185.1, WebGL, 1600×900, `pixelRatio` 1.

**Aucune ligne de production n'a été touchée.**

## 1. Ce qui existe

`tuneShadows` appelle `fitShadowCamera(light, reach)` où `reach` vient de `measureShadowReach()` —
la boîte de ce que la SCÈNE occupe, tenue entre les passes et qui ne rétrécit jamais.
`fitShadowCamera` n'écrit que `left/right/top/bottom`, **symétriques**, et laisse `near`/`far` aux
défauts de three. La caméra d'ombre est placée par three sur la lumière, visée sur sa cible.

Conséquence, déjà mesurée en C2 : **la carte couvre tout le niveau quoi que l'on regarde**, et en
vue tournée la passe d'ombre dessine encore la scène entière pendant que la couleur descend de 30 %.

**Ce que C4 peut faire sans rien casser de C1–C3** : une caméra orthographique accepte une boîte
ASYMÉTRIQUE. Le volume se décale donc en écrivant `left/right/top/bottom/near/far` autour de la
lumière **là où elle est** — aucun objet du document ne bouge, ni la lumière, ni sa poignée, ni son
aide. Rien de l'instanciation, du détachement des sources ni du LOD n'est touché.

## 2. La construction, et pourquoi elle est exacte

Le volume est le frustum de la caméra, exprimé dans le repère de la caméra d'ombre, **intersecté
avec la boîte de la scène** — rien n'existe au-delà — puis son plan proche est reculé jusqu'au bord
de la scène le long de l'axe de la lumière, pour garder les corps qui projettent dans la zone
visible sans y être.

**Les CÔTÉS ne s'élargissent pas, et ce n'est pas une approximation** : la lumière est
directionnelle, ses rayons sont parallèles, donc un corps hors de ces côtés projette hors de la
zone visible. Il n'y a aucune marge choisie dans ce calcul.

🛑 **L'intersection avec la scène n'est pas un détail.** Sans elle, le frustum d'une caméra — mille
unités de portée — donne une boîte de **2 126** là où la scène en fait 136 : la carte devient plus
grossière qu'avant. Mesuré, corrigé.

## 3. Ce que ça rend, et où ça ne rend rien

### S3, cube dense de 50 000 corps — RIEN

| vue | ajustement | côté | GPU ombre | triangles d'ombre |
|---|---|---:|---:|---:|
| plein champ | scène (actuel) | 136 | 4,64 | 18 333 572 |
| plein champ | vue + casters | 166 | 3,93 | 18 333 572 |
| tournée | scène | 136 | 2,60 | 18 333 572 |
| tournée | vue + casters | 166 | 1,97 | 17 327 492 |

**La boîte devient plus GRANDE que l'actuelle** (166 contre 136) et les triangles ne bougent
pas. La cause est structurelle et c'est la même qu'en C2 pour le culling : sur un cube dense, la
caméra embrasse tout le niveau, donc un volume ajusté sur la vue n'a rien à retrancher.
**C4 ne se mesure pas sur S3.**

### Map plate 1200 × 1200, 50 000 corps — un peu, et négatif au sol

| vue | ajustement | côté | GPU ombre | triangles d'ombre |
|---|---|---:|---:|---:|
| plein champ | scène | 1697 | 1,78 | 17 346 692 |
| plein champ | vue + casters | 1680 | 1,11 | 16 593 412 |
| tournée | vue + casters | 1373 | 1,54 | 14 360 452 |
| dedans | vue + casters | 1061 | 1,73 | 15 251 332 |
| **au sol** | **vue + casters** | 1349 | 2,60 | **18 333 892** |

🛑 **Au sol — la vue d'un jeu — les triangles d'ombre AUGMENTENT de 6 %** : le frustum d'une caméra
posée au sol couvre presque toute la map, donc la boîte ne rétrécit pas, pendant que le plan proche
reculé vers la lumière ajoute de la profondeur. **Le volume ajusté sur la vue, seul, ne suffit pas.**

### Avec une distance max d'ombre — le seul vrai levier

| vue | distance | côté | GPU ombre | triangles d'ombre |
|---|---:|---:|---:|---:|
| dedans | actuel | 1697 | 1,92 | 17 346 692 |
| dedans | 150 | **251** | **0,98** | **8 406 532** |
| au sol | actuel | 1697 | 2,66 | 17 346 692 |
| au sol | 150 | **251** | **1,24** | **7 352 132** |

**−52 à −58 % de triangles d'ombre, −49 à −53 % de GPU d'ombre**, et la boîte passe de 1697 à 251,
soit **6,8 fois plus de texels par mètre** — l'ombre devient plus nette, pas seulement moins chère.

🛑 **Mais une distance max d'ombre COUPE les ombres au-delà.** Ce n'est pas une optimisation
transparente, c'est un réglage produit avec un effet visible. Et elle ne rend rien quand la caméra
cadre la scène de l'extérieur : à 150, `plein champ` et `tournée` remontent à 18,3 M, PIRE que
l'actuel, parce que le frustum tronqué n'atteint plus la scène et que le repli reprend la boîte
entière.

## 4. Le CPU

**0 à 0,007 ms par frame** pour construire le volume — huit coins déprojetés, seize points
transformés, deux boîtes. Il n'y a rien à rendre événementiel : le calcul est déjà sous le tick de
mesure. C'est la seule colonne de ce rapport qui ne pose aucune question.

## 5. 🛑 Ce qui n'est PAS mesuré, et pourquoi rien n'est recommandé

Les six cas visuels du brief ne sont **pas** faits. Le décor de `shadowShot.ts` place les deux murs
DANS le cadre au lieu d'en laisser un dehors : le cas B — l'ombre d'un caster hors champ qui doit
entrer dans l'image — **n'est donc pas exercé**, et la part de sol à l'ombre lit 0,0003 des trois
côtés, ce qui ne distingue rien. Les captures existent et montrent une scène correcte ; elles ne
prouvent rien sur la question posée.

Restent donc ouverts : **A** (caster visible), **B** (caster hors écran, ombre dans l'image),
**C** (caster derrière la caméra), **D** (caster inutile rejeté), **E** (caméra en mouvement, pas
de disparition aux bords), **F** (lumière en mouvement).

**Tant que B n'est pas vert, aucune de ces stratégies ne peut être recommandée**, quel que soit le
gain : une ombre correcte qui disparaît invalide le résultat. C'est la règle du brief, et elle est
juste — la construction du § 2 est exacte sur le papier, et le papier n'a jamais suffi dans ce
dépôt.

## 6. Ce que je retiens quand même

- **C4 est un chantier d'open world, pas de scène dense.** Il ne rend rien sur S3, peu sur une map
  plate vue de loin, et beaucoup caméra posée dedans. Sa mesure appartient au banc de C5.
- **Le levier n'est pas « ajuster sur la vue », c'est « borner la distance d'ombre »** — et c'est un
  réglage visible, pas une optimisation gratuite.
- L'intersection avec la boîte de la scène est indispensable, et son absence rend la carte PIRE.
- Le coût CPU est nul.

## 7. Rejouer

```bash
SPIKE_PAGE=shadow.html SPIKE_QUERY="lods=product&fits=scene,view,viewCasters" SPIKE_OUT=c4-a.json npx electron spike/webgpu/run.mjs
SPIKE_PAGE=shadow.html SPIKE_QUERY="lods=product&fits=scene,viewCasters&span=600" SPIKE_OUT=c4-field.json npx electron spike/webgpu/run.mjs
SPIKE_PAGE=shadow.html SPIKE_QUERY="lods=product&fits=viewCasters&span=600&shadowFar=150" SPIKE_OUT=c4-far-150.json npx electron spike/webgpu/run.mjs
SPIKE_PAGE=shadowShot.html SPIKE_OUT=c4-shot.json npx electron spike/webgpu/run.mjs
```
