# Chantier C, phase 1 — regrouper par matériau avec `BatchedMesh`

Branche `feat/batched-mesh`. Mesuré le 2026-09-02, **Apple M2 Max**, Electron 43 / Chromium 150,
three 0.185.1, WebGL. Fenêtre visible 1600×900, `pixelRatio` 1, `backgroundThrottling`
désactivé. Écran à 120 Hz : **le FPS ne départage rien sous 8,3 ms de frame, le CPU est le juge.**

**Le banc pilote le VRAI moteur** (`engine.html`, `engineBench.ts`) : `SceneRenderer` monté sur
une fenêtre, `apply` bâtit chaque mesh, `redraw` demande chaque frame. Aucun mesh n'est construit
par le banc. Les deux chemins se mesurent sur le même build, par le flag `grouping` de
`SceneRendererOptions`. Chaque scène est mesurée dans les deux ordres (`instanced` puis `batched`,
et l'inverse) ; les deux valeurs sont écrites quand elles diffèrent.

## Ce qui a été livré

- `batching.ts` : un `BatchedMesh` par matériau, `perObjectFrustumCulled` et `sortObjects` posés,
  picking par `computeBatchedBoundsTree` et `acceleratedRaycast` posé sur `BatchedMesh.prototype`
  (`Mesh.prototype` était patché mais `BatchedMesh` redéfinit `raycast`). Le champ que three r185
  et three-mesh-bvh écrivent tous deux sur un tel hit est **`batchId`**, vérifié dans les deux
  sources ; `nodeIdOf(hit)` le traduit en identifiant de noeud, et `nodeAt` du moteur le lit
  avant le nom de l'objet.
- Le flag `grouping: 'instanced' | 'batched'`. **Le défaut est `instanced`** — voir § 4.
- Un trou du rapport B corrigé dans son propre commit : un noeud supprimé puis restauré reprend
  sa place dans le fichier exporté, racines et enfants (`sceneRendererExportOrder.test.ts`).

## 1. Comment lire ces chiffres

- **`frame`** est la frame que le studio dessine — passe d'ombre, panneaux, post, trihèdre —
  chronométrée entre l'horodatage du `requestAnimationFrame` et l'après-dessin, à 100 µs près.
  **`passe`** est la passe de scène seule, sans ombre ni post, prise sur un bloc de quinze
  `drawFrom` : c'est elle qui se compare au banc du plancher.
- **`appels`** sont comptés sur le contexte WebGL (`drawElements`, `drawElementsInstanced`,
  `multiDrawElementsWEBGL`) : un multi-draw compte UN, comme dans `renderer.info`. Avec les
  ombres, chaque objet part deux fois — la carte du soleil, puis la couleur.
- **« 70 % hors champ »** : même position de caméra, visée tournée par bissection jusqu'à ce que
  30 % des centres restent dans le champ (30,1 % sur S1, 30,0 % sur S2 et S3).
- **Le tas JS suit l'ordre de mesure, pas le flag** — comme dans le rapport B. Les deux ordres
  sont donnés ; aucune conclusion n'en est tirée.
- Un soleil qui projette dans les trois scènes, parce que le produit livre les ombres allumées.

## 2. Résultat, plein champ

| scène | chemin | frame | passe | GPU | FPS | appels | corps dessinés | triangles |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| S1 · 544 | instanced | **0,8 · 1,0** | 0,22 · 0,23 | 1,71 · 1,11 | 120 | 122 | 1 000 | 394 024 |
| S1 · 544 | batched | **1,4 · 1,5** | 0,45 · 0,47 | 3,72 · 2,59 | 120 | 122 | 988 | 388 764 |
| S2 · 10 000 | instanced | **3,1 · 3,5** | 1,61 · 1,59 | 2,50 | 119 · 120 | 57 | 20 000 | 2 853 144 |
| S2 · 10 000 | batched | **10,4 · 12,3** | 3,87 · 4,87 | 4,17 · 4,10 | 68 · 66 | **25** | 19 734 | 2 816 212 |
| S3 · 50 000 | instanced | **26,7 · 27,4** | 16,5 · 16,6 | 6,08 · 6,97 | 44,6 · 43,7 | 169 | 100 000 | 14 266 896 |
| S3 · 50 000 | batched | **50,8 · 50,6** | 28,8 · 29,5 | 7,44 · 7,41 | 19,0 · 18,8 | **25** | 98 330 | 14 034 092 |

Temps en ms, deux valeurs = les deux ordres. « Corps dessinés » compte les deux passes.

**Le lot divise les appels par 2,3 sur S2 et par 6,8 sur S3, et coûte plus de CPU partout :**
1,7× la frame sur S1, 3,4× sur S2, 1,9× sur S3. Le GPU monte aussi — les matrices d'un lot se
lisent dans une texture, quatre texels par sommet, là qu'un `InstancedMesh` les reçoit en
attribut.

## 3. Où part le temps du lot

Ventilation sur S2, chemin `batched`, les deux drapeaux rabattus par le banc juste avant que
three ne les lise (`sort=off`, `cull=off`) :

| variante | frame | passe | FPS |
|---|---:|---:|---:|
| tri + culling (livré) | 10,4 | 3,87 | 68 |
| sans tri | 8,5 | 2,25 | 69 |
| sans culling | 10,7 | 4,13 | 68 |
| sans tri ni culling | **7,1** | **1,51** | 72 |
| *instanced, pour comparer* | *3,1* | *1,61* | *119* |

Et sans ombre, les deux chemins : instanced 1,9 de frame et 1,23 de passe pour 33 appels ;
batched 4,9 et 4,21 pour 17 appels.

Trois lectures :

1. **`onBeforeRender` d'un `BatchedMesh` parcourt chaque instance à chaque passe** — lecture de
   la matrice dans la texture, sphère, frustum, puis tri. Sur S2 c'est 2,4 ms par passe, et il y
   a deux passes : la carte d'ombre du soleil, puis la couleur. Sans ombre l'écart passe de 7,3 à
   3,0 ms. **Une seconde lampe qui projette ajouterait une passe de plus.**
2. Les deux drapeaux rabattus, la passe de scène du lot rejoint celle de l'instance (1,51 contre
   1,61). **La frame, elle, reste à 7,1 contre 3,1** : le résidu est dans la passe d'ombre des
   lots, que ce banc ne ventile pas plus finement.
3. Le culling par instance FAIT son travail : en vue tournée, le lot dessine 676 corps sur S1 et
   65 302 sur S3 là où l'instance en dessine 1 000 et 97 906. Ce qu'il économise sur le GPU
   (1,55 contre 0,87 sur S1, tout de même au-dessus) ne rattrape pas ce qu'il coûte sur le CPU.

### Le plancher que ni l'un ni l'autre ne rend : les sources

Les deux chemins gardent les 50 000 meshes sources dans la scène, sur `DRAWN_BY_INSTANCE`, pour
le picking, le gizmo et l'export. three les traverse quand même — `updateMatrixWorld` puis
`projectObject`, dans chaque passe. Mesuré à part (`sources.html`, scène synthétique de 48
`InstancedMesh` avec ombre, mêmes corps) :

| corps | sans source | sources (`matrixAutoUpdate` vrai, ce que fait le moteur) | sources figées |
|---:|---:|---:|---:|
| 10 000 | 0,08 ms | **1,18 ms** | 1,07 ms |
| 50 000 | 0,09 ms | **11,17 ms** | 10,90 ms |

**Onze millisecondes de la passe de 16,5 sur S3 sont la traversée des sources cachées**, et figer
leurs matrices n'en rend que 0,3 : c'est le parcours qui coûte, pas la composition. Aucun
regroupement ne touche à ce chiffre. C'est la vraie cible d'une phase à venir — sortir les
sources du graphe rendu, en gardant un conteneur détaché pour le picking et le gizmo — et elle
n'a pas été engagée ici : hors périmètre de la phase 1.

## 4. Les critères, un par un

| critère | verdict | mesure |
|---|---|---|
| S1 : CPU render ≤ avant | 🛑 **non atteint** | frame 1,4 contre 0,8 ms, passe 0,45 contre 0,22 |
| S1 : aucun recul fonctionnel | ✅ | § 6 |
| S1 : FPS sans régression mesurable | ✅ | 120 des deux côtés, au vsync |
| S2 plein champ ≥ 60 FPS | ✅ | 68 · 66 — mais l'instance y est à 119 |
| S2 plein champ : appels ≤ 30 | ✅ | 25 |
| tas JS ≤ 1,5× avant | ⚠️ **non concluant** | § 5 |
| apply pas pire qu'après A | ✅ pour « rien » et « 1 bougé » ; 🛑 pour « 1 ajouté » | § 5 |

**Le critère qui commande est le premier, et il n'est pas atteint.** Les appels de dessin
n'étaient plus le goulot après le chantier B — 57 appels dessinent S2 à 119 FPS — et le lot
achète des appels avec du CPU, qui est la ressource rare. **Le défaut reste donc `instanced`** ;
`batched` est livré, testé et mesurable, pas activé. Ce n'est pas un échec du lot mais une
mesure : `BatchedMesh` natif, tel que three r185 le fait tourner, coûte un parcours par instance
et par passe que l'`InstancedMesh` ne paie jamais.

## 5. `apply` et le tas

| scène | chemin | 1er apply | rien ne change | 1 bougé | 1 ajouté |
|---|---|---:|---:|---:|---:|
| S1 | instanced | 13,9 · 9,7 | 0,1 | 0,1 | 2,0 · 1,2 |
| S1 | batched | 14,5 · 19,8 | 0,0 · 0,1 | 0,1 | **3,9 · 3,8** |
| S2 | instanced | 105,9 · 100,2 | 0,5 | 0,7 | 13,8 · 12,8 |
| S2 | batched | 89,2 · 116,4 | 0,5 | 0,6 | **19,1 · 23,1** |
| S3 | instanced | 469,7 · 460,6 | 2,6 | 3,3 | 88,5 · 76,1 |
| S3 | batched | 436,9 · 451,7 | 2,1 | 3,2 | 88,1 · 89,0 |

« Rien » et « 1 bougé » sont identiques — ces passes ne regroupent pas. « 1 ajouté » refait le
regroupement : le lot y ajoute la construction du `BatchedMesh` et l'arbre de picking de chaque
géométrie, +40 à +90 % sur S1 et S2, dans le bruit sur S3 où le parcours des 50 000 noeuds
domine.

Tas JS en Mo, `avant → chargé → après 100 éditions`, ordre normal puis inversé :

| scène | instanced | batched |
|---|---|---|
| S1 | 13,0 → 25,6 → 22,8 · 24,5 → 21,7 → 26,2 | 23,9 → 24,2 → 35,8 · 13,1 → 23,1 → 23,5 |
| S2 | 23,5 → 72,1 → 80,3 · 82,8 → 126,0 → 149,5 | 90,3 → 126,3 → 146,0 · 27,2 → 70,6 → 73,1 |
| S3 | 155 → 274 → 295 · 279 → 285 → 293 | 288 → 282 → 279 · 126 → 282 → 283 |

**La scène mesurée en second hérite du tas de la première, non ramassé** — sur S3 le « chargé »
du second va de −6 à +156 Mo selon l'ordre, pour la même scène. Sur S2, le seul cas où les deux
ordres se ressemblent, le lot charge +36 · +43 Mo contre +49 · +43 pour l'instance : rien ne
sépare les deux. **Aucun rapport 1,5× ne peut être affirmé ni infirmé par ce banc.** La double
représentation — sources en plus des lots — est bien mesurée sur le vrai moteur, comme demandé,
mais ce que le tas dit est dominé par le ramasse-miettes.

## 6. Validation fonctionnelle, reprise du rapport B

| point | verdict | ce qui en fait foi |
|---|---|---|
| regroupement au bon seuil, par matériau | ✅ test ajouté | `batching.test.ts` : un lot pour deux formes d'une peinture, un lot par peinture, plancher |
| picking sur un corps dessiné par un lot | ✅ test ajouté | `batching.test.ts` : le noeud rendu par `batchId`, après ajout, suppression et restauration ; `sceneRendererGrouping.test.ts` : `nodeAt` cible les lots et lit `nodeIdOf` d'abord |
| le corps est hors de la couche par défaut | ✅ test ajouté | `batching.test.ts` |
| matrice à jour, ce que lit le gizmo | ✅ par construction | les sources ne sont pas touchées ; `instancing.test.ts` le tenait déjà |
| ombre portée / reçue | ✅ test ajouté | `batching.test.ts` : drapeaux portés, groupe séparé quand ils diffèrent |
| visibilité par objet | ✅ test ajouté | `batching.test.ts` : un corps caché ne rejoint aucun lot |
| sélection et surbrillance | ✅ par construction | les sources restent dans la scène, sur `DRAWN_BY_INSTANCE` |
| gizmo pendant un glissé | ✅ test ajouté | `batching.test.ts` : `moved` suit le mesh et élargit les bornes |
| export de scène | ✅ test ajouté | `sceneRendererBatching.test.ts` : tout corps exporté, fichier identique au chemin instancié |
| déplacement puis retour | ✅ test ajouté | `sceneRendererBatching.test.ts` |
| suppression puis restauration | ✅ test ajouté | `sceneRendererBatching.test.ts` |
| ordre d'export après restauration | ✅ **trou corrigé**, commit à part | `sceneRendererExportOrder.test.ts` |
| forme sans index à côté d'une forme indexée | ✅ test ajouté | `batching.test.ts` : deux lots plutôt qu'un `throw` de three |
| mesh à plusieurs matériaux | ✅ test ajouté | dessiné seul |
| mode d'affichage (clay, matcap) sur un lot | ⚠️ **non testé** | un `BatchedMesh` est un `Mesh`, `dressForPane` remplace son matériau comme celui d'une instance — vérifié par lecture, pas à l'écran |
| picking de bout en bout par `nodeAt` | ⚠️ **non exercé** | `nodeAt` est privé et lit une caméra montée ; la garde est textuelle, le mapping est testé au module |

## 7. Ce que cette phase ne mesure pas

- **Le coût d'un clic.** Les sources restent atteignables par le raycaster ET les lots le sont :
  un clic rencontre les deux, au même point, et rend le même noeud. Ce doublon n'est pas
  chronométré. Le raycast seul (`scenePicking.bench.ts`) n'a pas été rejoué.
- **Une scène qui BOUGE pendant qu'elle est dessinée.** `moved` sur un lot réécrit la texture de
  matrices ENTIÈRE à la frame suivante — three n'a pas d'`addUpdateRange` sur une
  `DataTexture` — là où l'instance ne renvoie que seize flottants. `apply « 1 bougé »` ne le
  voit pas : l'envoi se fait au rendu.
- **Plus d'une lampe qui projette.** Le parcours par instance se paie par passe ; ce banc n'en a
  qu'une d'ombre.
- **Les scènes du produit** : aucune n'atteint seize corps d'une même peinture, donc aucune
  n'est touchée, dans un sens comme dans l'autre.
- **La VRAM**, qu'aucune API du web ne publie ; et le tas JS, qui ne dit rien de fiable — § 5.
- **Windows et Linux** : un seul poste, un seul pilote.
- **Le résidu de la passe d'ombre des lots** (§ 3, lecture 2) : 4 ms de frame sur S2 qui ne
  sont ni le tri ni le culling, et que ce banc n'a pas ventilés plus loin.

## 8. Deux choses à retenir pour la phase 2

1. **Les régions de l'`InstancedMesh` ne coupent rien sur S2 et S3.** En vue tournée, l'instance
   dessine 20 000 corps sur 20 000 (S2) et 97 906 sur 100 000 (S3) : chaque groupe pèse moins de
   `TRIANGLES_PER_REGION`, donc il tient dans UNE région, dont la sphère englobe tout le niveau.
   Le culling par instance de three ne s'active jamais sur ce chemin. C'est exactement ce que la
   phase 2 doit mesurer d'abord — et c'est mesuré : 70 % hors champ ne change pas la passe
   (16,5 → 16,4 ms sur S3).
2. **Onze millisecondes sur seize à S3 sont les sources cachées**, pas le dessin. Tant qu'elles
   sont dans le graphe, aucun culling ne descend sous ce plancher.

## 9. Le banc, pour rejouer

```bash
SPIKE_PAGE=engine.html SPIKE_QUERY="scenes=S1,S2,S3" SPIKE_OUT=engine-c1-normal.json npx electron spike/webgpu/run.mjs
SPIKE_PAGE=engine.html SPIKE_QUERY="scenes=S1,S2,S3&order=reversed" SPIKE_OUT=engine-c1-reversed.json npx electron spike/webgpu/run.mjs
SPIKE_PAGE=engine.html SPIKE_QUERY="scenes=S2&groupings=batched&sort=off" SPIKE_OUT=… npx electron spike/webgpu/run.mjs
SPIKE_PAGE=sources.html SPIKE_OUT=sources-results.json npx electron spike/webgpu/run.mjs
```

Paramètres de `engine.html` : `scenes`, `order=reversed`, `groupings=instanced|batched`,
`shadows=off`, `maps=off`, `sort=off`, `cull=off`. Les fichiers `engine-c1-*.json` et
`sources-results.json` sont les relevés de ce rapport.
