# Mesures — enregistrer et rouvrir un document 3D

**Mesures faites le** : 7 août 2026 · **Branche** : `feat/scene-document` · **Base** : `739a18c`

Cette étape branche l'espace 3D sur la couche de documents déjà présente sur main
(`src/main/project/documents.ts`). Elle ajoute donc du travail synchrone dans le **processus
main** — décoder ce que le renderer envoie, puis produire le texte du fichier — et une lecture
par frame dans le **renderer**, le marqueur « modifié » lu par un sélecteur zustand.

**Conclusion en une phrase : aux tailles de scène que l'éditeur sait produire aujourd'hui, un ⌘S
coûte 0,15 ms au main et le marqueur 0,00005 ms par frame ; le gel des fenêtres commence vers
5 500 nœuds, et ce n'est pas la sérialisation qui l'y amène — c'est le décodage du clone IPC,
deux fois et demie plus lourd qu'elle.**

---

## 1. Le protocole

| | |
|---|---|
| Machine | Apple M2 Max, 12 cœurs |
| OS | macOS 26.5.2 |
| Node / pnpm | v24.8.0 / 11.16.0 |
| Instrument | `vitest bench`, environnement **node** — `pnpm bench` |

Micro-benchmarks isolés, sans React ni GPU : ce qui est mesuré est du JavaScript pur, et le piège
dev/prod de l'audit du 8 août (`jsxDEV`, `validateProperty`) ne s'y applique pas. Trois fichiers
versionnés et rejouables :

- `src/main/project/documents.bench.ts` — le coût main d'une sauvegarde et d'une ouverture
- `src/renderer/src/engines/scene/scene-document.bench.ts` — la validation à l'ouverture
- `src/renderer/src/stores/document-store.bench.ts` — la lecture du marqueur « modifié »

Scène de référence : des mailles `sphere` 32 × 16, chacune avec sa transformation complète et un
matériau portant une texture — le nœud le plus lourd que le format sait écrire. De 50 nœuds
(large pour ce que le menu Ajouter permet de construire à la main) à 50 000.

**Les deux seuils**, rappelés parce qu'ils ne sont pas le même chiffre :

- **16 ms** dans le **main** — au-delà, toutes les fenêtres gèlent, y compris les détachées.
- **8,33 ms** par frame dans le **renderer** sur un écran 120 Hz.

### Ce qui est mesuré, et pourquoi pas seulement `stringify`

Un `invoke` fait traverser un **objet**, pas un texte : `ipcMain` en décode le clone structuré
sur le thread principal avant que le handler ne soit appelé. Ce décodage est du travail que ce
branchement introduit au même titre que la sérialisation, et l'ignorer sous-estime le coût réel
d'un ⌘S. Les tableaux mesurent donc la paire, avec `node:v8` — le sérialiseur qu'utilise l'IPC
d'Electron.

`createDocumentFiles` n'est pas appelé : ce qui est chronométré est sa moitié synchrone. Le
`writeFile` et le `rename` qui l'entourent sont asynchrones et hors du thread JS.

Aux grandes tailles ces mesures sont dominées par le GC (`rme` jusqu'à 20 %) ; la colonne retenue
est donc le **minimum**, stable d'une exécution à l'autre. Le détail de la seule sérialisation,
lui, est propre (`rme` ≤ 2 %).

---

## 2. Écrire un document — le processus main

Le coût complet d'un ⌘S sur le thread principal : décoder le clone, puis produire le texte.

| Nœuds | Total main | dont `JSON.stringify` | part du décodage | % du seuil de 16 ms |
|---|---|---|---|---|
| 50 | **0,130 ms** | 0,038 ms | 71 % | 1 % |
| 500 | 1,41 ms | 0,364 ms | 74 % | 9 % |
| 5 000 | 14,6 ms | 3,90 ms | 73 % | 91 % |
| 10 000 | 29,4 ms | 7,92 ms | 73 % | 184 % |
| 15 000 | 44,6 ms | 11,9 ms | 73 % | 279 % |
| 50 000 | 163 ms | 39,9 ms | 76 % | 1019 % |

Le franchissement des 16 ms se situe à **≈ 5 500 nœuds**.

### Ce que ça dit du code de main

`documents.ts` écrit sans indentation, avec ce commentaire :

> *No indentation: a scene of twenty thousand nodes doubles in size, and `stringify` is
> synchronous in the process every window's responsiveness sits on.*

L'instinct est juste et le gain réel — l'indentation coûtait environ 1,7× (mesuré : 6,70 ms
contre 3,90 ms à 5 000 nœuds). Mais **c'est la plus petite moitié qui a été optimisée** : le
décodage du clone pèse presque trois fois la sérialisation, et il n'est traité nulle part. Sans
indentation le plafond passe de ≈ 4 700 à ≈ 5 500 nœuds — il ne change pas d'ordre de grandeur.

Rien n'est déplacé hors du main ici, et c'est délibéré : **pour un gain de 0,13 ms** sur la scène
que l'éditeur sait construire, un `utilityProcess` ou un passage par chaîne coûterait un canal de
plus, une frontière moins typée et un chemin d'erreur supplémentaire. Une correction sans gain
mesurable est une correction à ne pas faire.

Ce qui change la donne est nommément l'**import glTF/GLB** : un GLB apporte ses maillages par
milliers, pas par unités. Le jour où un import pose 5 500 nœuds dans une scène, ⌘S gèle toutes
les fenêtres — et il faudra alors s'attaquer au décodage d'abord, à la sérialisation ensuite.

## 3. Ouvrir un document — deux threads différents

Côté **main**, lire c'est `JSON.parse` puis encoder le clone de la réponse :

| Nœuds | Total main | % du seuil de 16 ms |
|---|---|---|
| 50 | **0,127 ms** | 1 % |
| 500 | 1,32 ms | 8 % |
| 5 000 | 14,0 ms | 88 % |
| 10 000 | 28,7 ms | 179 % |
| 50 000 | 144 ms | 899 % |

Côté **renderer**, chaque nœud est ensuite vérifié contre les tables de `property-fields.ts`
avant d'entrer dans la scène. C'est du travail sur le thread UI, **une fois par ouverture**, pas
par frame — une ouverture de 20 ms ne se voit pas, c'est un chargement.

| Nœuds | Avant | **Après correction** | Gain |
|---|---|---|---|
| 50 | 0,027 ms | **0,020 ms** | −26 % |
| 500 | 0,267 ms | 0,193 ms | −28 % |
| 5 000 | 2,63 ms | 1,93 ms | −27 % |
| 15 000 | 7,97 ms | 5,79 ms | −27 % |
| 50 000 | 26,8 ms | 19,5 ms | −27 % |

**La correction** : la liste des champs numériques d'un matériau était reconstruite
(`Object.entries(MATERIAL_SPECS).filter(…)`) **pour chaque nœud**, alors que la table est une
constante de module. Hissée hors de la boucle — une ligne, 27 % du coût de validation.

## 4. Le marqueur « modifié » — par frame

`SceneDocument` lit `isDirty` par un sélecteur zustand : il s'exécute à chaque changement d'état,
donc **une fois par frame** pendant qu'un champ de l'inspecteur est glissé.

Mesuré sur une pile d'undo pleine (100 entrées, `HISTORY_LIMIT`) :

| | Moyenne | % d'une frame à 8,33 ms |
|---|---|---|
| `isDirty` | **0,00005 ms** (20,1 M appels/s) | 0,0006 % |

L'audit du 8 août chiffrait React à 0,15 ms d'une frame de 3,31 ms, soit 4,5 % du CPU occupé. Le
marqueur ajoute trois millièmes de pour cent de ce que React coûte déjà. Le titre de l'onglet,
lui, n'est réécrit que lorsque le booléen bascule — une fois par geste, pas par frame.

Aucune mesure de bout en bout n'a été rejouée : rien de ce qui a été ajouté au chemin chaud n'est
de l'ordre de grandeur du bruit de l'audit précédent.

## 5. Ce qui a été corrigé sans mesure, et pourquoi

**Une double lecture au montage.** Le `StrictMode` de React 19 exécute deux fois chaque effet de
montage, et `DocumentArea` est remonté à chaque changement d'espace : une ouverture valait deux
lectures du même fichier, donc deux `JSON.parse` dans le main. `restoreDocument` retient la
lecture en cours. C'est qualitatif, pas quantitatif — la mesure aurait seulement confirmé le
facteur deux.

## 6. Ce qui reste ouvert

- **Le décodage du clone IPC**, 73 % du coût d'un ⌘S, intouché. C'est là qu'il faudra commencer
  quand l'import glTF fera entrer des scènes à cinq chiffres.
- **La durabilité après coupure de courant** : `documents.ts` renomme atomiquement, ce qui
  protège d'un crash en cours d'écriture, mais ne fait pas de `fsync`. C'est écrit dans son
  propre commentaire, et ce n'est pas ce branchement qui le change.
