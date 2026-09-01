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
| S1 · 544 | instanced | **0,5 · 1,0** | 0,21 · 0,24 | 1,71 · 1,71 | 120 | 122 | 1 000 | 394 024 |
| S1 · 544 | batched | **1,1 · 1,3** | 0,45 · 0,43 | 3,24 · 5,19 | 120 | 122 | 988 | 388 764 |
| S2 · 10 000 | instanced | **1,6 · 3,8** | 1,19 · 1,69 | 2,22 · 4,17 | 120 | 57 | 20 000 | 2 853 144 |
| S2 · 10 000 | batched | **10,1 · 12,3** | 3,97 · 4,75 | 4,03 · 5,39 | 70 · 64 | **25** | 19 734 | 2 816 212 |
| S3 · 50 000 | instanced | **22,2 · 26,9** | 12,0 · 16,4 | 5,81 · 6,83 | 55,9 · 44,1 | 169 | 100 000 | 14 266 896 |
| S3 · 50 000 | batched | **50,0 · 51,0** | 28,9 · 29,5 | 7,53 · 7,41 | 19,0 · 18,7 | **25** | 98 330 | 14 034 092 |

Temps en ms, deux valeurs = les deux ordres. « Corps dessinés » compte les deux passes.

**Le lot divise les appels par 2,3 sur S2 et par 6,8 sur S3, et coûte plus de CPU partout :**
1,3 à 2,2× la frame sur S1, 3,2 à 6,3× sur S2, 1,9 à 2,3× sur S3 selon l'ordre de mesure. La
passe de scène, moins bruitée, dit la même chose : ×1,8 à 2,1 sur S1, ×2,8 à 3,3 sur S2, ×1,8 à
2,4 sur S3. Le GPU monte aussi — les matrices d'un lot se
lisent dans une texture, quatre texels par sommet, là qu'un `InstancedMesh` les reçoit en
attribut.

## 3. Où part le temps du lot

Ventilation sur S2, chemin `batched`, les deux drapeaux rabattus par le banc juste avant que
three ne les lise (`sort=off`, `cull=off`) :

| variante | frame | passe | FPS |
|---|---:|---:|---:|
| tri + culling (livré) | 10,1 | 3,97 | 70 |
| sans tri | 8,1 | 2,43 | 65 |
| sans culling | 11,1 | 4,24 | 68 |
| sans tri ni culling | **6,4** | **1,47** | 78 |
| *instanced, pour comparer* | *1,6* | *1,19* | *120* |

Et sans ombre, les deux chemins : instanced 1,8 de frame et 1,35 de passe pour 33 appels ;
batched 4,3 et 3,88 pour 17 appels.

Trois lectures :

1. **`onBeforeRender` d'un `BatchedMesh` parcourt chaque instance à chaque passe** — lecture de
   la matrice dans la texture, sphère, frustum, puis tri. Sur S2 c'est 2,5 ms par passe — un
   quart de microseconde par instance — et il y a deux passes : la carte d'ombre du soleil, puis
   la couleur. Sans ombre l'écart entre les deux chemins passe de 8,5 à 2,5 ms de frame. **Une
   seconde lampe qui projette ajouterait une passe de plus.**
2. Les deux drapeaux rabattus, la passe de scène du lot rejoint celle de l'instance (1,47 contre
   1,19). **La frame, elle, reste à 6,4 contre 1,6** : le résidu est dans la passe d'ombre des
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

**Onze millisecondes de la passe de 12 à 16 sur S3 sont la traversée des sources cachées**, et figer
leurs matrices n'en rend que 0,3 : c'est le parcours qui coûte, pas la composition. Aucun
regroupement ne touche à ce chiffre. C'est la vraie cible d'une phase à venir — sortir les
sources du graphe rendu, en gardant un conteneur détaché pour le picking et le gizmo — et elle
n'a pas été engagée ici : hors périmètre de la phase 1.

## 4. Les critères, un par un

| critère | verdict | mesure |
|---|---|---|
| S1 : CPU render ≤ avant | 🛑 **non atteint** | frame 1,1 · 1,3 contre 0,5 · 1,0 ms, passe 0,45 contre 0,21 · 0,24 |
| S1 : aucun recul fonctionnel | ✅ | § 6 |
| S1 : FPS sans régression mesurable | ✅ | 120 des deux côtés, au vsync |
| S2 plein champ ≥ 60 FPS | ✅ | 70 · 64 — mais l'instance y est à 120 |
| S2 plein champ : appels ≤ 30 | ✅ | 25 |
| tas JS ≤ 1,5× avant | ⚠️ **non concluant** | § 5 |
| apply pas pire qu'après A | ✅ | § 5 — « 1 ajouté » a rejoint l'instance depuis que les arbres de picking se bâtissent au premier clic |

**Le critère qui commande est le premier, et il n'est pas atteint.** Les appels de dessin
n'étaient plus le goulot après le chantier B — 57 appels dessinent S2 à 120 FPS — et le lot
achète des appels avec du CPU, qui est la ressource rare. **Le défaut reste donc `instanced`** ;
`batched` est livré, testé et mesurable, pas activé. Ce n'est pas un échec du lot mais une
mesure : `BatchedMesh` natif, tel que three r185 le fait tourner, coûte un parcours par instance
et par passe que l'`InstancedMesh` ne paie jamais.

## 5. `apply` et le tas

| scène | chemin | 1er apply | rien ne change | 1 bougé | 1 ajouté |
|---|---|---:|---:|---:|---:|
| S1 | instanced | 14,3 · 9,6 | 0,1 | 0,1 | 1,5 · 1,3 |
| S1 | batched | 14,6 · 14,7 | 0,0 · 0,1 | 0,1 | 1,5 · 2,5 |
| S2 | instanced | 102,7 · 96,6 | 0,5 · 0,6 | 0,6 | 14,8 · 14,6 |
| S2 | batched | 81,2 · 113,9 | 0,4 · 0,5 | 0,6 · 0,7 | 15,8 · 19,6 |
| S3 | instanced | 456,8 · 471,6 | 2,0 · 2,1 | 3,2 · 4,2 | 72,2 · 79,5 |
| S3 | batched | 408,6 · 422,1 | 2,1 · 2,3 | 3,2 · 3,4 | 83,4 · 74,4 |

« Rien » et « 1 bougé » sont identiques — ces passes ne regroupent pas. « 1 bougé » déplace
TOUJOURS le dernier corps, comme `benchSupport` l'exige : un index qui tourne change deux
identités par passe. « 1 ajouté » refait le regroupement ; une première passe y comptait +40 à
+90 % pour le lot, qui bâtissait l'arbre de picking de chaque géométrie à chaque regroupement.
Bâti au premier clic, l'écart est dans le bruit.

Tas JS en Mo, `avant → chargé → après 100 éditions`, ordre normal puis inversé :

| scène | instanced | batched |
|---|---|---|
| S1 | 13,1 → 25,6 → 23,9 · 24,4 → 21,4 → 26,2 | 25,0 → 39,8 → 34,6 · 13,1 → 19,8 → 23,4 |
| S2 | 35,4 → 72,5 → 87,5 · 89,3 → 131,6 → 131,2 | 97,3 → 127,8 → 139,1 · 27,2 → 91,2 → 79,4 |
| S3 | 148 → 283 → 265 · 299 → 261 → 295 | 260 → 256 → 285 · 140 → 264 → 305 |

**La scène mesurée en second hérite du tas de la première, non ramassé** — sur S3 le « chargé »
du second va de −38 à +135 Mo selon l'ordre, pour la même scène. Sur S2, le lot charge +31 · +64
Mo contre +37 · +42 pour l'instance : la plage du lot recouvre celle de l'instance, rien ne
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

- **Le coût d'un clic.** Sur le chemin par lots, les sources restent atteignables par le
  raycaster ET les lots le sont : un clic rencontre les deux, au même point, et rend le même
  noeud. Ce doublon n'est pas chronométré, ni le premier clic, qui bâtit les arbres des lots. Sur
  le chemin instancié rien n'a changé : la source seule répond. `scenePicking.bench.ts` n'a pas
  été rejoué.
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
- **Le résidu de la passe d'ombre des lots** (§ 3, lecture 2) : près de 5 ms de frame sur S2
  qui ne sont ni le tri ni le culling, et que ce banc n'a pas ventilés plus loin.
- **Le bruit d'une passe à l'autre.** Les deux ordres de mesure donnent 0,5 et 1,0 ms de frame
  pour la même scène S1 instanciée, 1,6 et 3,8 sur S2 : à ces tailles la frame se lit à 100 µs
  près et suit ce que la machine fait d'autre. Les rapports entre chemins tiennent dans les deux
  ordres ; les valeurs absolues sous 2 ms ne se comparent pas d'un rapport à l'autre.

## 8. Deux choses à retenir pour la phase 2

1. **Les régions de l'`InstancedMesh` ne coupent rien sur S2 et S3.** En vue tournée, l'instance
   dessine 20 000 corps sur 20 000 (S2) et 97 906 sur 100 000 (S3) : chaque groupe pèse moins de
   `TRIANGLES_PER_REGION`, donc il tient dans UNE région, dont la sphère englobe tout le niveau.
   Le culling par instance de three ne s'active jamais sur ce chemin. C'est exactement ce que la
   phase 2 doit mesurer d'abord — et c'est mesuré : 70 % hors champ ne change pas la passe
   (12,0 → 11,7 et 16,4 → 16,1 ms sur S3, selon l'ordre).
2. **Onze millisecondes sur douze à seize à S3 sont les sources cachées**, pas le dessin. Tant qu'elles
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
