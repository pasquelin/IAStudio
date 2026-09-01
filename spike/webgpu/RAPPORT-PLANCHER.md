# Plancher d'instanciation — ce que descendre à 16 casse, et ce que ça coûte

Branche `feat/instancing-floor`, partie de `feat/apply-dirty`. Mesuré le 2026-09-01,
**Apple M2 Max**, Electron 43 / Chromium 150, three 0.185.1, WebGL.

Le gain de rendu n'est pas remesuré : il est établi par le commit `0d9b434f3`. Ce rapport porte
sur ce que le changement CASSE, et sur les deux mesures demandées.

## 1. Ce que le changement fait aux scènes du produit : RIEN

Les neuf modèles de scène que le studio sait ouvrir, plus le niveau de démonstration :

| scène | noeuds | meshes | groupes | 5 plus gros | instanciés@64 | instanciés@16 |
|---|---:|---:|---:|---|---:|---:|
| empty | 3 | 0 | 0 | — | 0 | 0 |
| basic | 5 | 2 | 2 | 1, 1 | 0 | 0 |
| photoStudio | 6 | 2 | 2 | 1, 1 | 0 | 0 |
| cinematic | 5 | 1 | 1 | 1 | 0 | 0 |
| archvis | 3 | 1 | 1 | 1 | 0 | 0 |
| postProcessing | 9 | 4 | 4 | 1, 1, 1, 1 | 0 | 0 |
| firstPerson | 38 | 32 | 23 | 3, 2, 2, 2, 2 | 0 | 0 |
| thirdPerson | 38 | 32 | 23 | 3, 2, 2, 2, 2 | 0 | 0 |
| topDown | 38 | 32 | 23 | 3, 2, 2, 2, 2 | 0 | 0 |
| playground | 34 | 31 | 22 | 3, 2, 2, 2, 2 | 0 | 0 |

**Le plus gros groupe de tout le produit fait TROIS corps.** Aucune scène livrée n'atteint 16 ni
64, et un regroupement réel sur le playground confirme le comptage : zéro noeud groupé, zéro
instance. Le changement ne modifie donc rien de ce que le studio ouvre aujourd'hui — il porte sur
ce qu'un utilisateur construit en copiant un décor, que le banc ci-dessous simule.

## 2. Validation fonctionnelle

Scène du banc : 544 corps en 18 groupes de 4 à 60, cinq formes, un matériau par groupe, textures,
ombres portées et reçues. **0 corps instancié à 64, 500 à 16** — le contraste maximal.

| point | verdict | ce qui en fait foi |
|---|---|---|
| regroupement au bon seuil | ✅ | `instancingFloor.test.ts`, cas ajouté |
| picking par `acceleratedRaycast` sur un corps instancié | ✅ | cas ajouté, avec le vrai accélérateur posé sur `Mesh.prototype` |
| le corps est hors de la couche par défaut | ✅ | cas ajouté |
| matrice à jour, ce que lit le gizmo | ✅ | cas ajouté |
| ombre portée / reçue par instance | ✅ | cas ajouté, plus `instancing.test.ts` « carries the shadow flags » |
| visibilité par objet | ✅ | cas ajouté, plus `instancing.test.ts` « skips a mesh the scene does not draw » |
| sélection et surbrillance | ✅ *par construction* | les sources restent dans la scène ; `instancing.test.ts` « takes the meshes off the camera layer, and off it alone » |
| gizmo pendant un glissé | ✅ | `instancing.test.ts` « follows the mesh, without waiting for the gesture to end » |
| export de scène | ✅ | cas ajouté : tout corps est exporté, instancié ou non |
| déplacement puis retour | ✅ | cas ajouté : même graphe qu'une scène jamais éditée |
| **suppression puis restauration** | 🛑 **trou** | voir ci-dessous |
| `applyEquivalence.test.ts` | ✅ | inchangé, au vert |

### Le trou, et il ne vient pas d'ici

Un corps supprimé puis restauré est **listé en fin d'export** au lieu de reprendre sa place :
`b0 b1 b2 b4 b3` là où une scène jamais éditée donne `b0 b1 b2 b3 b4`. Rien du contenu ne diffère
— mêmes noeuds, même nombre de meshes, mêmes placements.

**Ce n'est pas une régression de ce lot, et c'est mesuré plutôt que supposé** : le cas échoue à
l'identique avec le plancher remis à 64, et avec le `SceneRenderer` de `develop`. Il précède le
plancher comme les dirty sets.

Ce qu'il coûte : un `.gltf` réexporté après une annulation a un ordre de noeuds différent, donc un
diff bruyant pour qui versionne ses scènes. Rien à l'écran.

**Correctif proposé, non implémenté** : un noeud rebâti est ajouté à la fin des enfants de la
scène three.js, et l'export suit cet ordre. Le réinsérer à l'index que l'état lui donne, ou trier
les enfants sur l'ordre du document au moment de l'export, ferme le cas. À faire dans son propre
lot, avec le test de cette suite retourné en garde.

## 3. Les deux mesures, 64 contre 16

544 corps, **91 mobiles réécrits à chaque frame — 16,7 %**. Cinq passes.

| plancher | corps instanciés | draw calls | CPU `render` | re-upload `instanceMatrix` | GPU | FPS |
|---:|---:|---:|---:|---:|---:|---:|
| 64 | 0 | 1 088 | 0,91 à 1,11 ms | 0 ms | 0,51 à 0,64 ms | 125 à 126 |
| 16 | 500 | 114 | **0,19 à 0,27 ms** | **0,007 ms** | 0,44 à 0,88 ms | 120 à 129 |

- **Le CPU de rendu est divisé par 3,6 à 5,3** selon la passe, médiane ≈ 4,8. C'est causal : la
  passe à l'ordre inversé donne le même rapport (1,00 contre 0,24).
- **Le re-upload d'`instanceMatrix` coûte 0,007 ms** pour 91 corps réécrits par frame. C'est le
  coût que la question visait, et il est négligeable.
- **Le GPU n'a pas de direction stable** : −20 %, −13 %, +11 %, +36 % selon la passe. Il ne bouge
  pas de façon mesurable.
- **Le FPS ne départage rien** : les deux sont au vsync de l'écran.

### Mémoire

| | tas chargé | tas après 100 éditions |
|---|---:|---:|
| ordre normal, 64 puis 16 | 8,4 à 10,2 → **16,6 à 17,1** | 10,6 à 12,6 → 15,0 à 22,0 |
| ordre inversé, 16 puis 64 | **7,4** → 14,8 | 7,9 → 14,7 |

🛑 **Le tas suit l'ORDRE de mesure, pas le plancher.** La seconde scène mesurée porte toujours
sept mégaoctets de plus, que ce soit celle à 64 ou celle à 16 — c'est le tas de la première, pas
encore ramassé. **Aucun effet du plancher sur le tas JS n'est mesurable ici.**

Mémoire du processus renderer, relevée par phase : 140 Mo pendant la phase à 64, 156 Mo pendant
celle à 16. Même biais d'ordre, échantillonnage à deux secondes : **ce chiffre ne conclut rien**.

**Une limite qui compte, et qui n'est pas levée** : ce banc construit SOIT des meshes séparés SOIT
des `InstancedMesh`. Le vrai moteur garde les meshes sources EN PLUS des instances, sur la couche
`DRAWN_BY_INSTANCE`. Le surcoût mémoire réel du moteur — 544 meshes plus 13 instances contre 544
meshes seuls — n'est donc PAS mesuré par ce rapport.

## 4. Recommandation

**Garder 16.**

- Le rendu y reprend 90 % du CPU (commit `0d9b434f3`), et sur la scène de validation le CPU de
  rendu est divisé par près de cinq.
- Le coût que le plancher était censé retenir — le re-upload des matrices d'une scène qui bouge —
  vaut **0,007 ms** à 16,7 % de corps mobiles.
- Rien de la validation fonctionnelle ne casse. Le seul point rouge précède ce lot et ne dépend
  ni du plancher ni de l'instanciation.
- Sur les scènes que le produit livre aujourd'hui, le changement est **sans effet** : aucun groupe
  n'atteint 16. Il n'y a donc aucun risque pris sur l'existant.

**Ni 4, ni 8, ni 32 ne sont recommandés, et rien ici ne les distingue de 16.** Ce lot n'a mesuré
aucune de ces valeurs sur les deux axes qui pourraient les départager — la mémoire, dont ce banc
ne dit rien de fiable, et le comportement d'un groupe de quatre face au découpage en régions.
Descendre plus bas demande d'abord la mesure mémoire que ce rapport déclare manquante.

## 5. Un commentaire périmé, relevé au passage

`instancing.ts:23` renvoie à `pickableLayers` pour dire comment un raycaster atteint un corps
instancié. **Ce symbole n'existe nulle part dans le dépôt.** Ce qui fait le travail est
`withEveryLayer` dans `SceneRenderer.ts`, qui appelle `raycaster.layers.enableAll()`. Corrigé
dans ce lot.
