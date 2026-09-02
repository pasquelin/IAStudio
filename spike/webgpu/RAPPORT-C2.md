# Chantier C, phase 2 — sortir les sources cachées du graphe rendu, puis culler

Branche `feat/detached-sources`, partie de `feat/batched-mesh`. Mesuré le 2026-09-02,
**Apple M2 Max**, Electron 43 / Chromium 150, three 0.185.1, WebGL. Fenêtre visible 1600×900,
`pixelRatio` 1, `backgroundThrottling` désactivé. Écran à 120 Hz : **le FPS ne départage rien sous
8,3 ms de frame, le CPU et le GPU sont les juges.**

Même banc qu'en phase 1 — `engine.html` monte le VRAI `SceneRenderer`, `apply` bâtit chaque mesh,
`redraw` demande chaque frame. Chaque scène dans les deux ordres ; les deux valeurs sont écrites.

## Ce que cette phase a livré, et ce qu'elle n'a pas livré

**2A a atteint son but, largement.** Les corps que dessine un groupe ne sont plus parcourus :
la passe de scène de S3 tombe de **16,2 · 18,1 ms à 0,28 · 0,26**, et la frame de 22 · 25 ms à
8,3 — au vsync, 120 FPS contre 45,5 · 39,7.

🛑 **2B n'a rien livré, et c'est un résultat, pas un abandon.** Ses trois leviers ont été mesurés :
le découpage en régions ne rend rien et coûte du CPU (répété à deux budgets), la passe d'ombre est
le tiers du GPU mais aucune vue ne la coupe, et une distance max ne peut pas se mesurer sur ce banc
— ses deux vues cadrent le niveau depuis le dehors. **Aucune ligne de production n'a été changée
pour 2B.** § 5, 6 et 7 disent où part le temps qui reste.

Un défaut de la même famille a été trouvé en sondant les matrices, et corrigé dans son commit : une
copie ne suivait pas le nœud dont elle pend quand celui-ci bougeait sans elle — § 8.

## 1. Le mécanisme, choisi par la mesure et non par le goût

Deux façons de sortir les sources, et elles ne rendent pas la même chose. Banc autonome
(`sources.html`, `kinds=`), 48 `InstancedMesh` et N sources sur une couche que la caméra ignore,
une ombre portée, médiane de 8 blocs de 10 frames :

| corps | sans source | `auto` (ce que le moteur faisait) | `frozen` | conteneur invisible | hors du graphe |
|---:|---:|---:|---:|---:|---:|
| 10 000 | 0,08 | 1,20 | 1,04 | 0,92 | **0,07** |
| 50 000 | 0,07 | **11,07** | 9,90 | **5,63** | **0,07** |

- Un conteneur `visible = false` dans la scène coupe `projectObject` — la couleur ET chaque carte
  d'ombre — et rend la **moitié**. `updateMatrixWorld` continue de les parcourir.
- Hors du graphe, les trois parcours tombent : la colonne devient indistinguable de « sans
  source ».
- `auto` reproduit le relevé de C1 à 1 % près (11,07 contre 11,17) : c'est le banc qui date, pas
  la machine.

**Le conteneur invisible n'est donc pas un repli moins cher : c'est la moitié du résultat pour la
même comptabilité.** Le mécanisme retenu est le second.

## 2. Comment une source sort du parcours sans sortir de l'arbre

Une source quitte le tableau `children` de son parent, **et rien d'autre** : son `parent` reste
écrit. Tout ce qui lit l'arbre **vers le haut** répond donc exactement comme avant — `isDrawn` du
regroupement, `updateWorldMatrix` d'un nœud qui bouge, et `hangFromParent`, qui la trouve déjà sous
son parent et ne fait rien. Ce qui lit **vers le bas** ne la voit plus.

**La cartographie, faite avant la première ligne de code** — qui lit le graphe, qui lit `objects` :

| Ce qui lit | Comment | Ce que le détachement lui fait |
|---|---|---|
| le rendu et chaque carte d'ombre | `projectObject` sur `children` | **c'est le but** |
| `scene.updateMatrixWorld()` | `children` | ne les atteint plus — `refreshSources` compose les leurs, entre la passe et le regroupement |
| l'export | `placedCopy` puis `traverse` des copies | **les perdrait** — `asHung` les raccroche le temps de l'appel, et `syncSourceWalk` les ressort |
| `nodeAt`, `sceneryUnder`, le snap de surface | `intersectObjects([...objects.values()])` | rien : le rayon prend une liste, jamais la scène |
| `statsOf` | `objects.values()` puis les enfants, dédoublonné par `met` | rien : chaque source y est encore, comptée une fois |
| `framedObjects`, `sceneHeight` | `expandByObject` par objet d'`objects` | rien : chacune est étendue pour elle-même |
| le snap de surface, la taille du gizmo, le cadre de sélection, les axes, l'aide des normales | `setFromObject` **d'UN nœud** | 🛑 **les perdait** — c'est la régression du § 12, corrigée par `withHungUnder` |
| la boîte d'ombre incrémentale | `expandByObject` des nœuds bougés | les perdait aussi — corrigée par `descendantsOf` |
| `exportTo`, `nodeAt`, le gizmo, `placedCopy` | par identifiant | rien, comme le disait le brief |
| `hangFromParent`, `release`, `applyVisibility`, `tuneShadows`, l'isolation | `objects` et `parent` | rien — voir `unhang` au § 8 pour la seule qui mentait |
| l'aide « normales » d'une sélection | `meshOf` descend du sélectionné | **angle mort assumé** : un groupe dont tous les meshes sont détachés ne lui rend aucun mesh |

## 3. Le résultat, C1 → C2, chemin par défaut (`instanced`)

| scène | frame | passe de scène | GPU | FPS | appels |
|---|---|---|---|---|---|
| S1 · 544 | 8,3 · 8,3 → 8,3 · 8,3 | 0,22 · 0,25 → **0,17 · 0,19** | 1,72 · 1,21 → 1,33 · 1,99 | 120 → 120 | 122 |
| S2 · 10 000 | 8,3 · 8,3 → 8,3 · 8,3 | 1,69 · 1,65 → **0,11 · 0,12** | 2,97 · 2,08 → 1,67 · 3,36 | 120 → 120 | 57 |
| S3 · 50 000 | **22,0 · 25,2 → 8,3 · 8,2** | 16,2 · 18,1 → **0,28 · 0,30** | 6,64 · 12,8 → 4,74 · 4,18 | **45,5 · 39,7 → 120 · 122** | 169 |

Passe de scène en vue tournée (70 % hors champ) : S3 **16,4 · 15,7 → 0,27 · 0,26**.

Le GPU, lui, ne se compare pas d'un ordre à l'autre — quatre relevés de S3 donnent 4,15 · 6,58 ·
4,74 · 4,18 sur la MÊME scène, comme C1 l'écrivait déjà de sa colonne. Seules les passes CPU
tranchent.

Le lot y gagne aussi, mais **en vue tournée seulement** — S3 20,8 · 22,4 → 5,5 · 5,7 ms de passe ;
plein champ son parcours par instance domine et ne bouge pas (27,7 · 29,6 → 26,5 · 26,0). Le défaut
reste `instanced`, comme C1 l'a tranché.

**À 50 000 corps il ne reste plus de passe de scène à optimiser** : 0,28 ms, c'est le dessin des
169 appels et rien d'autre.

## 4. Le prix, écrit plutôt que déduit

Un changement de CONTENU paie une passe de plus sur les enfants de chaque parent, plus la
recomposition des matrices que le parcours n'atteint plus, plus l'index des enfants du § 8.

**`1 ajouté` sur S3, sept relevés** : C1 donnait 104,4 · 95,8 ; C2 donne 109,5 · 110,1, et les
cinq passes intermédiaires 101 · 105,8 · 108,1 · 104,0 · 116,1. **La colonne ne sépare pas les
deux versions** — son bruit propre est du même ordre que ce qui a été ajouté.

🛑 **La première écriture, elle, coûtait bien 30 %** : elle raccrochait toutes les sources puis les
ressortait, deux passes dont la seconde défait la première. Corrigée en une passe unique avant
d'être commitée. C'est écrit ici parce que le chiffre a existé.

Le tas JS ne dit rien de plus qu'en C1 : sur S3, `chargé` va de 260 à 298 Mo selon l'ordre pour la
même scène. **Aucune conclusion mémoire n'est tirée.**

## 5. Ce que 2A ne détache PAS, et pourquoi

- **Une source dont un NŒUD dépend.** Détachée, l'enfant partirait avec elle et `hangFromParent`,
  qui lit `parent`, ne le ramènerait jamais. Elle reste dans le parcours et continue d'être
  dessinée par son groupe (`sweep`).
- **Toutes les sources, dès qu'un mode dessine les ARÊTES.** `applyWireOverlay` accroche un
  `LineSegments` sous chaque mesh, et une source hors du parcours emporte son contour. Le mode
  `both` repaie donc les 16 ms de S3 (`syncSourceWalk`). Le mode `wireframe` sans quads n'est pas
  concerné : il passe par le drapeau du matériau, et `showsEdges` le dit.
- **Une source qu'un glissé multiple a portée sous le pivot** : elle y revient à la fin du geste et
  reste dans le parcours jusqu'au prochain changement de contenu. Une poignée d'objets, pas
  cinquante mille.

## 6. 2B, levier 1 : le découpage en régions ne rend rien

`TRIANGLES_PER_REGION` vaut 150 000 et C1 notait qu'à S2 et S3 aucun groupe ne l'atteint, donc
qu'une seule région englobe le niveau. Le budget a été balayé sur le VRAI moteur, `instanced`,
S2 et S3 :

| budget | S3 GPU | S3 GPU tourné | S3 passe | S3 appels | S3 corps dessinés tourné | S3 triangles tournés |
|---:|---:|---:|---:|---:|---:|---:|
| 150 000 | 4,83 | 3,90 | 0,29 | 169 | 97 906 | 13 529 808 |
| 50 000 | 4,25 | 3,28 | 0,37 | 377 | 95 931 | 12 834 608 |
| 15 000 | 4,53 | 2,97 | 0,91 | 1 257 | 90 162 | 11 503 184 |
| 5 000 | 4,57 | 2,92 | **6,01** | 2 962 | 83 891 | 10 849 168 |

**Le premier passage donnait 150 000 → 50 000 pour −12 % de GPU. Répété deux fois par budget, à
requête identique, l'effet disparaît :**

| budget | S3 GPU | S3 GPU tourné | S3 passe |
|---:|---|---|---|
| 150 000 | 4,205 · 4,198 | 3,205 · 3,231 | 0,333 · 0,340 |
| 50 000 | 4,280 · 4,289 | 3,520 · 3,595 | 0,500 · 0,427 |

**C'était du bruit, et la vraie direction est l'inverse** : deux fois plus d'appels, une passe plus
chère, et pas un millième de GPU. **La constante reste à 150 000.**

**Pourquoi le culling ne mord pas, et c'est structurel** : à 5 000 de budget, 2 962 régions et
30 % des centres dans le champ, la vue tournée dessine encore **84 %** des corps. Une grille
uniforme sur un niveau CUBIQUE donne des cellules qu'un frustum traverse presque toutes — il en
faudrait vingt par axe pour rejeter vraiment, soit des milliers d'appels par groupe. **Ce que ce
banc mesure est un cube plein regardé depuis un coin, le pire cas pour une grille ; un niveau PLAT
n'a pas été mesuré.**

## 7. 2B, levier 2 : la passe d'ombre, et levier 3 : la distance max

**La passe d'ombre est le tiers du GPU et la moitié des triangles**, S2 et S3, `shadows=off`
contre les deux relevés avec ombre :

| scène | GPU avec | GPU sans | triangles avec | sans | appels avec | sans |
|---|---:|---:|---:|---:|---:|---:|
| S2 | 2,50 · 2,09 | **1,49** | 2 853 144 | 1 426 608 | 57 | 33 |
| S3 | 4,21 · 4,20 | **2,79** | 14 266 896 | 7 133 484 | 169 | 89 |

🛑 **Et aucune vue ne la coupe** : la caméra d'ombre est ajustée sur ce que la scène OCCUPE, donc
en vue tournée elle dessine toujours les 7 133 412 triangles du niveau entier, pendant que la passe
de couleur descend à 6 396 396. **C'est le seul coût de ce banc qui ne dépend pas d'où l'on
regarde.**

Le rendre demanderait d'ajuster le frustum d'ombre sur la VUE plutôt que sur la scène, en
l'étendant vers la lumière pour garder les projeteurs hors champ. **Non fait** : le gain plafonne à
~1,4 ms de GPU sur une frame déjà au vsync, et il se paie en ombres fausses au bord si l'extension
est mal dimensionnée. À rouvrir quand une frame ne tiendra plus.

**La distance max n'a pas pu être mesurée.** Le plan lointain de la caméra fait exactement ce
qu'une distance max ferait, et il a été branché sur le banc (`far=`). Il ne dit rien ici : les deux
vues cadrent le niveau depuis le DEHORS, donc `far` garde tout ou couperait tout — à 80 m sur S3 il
rend 97 086 corps sur 100 000, et la vue tournée ne bouge pas d'un triangle. **Il manque au banc
une vue prise DANS le niveau**, et c'est le premier travail de qui rouvrira ce levier.

## 8. Un défaut trouvé en sondant, et corrigé

Une copie ne suivait pas le nœud dont elle pend quand celui-ci bougeait sans elle : caisse déplacée
à 100, copies restées à 15. `moved` n'écrit que les fentes des nœuds du tour, et un enfant dont le
placement PROPRE n'a pas changé n'en est jamais un.

**Le défaut précède ce chantier** et ne se voit que sur un parent de type `mesh` : un parent
`group` n'a jamais pris le chemin rapide — `keepsItsGroup` exige deux `mesh` — donc le déplacer
regroupe tout et corrige de force. Reproduit pour les deux stratégies, gardé
(`sceneRendererGroups.test.ts`).

Le fils se lit sur le DOCUMENT et non sur le graphe : depuis 2A une source est hors du tableau
`children` de son parent, donc un parcours des objets ne peut plus répondre. `childNodes` se refait
avec les groupes, seul moment où un parent peut avoir changé.

**Et un second, du même genre** : `removeFromParent` ne fait RIEN à un objet déjà sorti du tableau
— three splice par index et n'efface `parent` que s'il le trouve. Un nœud relâché serait raccroché
par le regroupement suivant, géométrie libérée comprise. `unhang` ferme le cas.

## 8 bis. Ce que la revue a trouvé, et ce qui en a été fait

Sept trouvailles d'une revue adverse en lecture seule. **Quatre partagent une cause, et c'était une
vraie régression** : ma cartographie avait vérifié les lectures qui BOUCLENT sur `this.objects`, pas
celles qui descendent d'UN nœud. `Box3.setFromObject(nœud)` ne marche que par `children`, donc la
boîte d'un groupe dont tous les corps sont dessinés par une instance revenait **VIDE**.

| trouvaille | état |
|---|---|
| le snap de surface ne faisait plus rien sur un groupe (boîte vide) | corrigée, gardée |
| un sol de seize tuiles identiques dans un groupe n'était plus une surface où poser | corrigée (`surfaceRoots`), gardée |
| le cadre de sélection, les axes d'origine et l'aide des normales d'un groupe | corrigées, gardées |
| la taille du gizmo calculée sur un vide | corrigée |
| la boîte d'ombre incrémentale manquait les corps tenus | corrigée, **non gardée** : le seul chemin qui l'atteint remet la boîte à zéro, et le cas se noie dans un défaut d'ordre plus ancien — les ombres sont ajustées AVANT que les matrices ne soient rafraîchies |
| le test « un nœud pend de moi » n'était pas idempotent : il lisait `children`, que la passe précédente avait déjà vidé, donc au second tour le parent partait aussi | corrigée (lecture du DOCUMENT), gardée |
| la descente des nœuds bougés dupliquait les identifiants et n'avait aucune garde de cycle | corrigée (`descendantsOf` avec un `Set`) |

Le correctif est **borné par ce qu'on demande**, jamais par la scène : `withHungUnder` raccroche
les corps sous les nœuds dont on lit la boîte — la sélection, ou tout si les boîtes sont dessinées
sur tout — et les ressort. Relevés rejoués après : S3 passe 0,28 · 0,30, `1 bougé` 3,1 · 3,6,
`1 ajouté` 110 · 116. Rien n'a bougé.

## 9. Ce que cette phase ne mesure pas

- **Un niveau PLAT.** Les deux scènes du banc sont des cubes pleins, ce qui est le pire cas pour une
  grille de régions — § 6.
- **Une vue prise DANS le niveau**, sans laquelle ni la distance max ni le culling ne se jugent — § 7.
- **Plus d'une lampe qui projette.** Une seconde carte d'ombre doublerait la part du § 7.
- **Les scènes du produit** : le plus gros groupe qu'elles portent fait trois corps, aucune
  n'atteint le plancher de seize, donc aucune n'est touchée dans un sens comme dans l'autre.
- **La mémoire.** Le tas JS suit l'ordre de mesure — § 4 — et la VRAM n'est publiée par aucune API.
- **Windows et Linux** : un seul poste, un seul pilote.
- **L'écran.** Aucune des trois scènes n'a été regardée en mode arêtes à 50 000 corps ; ce que le
  § 5 en dit vient de la lecture du code et de deux cas de suite, pas d'un œil. **Les cinq surfaces
  du § 8 bis non plus** : elles sont gardées par des cas, jamais vues.
- **Le coût de `withHungUnder` quand les boîtes sont dessinées sur TOUT** (`boundingBoxes: 'all'`) :
  une passe sur la scène entière par rafraîchissement des aides. Ce mode bâtit déjà une aide par
  nœud, donc le rapport est tenu — mais il n'est pas chiffré.

## 10. Où part le temps, maintenant

Sur S3, la frame tient à 8,3 ms au vsync, dont **4,2 ms de GPU** et 0,28 ms de passe de scène. Le
GPU, c'est **14,3 M de triangles** par frame — 7,1 M par passe, dessinés deux fois. Et ces
triangles viennent des FORMES : les 16 667 sphères à 352 triangles pèsent 5,9 des 7,1 M.

**Le budget qui reste n'est ni dans le parcours, ni dans les appels, ni dans le culling : il est
dans le nombre de triangles par corps.** C'est le chantier LOD, que ce lot s'interdisait
d'ouvrir.

## 11. Le banc, pour rejouer

```bash
SPIKE_PAGE=sources.html SPIKE_QUERY="counts=10000,50000" SPIKE_OUT=sources-c2.json npx electron spike/webgpu/run.mjs
SPIKE_PAGE=engine.html SPIKE_QUERY="scenes=S1,S2,S3" SPIKE_OUT=engine-c2-normal.json npx electron spike/webgpu/run.mjs
SPIKE_PAGE=engine.html SPIKE_QUERY="scenes=S1,S2,S3&order=reversed" SPIKE_OUT=engine-c2-reversed.json npx electron spike/webgpu/run.mjs
SPIKE_PAGE=engine.html SPIKE_QUERY="scenes=S2,S3&groupings=instanced&shadows=off" SPIKE_OUT=c2b-noshadow.json npx electron spike/webgpu/run.mjs
```

Le balayage du § 6 se rejoue en changeant `TRIANGLES_PER_REGION` dans
`renderer/src/engines/scene/instanceRegions.ts` entre deux lancements de la ligne
`scenes=S2,S3&groupings=instanced` : **aucun drapeau de production n'a été ajouté pour le mesurer**.
Les fichiers `sources-c2.json`, `engine-c2-*.json`, `c2b-region-*.json`, `c2b-rep-*.json`,
`c2b-far-*.json` et `c2b-noshadow.json` sont les relevés de ce rapport.
