# Scenario Studio — reprise

**Le seul document de travail du projet.** État, ce qu'il reste à faire, les mesures acquises, la
méthode. Vérifié dans le code le 7 août 2026.

Les conventions et les invariants sont dans **`CLAUDE.md`**, à la racine — ce fichier ne les répète
pas. Pour *comprendre* le logiciel plutôt que reprendre son développement :
[guide de l'utilisateur](fr/guide-utilisateur.md) et [architecture](fr/architecture.md), également
[en anglais](en/).

## Prompt de reprise

> Je reprends le développement de **Scenario Studio**, dans
> `/Users/pasquelin/Applications/scenario`.
>
> Lis `docs/REPRISE.md` en entier, puis `CLAUDE.md`. Ne refais pas les mesures du § 5 : leurs
> conclusions sont acquises. Puis `git log --oneline -15` et `pnpm validate` pour partir d'une
> base verte.
>
> Commence par me proposer ton plan avant de coder.

Si la demande touche l'API Scenario : `docs/scenario-api/README.md`, 209 pages aspirées en local,
**à consulter avant le web**. La conception validée est dans
`docs/specs/2026-08-06-scenario-studio-design.md`, 13 sections — c'est la seule spec qui reste,
celles de la configuration et de l'espace 3D ayant été supprimées une fois leurs chantiers livrés.

> `docs/specs/`, `docs/scenario-api/` et `docs/superpowers/` sont **ignorés par git**. Un document
> qui compte et qui atterrit dans l'un des trois est invisible du dépôt et absent de tout worktree
> neuf. **Ce qui doit survivre à la session vient ici, et est commité.**

---

# 1. L'état

**557 fichiers dans `src/`. 2088 tests verts sur 201 fichiers. 32 canaux IPC et 10 événements.
6 espaces éditables. 2 types de documents sur 6 savent s'enregistrer.**

`pnpm validate` est vert. L'application démarre par `pnpm start`.

## Ce qui est fait

**Le socle** — Electron + electron-vite + React 19 + TypeScript, shell à docks type IDE, design
system maison (`renderer/src/design/`), i18n fr/en partagé entre le menu natif et l'UI, contrat IPC
typé des deux côtés, `contextIsolation`/`sandbox` actifs, navigation verrouillée.

**La chaîne de génération** — réglages chiffrés par `safeStorage`, client `@scenario-labs/sdk` dans
le main, `ModelRegistry` avec auto-pagination et cache, `JobManager` qui poll seul et borne la
concurrence, `DynamicForm` construit depuis les descripteurs. Aucun formulaire de génération écrit à
la main (invariant 5).

**Les projets** — un dossier, un manifeste, un catalogue SQLite. Le catalogue tourne sur son propre
`worker_threads` : de 16 blocages du thread principal à 0.

**Les six espaces** — Image (PixiJS), 3D (three.js), Vidéo (timeline, moniteur, ffmpeg), Audio,
Skyboxes, Textures. Un éditeur par type de document, chargé à l'ouverture, jamais avant.

**La configuration** — un registre de commandes unique lu par le menu natif, le clavier et l'écran
des raccourcis ; un registre de réglages qui gouverne les préférences et la validation côté main.

**La persistance des documents** — écriture atomique, marque « modifié », puce sur l'onglet,
relecture à l'ouverture. Le mécanisme est générique ; **deux espaces y sont branchés**, la 3D et les
Textures.

**L'entrée d'une image dans un ciel** — l'espace Skyboxes avait son moteur, son undo et son panneau,
mais aucune porte. Trois l'ouvrent : le double-clic sur un asset, le dépôt depuis l'étagère, et la
génération, qui retient le document d'où elle est partie et s'y pose seule. Les modèles de panorama
ont leur famille, reconnue au tag `sc:skybox` — cf. § 3.5.

## Corrigé — ne pas le re-signaler

Ces quatre points traînaient dans les anciennes notes de reprise. Ils sont réglés dans le code.

- **Les documents n'appartenaient à aucun projet.** `useDocuments` était persisté sans clé de projet
  et les onglets d'un projet réapparaissaient dans le suivant, pointant sur des fichiers absents —
  ou pire, sur un fichier de même id dans un autre projet. Le store **n'est plus persisté du tout** :
  le dossier du projet dit quels documents existent, le layout persisté dit lesquels sont ouverts
  (JSDoc de `useDocuments`).
- **`pnpm start` chargeait `out/renderer/`** au lieu du serveur Vite, fenêtre vide.
  `scripts/dev-app-identity.mjs` renomme le bundle *et* son exécutable, ce qui faisait mentir
  `app.isPackaged` en plein run de développement — et six autres comportements basculaient avec lui.
  `src/main/environment.ts` lit désormais `__DEV__`, injecté par `define` au build.
- **Un second registre de commandes** orienté menu natif avait été construit en parallèle du vrai.
  Supprimé. **Ne pas recommencer** — cf. § 3.2.
- **`reconcile` ne parcourait pas l'arbre entier** dans le moteur canvas, ce qui détruisait les
  textures des enfants de groupe. Corrigé — **ne pas le recasser**.

---

# 2. Le plus urgent

**La surface d'erreur.** `handle` ne journalise pas une promesse rejetée, et le renderer n'a aucune
surface pour le dire. Un ⌘S qui échoue laisse la puce, et c'est tout ce qu'il raconte. Une ouverture
qui échoue ne dit rien du tout. Un document dont le fichier a refusé de s'ouvrir refuse ensuite de
s'enregistrer, délibérément, **sans jamais expliquer pourquoi**.

Tant qu'elle manque, chaque nouveau branchement de document ajoute un mode d'échec silencieux — et
il en reste quatre à brancher.

---

# 3. Ce qu'il reste à faire

## 3.1 La couche documents

Le chantier le plus transverse : rien de ce qui suit n'est spécifique à un espace.

**Ce qui est posé.** `main/project/documents.ts` écrit dans `documents/<id>.<ext>`, **atomiquement**
(fichier de transit puis `rename`) et en file d'attente par fichier. Le tour complet — ⌘S, marque
« modifié », puce, relecture — est générique et fonctionne. `IO_BY_KIND` (`app/document-io.ts`)
porte **deux entrées sur six : `scene` et `texture`**.

**1. Quatre types de documents ne savent pas s'enregistrer** — `image`, `sequence` (vidéo), `audio`,
`skybox`. Chacun a besoin de sa paire **sérialiser / relire-et-valider** et d'une entrée dans
`IO_BY_KIND`. Le reste est déjà générique : brancher un espace, c'est écrire son `DocumentIo`, pas
toucher au mécanisme. Prendre `SCENE_IO` et `TEXTURE_IO` comme modèles ; la validation à la relecture
n'est pas facultative, un fichier sur disque est une entrée non fiable.

**2. Fermer un onglet ne demande rien et laisse son fichier orphelin.** `useDocuments.close` existe
et **personne ne l'appelle**. `documents.remove` est exposé jusque dans `preload/index.ts` et n'a
**aucun appelant côté renderer**. La puce « modifié » existe mais n'est consultée nulle part à la
fermeture. À faire ensemble : la confirmation à la fermeture, l'appel à `close`, et le menu
contextuel d'onglet qui offre de supprimer le document.

> Au passage : le commentaire de `stores/documents.ts` dit « Loading is `load` plus
> `pruneDocuments`, in that order » — **`pruneDocuments` n'existe plus**. Un commentaire qui décrit
> un comportement disparu est un défaut à part entière.

**3. Rien ne rouvre un document que le layout ne montre pas.** Le listage existe
(`documents.list()`), c'est l'écran qui manque : un explorateur des documents du projet. Sans lui, un
document fermé sans être dans un layout persisté est inatteignable autrement que par le disque.

**4. Rien ne rapporte une erreur à l'utilisateur** — cf. § 2.

### Deux comportements à connaître avant d'y toucher

Le premier est délibéré, le second est un bug.

**Un document dont le fichier a refusé de s'ouvrir ne s'enregistre plus du tout**, jusqu'à sa
prochaine ouverture — le `Set` `unreadable` dans `app/document-io.ts`, dont la JSDoc porte le
pourquoi. C'est voulu : l'éditeur vide qu'une lecture ratée laisse est indistinguable d'un document
neuf, et sans ce refus le premier ⌘S écrirait `{ nodes: [] }` par-dessus la scène illisible. Le
fichier est la seule copie. **Ne pas lever ce refus** — le vrai remède est la surface d'erreur.

**La marque « modifié » peut mentir** après plus de 100 modifications suivies d'une annulation
complète. `markOf` vaut `past.at(-1) ?? null`, et `HISTORY_LIMIT` plafonne la pile à 100 : au-delà,
les plus anciennes commandes tombent, une annulation intégrale ramène `past` à vide, donc à `null` —
la valeur que porte aussi un document enregistré alors que son historique était vide. Le document se
dit propre alors qu'il ne l'est pas. Le remède est un **jeton monotone par commande** dans
`engines/core/history.ts`, partagé par tous les espaces.

---

## 3.2 Mode Image — jalons 4 à 10

**Jalons 0 à 3 livrés et fusionnés dans `main`.** Plus de branche `feat/image-mode`, plus de
worktree. Moteur : **PixiJS v8, pas three.js**.

### Le socle déjà posé — ne pas le réécrire

**Le registre de commandes appartient à `shared/domain/command.ts`.** `COMMAND_REGISTRY`, une entrée
par commande avec `scope`, `titleKey`, `helpKey`, `defaultBinding` ; les overrides de touches vivent
dans `stores/bindings.ts`. Ajouter une commande, c'est trois choses : un descripteur dans
`COMMAND_REGISTRY`, deux clés i18n (`commands.<nom>.title` / `.help`) dans `fr.json` **et**
`en.json`, et un `case` dans le `switch` du document concerné. Le mode Image a son scope `'canvas'`
et dix commandes (`canvas.zoomIn`, `zoomOut`, `zoomFit`, `zoomActual`, `rulers`, `guides`,
`clearGuides`, `snap`, `undo`, `redo`), exécutées par `ImageDocument` derrière
`useShortcuts({ scope: 'canvas', enabled: active, onCommand: run })` — **le document en avant est le
seul à écouter**.

**Le modèle de document est un arbre.** `engines/canvas/canvas-state.ts`, `state.layers` est la
racine, jamais le document entier :

    type Layer = PixelLayer | GroupLayer | AdjustmentLayer   // discriminé par `kind`

**Ne jamais parcourir l'arbre à la main** : `allLayers`, `layerById`, `mapLayers`, `updateSiblings`,
`pixelLayer` / `groupLayer`. **Les pixels ne sont pas dans le modèle** — ils vivent dans les
`RenderTexture` de `CanvasEngine`, indexées par id de calque (invariant 3). `resizeCanvas` déplace le
cadre sans toucher aux pixels ; `resizeImage` rééchantillonne, mais les textures ne le sont **pas
encore** : c'est le jalon 10.

**L'historique, pixels compris (jalon 3).**

- `engines/core/history.ts` — `Command<S>` avec `apply`/`revert`, générique et partagé.
- `stores/document-store.ts` — un état et **un historique par document**, plus `beginGesture` /
  `endGesture` (fusion en une entrée), `discardLast`, `replace`, `markSaved`, **`forgetThrough`**.
- `engines/canvas/tiles.ts` — géométrie pure des tuiles de 512, clippée au document.
- `engines/canvas/PixelPatches.ts` — le magasin GPU des correctifs. Photo « avant » à la première
  salissure d'une tuile, photo « après » à la fin du geste. Budget 256 Mo, éviction du plus ancien,
  et l'id jeté est **signalé**.
- `paintPixels(patchId, port)` dans `commands.ts` — la commande ne porte que l'identifiant.
- `spaces/image/pixel-port.ts` / `layer-port.ts` — les ponts React↔moteur, sur le modèle de
  `guide-port.ts`.

Quand un correctif disparaît, `forgetThrough` sort son entrée de la pile **et tout ce qui est plus
ancien** : undo est séquentiel, une entrée derrière un trou est inatteignable. Un ⌘Z qui ne fait rien
se lit comme un bug ; une pile qui s'arrête se lit comme une limite.

**La vue est de l'état de session.** `engines/canvas/viewport.ts` (maths pures),
`stores/canvas-views.ts` (jamais sauvegardée, jamais dans l'historique), `spaces/image/canvas-view.ts`
(actions de haut niveau, inertes tant que le panneau n'est pas mesuré).

**Le double canvas.** `engines/canvas/CanvasOverlay.ts` — un `<canvas>` 2D au-dessus du canvas Pixi,
en `pointer-events: none`, qui dessine cadre, règles, repères et sélection **en coordonnées écran**.
`drawOverlay(context, scene)` est pur : un test lui passe un **enregistreur**
(`OverlayContext = Pick<…>`) et lit ce qu'il a décidé sans WebGL. `OverlayScene.paint?` est le point
d'accroche du chrome de l'outil actif — c'est là que passeront les pointillés du jalon 6 et la boîte
de transformation du jalon 7.

**Le moteur** — `engines/canvas/CanvasEngine.ts`, aucun import React. Points à ne pas défaire :

- `mount` appelle **`reconcile()` directement**, jamais `apply`.
- `apply` ne reconcilie que si `state.layers` a changé d'identité ou si le cadre a bougé.
- `reconcile` ne **restacke** que si les identifiants changent d'ordre (champ `stacking`) : un
  glissement de calque réécrit `state.layers` soixante fois par seconde sans restacker, et les deux
  passes concernées sont par calque, l'une quadratique dans les surfaces.
- Le viewport est appliqué localement puis publié à React une fois par frame.
- `mounting` est un jeton, pas un booléen.
- Le carré d'angle des règles est une zone morte.
- `endGesture` ferme le geste ouvert **une seule fois**.

`CanvasEngine.test.ts` double `pixi.js` avec `vi.mock` : **ajouter ses cas dedans** plutôt que de
conclure qu'un moteur ne se teste pas.

### Quatre écarts avec ce qu'on croit savoir

1. **Il n'existe ni `shared/gpu/GpuPipeline`, ni `passes/adjust`, ni `passes/blur`, ni `readback`,
   ni `shared/model/adjustments`, ni `shared/export/encode`.** Il faudra les écrire.
2. **Le socle GPU se construit sur `Filter` de Pixi.** `import 'pixi.js/unsafe-eval'` vient en
   premier : la CSP d'Electron interdit `unsafe-eval` et Pixi compile ses shaders avec
   `new Function()`.
3. **Aucun objet GPU dans le modèle.**
4. **`hue` n'existe pas dans les modes de fusion de Pixi.** Il est déclaré dans le modèle et retombe
   sur `normal`, en attendant un filtre maison. Ne pas le mapper sur autre chose.

### Jalon 4 — Compositing et panneau Calques

Groupes, écrêtage (`clipped`), masques de fusion (`mask`), les 16 modes
(`pixi.js/advanced-blend-modes`), `fillOpacity`, `isolation` des groupes.

Le panneau (`panels/layers/` : `LayersPanel`, `LayerList`, `LayerRow`, `LayersActions`,
`LayerStackActions`) rend une liste plate. Le rendre arborescent : glisser-déposer avec indicateur
d'insertion, vignettes, renommage au double-clic, Alt+clic sur l'œil pour isoler, Alt+glisser pour
dupliquer, sélection multiple, groupes repliables. `LayerList` utilise `Collection`, qui virtualise —
**un arbre virtualisé se rend à plat après aplatissement, pas en récursion de composants**.
`design/Tree.tsx` existe déjà, écrit pour l'espace 3D : le regarder avant d'en écrire un autre.

**À traiter ici en priorité** : supprimer un calque détruit sa texture dans `reconcile`, donc ⌘Z le
fait revenir **vide**. C'est antérieur au jalon 3, mais l'historique des pixels le rend criant. Le
cycle de vie des calques est le sujet de ce jalon.

### Jalon 5 — Registre d'outils

Extraire le `switch` hors de `CanvasEngine` vers `engines/canvas/tools/` : chaque outil expose
`onPointerDown` / `onPointerMove` / `onPointerUp` / `drawOverlay` / `onDeactivate`.

Trois choses le bloquent, dans cet ordre : le type `Gesture` mélange le chrome (`pan`, `guide`, qui
restent au moteur pour toujours) et l'outil armé (`paint`, `move`, `select`) ; `onPointerDown` est une
chaîne de `if` sur `this.tool` dont chaque branche plonge dans `activeSurface()`, `stamp`, `brush`,
`render()` ; et `scene()` câble `OverlayScene.paint` — le bon point d'accroche générique — à un champ
nommé d'un outil nommé. Définir le contexte que le moteur passe à un outil, **sortir `select` en
premier pour prouver la couture**.

Barre d'options horizontale en haut du panneau central, pilotée par l'outil actif. Flyouts sur clic
long, dernier outil du groupe affiché, Maj+raccourci cycle dans le groupe.

Déjà câblés : pinceau, gomme, pot, pipette, déplacer, main, marquee rectangle (visuel seul).
Déclarés mais morts : `crop`, `shape`, `text`, `comment` — voir `UNBUILT_TOOLS`
(`CanvasEngine.ts:131`), qui existe pour qu'en brancher un soit une seule suppression.

### Jalon 6 — Sélection

**Un masque 8 bits, jamais un tracé vectoriel.** `RenderTexture` + bornes + adoucissement.

Les pointillés sont **dérivés du masque** : contour → marching squares → polylignes en coordonnées
document → dessin sur l'overlay avec `setLineDash` animé, deux passes (noir, puis blanc décalé de 4).
Transformer en coordonnées écran **au moment du dessin**, sinon l'épaisseur change avec le zoom.

Rectangle, ellipse, lasso. Maj ajoute, Alt soustrait, Maj+Alt intersecte. Le marquee actuel dessine
un rectangle et ne sélectionne rien — aucun outil ne le lit.

Note : l'overlay repeint toute la scène à chaque frame demandée (~1800 appels 2D sur un hôte 4K avec
les règles). Des pointillés animés le feront tourner en continu. Si ça pèse, mettre les bandes de
règles en cache dans un canvas hors écran et ne repeindre par frame que les pointillés — **pas avant
d'avoir mesuré**.

### Jalon 7 — Transformation

⌘T, boîte englobante, 8 poignées, zone de rotation à ~20 px à l'extérieur de chaque coin.

Modificateurs à respecter **exactement**, les utilisateurs les ont dans les doigts : Maj+coin conserve
les proportions, Alt travaille depuis le centre, Maj+Alt les deux, hors de la boîte rotation libre,
Maj+rotation par pas de 15°, Cmd+poignée distord, Cmd+Maj+arête incline, Entrée valide, Échap annule.
Point d'origine déplaçable.

**Non destructive jusqu'à validation** : les pixels ne sont rééchantillonnés qu'à la fin,
l'interpolation (bicubique par défaut) est un réglage, et chaîner plusieurs transformations sans
revalider ne doit pas dégrader. Plus rotations 90°/180°, symétries, déformation 3×3.

`syncLayer` n'applique aujourd'hui que `transform.x/y`. `scaleX`, `scaleY`, `rotation`, `skewX`,
`skewY`, `originX`, `originY` existent dans le modèle et attendent ici.

### Jalon 8 — Peinture

Pression du stylet (`PointerEvent.pressure`) sur la taille et l'opacité. `getCoalescedEvents()` pour
ne pas perdre de points sur tablette haute fréquence, tout en composant **une fois par frame**.
Texture de brouillon : le trait en cours se dessine à part et n'est fusionné dans le calque qu'au
`pointerup` — c'est aussi ce qui rend l'opacité juste, une passe par point composite les touches les
unes sur les autres.

Dégradé (linéaire, radial, angulaire, réfléchi, losange). Pot de peinture en **vrai flood fill par
tolérance** — il peint aujourd'hui d'un bord à l'autre, délibérément (c'est ce qui donne un fond uni
en un geste), mais ce n'est pas un pot de peinture.

`brush.hardness` existe dans `BrushSettings` sans lecteur : la touche est un cercle dur. C'est ici.

### Jalon 9 — Sélection automatique et réglages

Écrire `engines/canvas/passes/` en `Filter` Pixi : `adjust`, `blur`, `morphology`, `threshold`.

Baguette magique (flood fill par tolérance en espace Lab, contigu ou global), sélection rapide,
Modifier ▸ (dilater, contracter, contour, lisser), plage de couleurs avec aperçu.

Calques de réglage : niveaux, courbes, TSL, balance des couleurs. `AdjustmentLayer` existe dans le
modèle sans consommateur — c'est ici qu'il en trouve un, et le `pass-through` des groupes prend enfin
son sens.

### Jalon 10 — Export

PNG / JPEG / WebP depuis `renderer.extract`, aplatissement. **Taille de l'image** et **Taille de la
zone de travail** comme deux commandes distinctes (`resizeImage` / `resizeCanvas` existent déjà, mais
les textures ne sont pas rééchantillonnées — c'est ici).

Rien de l'overlay ne doit apparaître à l'export : il n'est pas dans la scène Pixi, **le vérifier**
plutôt que le supposer. `dpi`, `colorMode`, `bitDepth` sont portés par le modèle depuis le début sans
consommateur : c'est l'export qui les lit.

### Interdits

- **Aucun pixel traité sur CPU** : ni `getImageData` + boucle, ni Canvas2D pour le document. Le
  Canvas2D est réservé à l'overlay.
- Pas de sélection modélisée en tracé vectoriel.
- Pas de second registre de commandes, pas de menu Electron généré en parallèle du sien.
- Jamais de chrome d'interface dans le canvas du document.
- Pas d'instantanés de pixels pleine taille dans l'historique.
- Pas de bibliothèque d'édition tierce (Fabric, Konva, tui-image-editor) : elles imposent leur modèle
  de document.
- Aucune dépendance nouvelle sans validation de l'utilisateur.

### Dette du mode Image

1. **Supprimer un calque perd ses pixels** — `reconcile` détruit la texture, l'annulation ramène un
   calque vide. À traiter au **jalon 4**, dont c'est le sujet.
2. **`HISTORY_LIMIT = 100` coupe sans prévenir le moteur.** `forgetThrough` couvre le sens « le moteur
   a jeté un correctif, préviens l'historique » ; le sens inverse — l'historique éjecte une entrée par
   capacité — laisse ses tuiles vivantes jusqu'à ce que le budget de 256 Mo les évince. Pas un crash,
   mémoire bornée, mais asymétrique. La généralisation propre est un `dispose?: () => void` optionnel
   sur `Command<S>`, appelé par `run()` quand il tronque — **à faire quand un deuxième moteur en aura
   besoin** (cache de frames de la timeline, deltas de mesh de la 3D), pas avant.
3. **`paintPixels` est la première commande dont l'utilité réelle est un effet de bord**, pas une
   transition d'état : `apply`/`revert` retournent l'état inchangé et écrivent sur le GPU. Le drapeau
   `recorded` est commenté et testé. Au **deuxième** cas de ce genre, extraire un type distinct plutôt
   que de refaire `apply: state => state` avec un drapeau caché.
4. **Deux ports dupliquent `beginDrag`/`endDrag`** (`guide-port.ts`, `layer-port.ts`). Deux lignes,
   honnêtes. Au **troisième** port avec un vrai drag (crop, texte), extraire un
   `dragGesture(documentId)`.
5. **Allocations par pointermove non optimisées, mesurées et jugées acceptables** : `snapTargets`
   alloue 3 tableaux par axe à chaque frame d'un glissement de calque (~480 petits tableaux/s), et
   `tilesCovering` + `tileKey` allouent par `dab()` même quand la tuile est déjà capturée
   (~180 allocs/s). Si ça se voit un jour au profiler : mémoïser `snapTargets` à `beginDrag`, et
   garder sur la `Recording` une borne de ce qui est déjà capturé.
6. **Le menu du mode Image n'a pas d'entrées** (zoom, règles, repères) : les raccourcis et la barre de
   zoom couvrent tout. À ajouter à la main dans `src/main/menu/template.ts` si demandé, en vérifiant
   qu'aucun `role:` Electron ne revendique déjà la touche (`role: 'reload'` porte ⌘R implicitement —
   c'est pourquoi il est passé sur ⇧⌘R).

---

## 3.3 Espace 3D

**Ce qui existe** — 17 primitives, 5 types de lumières, gizmo translate/rotate/scale, sélection par
raycast, inspecteur dérivé des descripteurs, undo avec coalescing par geste, 5 slots de textures PBR,
outliner, vol libre, et l'enregistrement du document.

| Manque | Preuve dans le code |
|---|---|
| Sélection multiple | `SceneState.selectedId` est un `string \| null` |
| Groupes / reparentage | `parentId` existe, aucune commande ne le change |
| Dupliquer, copier-coller | aucune commande dans `commands.ts` |
| Magnétisme, pivot local/monde | aucun `setTranslationSnap`, aucun `setSpace` |
| Import de modèles | aucun `GLTFLoader`, Draco ou KTX2 — alors que `mesh` est un `AssetType` |
| `sprite` et `text` | déclarés sans `create`, donc grisés |
| Ombres | aucun `castShadow`, `receiveShadow`, `shadowMap` |
| Environnement / IBL dans le viewport | `PMREMGenerator` n'existe que pour les skyboxes |
| Caméra ortho, vues normalisées, filaire | rien dans le viewport |
| Instanciation, LOD, BVH pour le picking | le raycast parcourt tous les objets |

**L'ordre conseillé.** **Sélection multiple** en premier, tant que le code est petit — elle touche
l'état, l'inspecteur, le gizmo et l'outliner d'un coup, et plus elle attend plus elle coûte. Puis
**magnétisme et pivot** (deux appels d'API `TransformControls`, gain d'ergonomie immédiat pour un coût
quasi nul), puis **l'import glTF**, puis **ombres et HDRI**, et enfin groupes, duplication, modes
d'affichage, export.

**L'import glTF fera franchir un plafond mesuré.** Un GLB apporte ses maillages par milliers, pas par
unités. Or **⌘S gèle toutes les fenêtres au-delà de ~5 500 nœuds**, et c'est le **décodage du clone
IPC** qui l'y amène — 73 % du coût, deux fois et demie la sérialisation, intouché. Aujourd'hui le menu
Ajouter ne permet pas d'y arriver à la main, donc rien n'a été déplacé hors du main : pour un gain de
0,13 ms, un `utilityProcess` coûterait un canal de plus, une frontière moins typée et un chemin
d'erreur supplémentaire. Le jour où un import pose 5 500 nœuds, **s'attaquer au décodage d'abord**.

**Le chemin chaud de l'inspecteur n'est pas un sujet** — audité, chiffré, clos. Cf. § 5.

---

## 3.4 Espace Textures

**Livré (étape 3 mergée).** Le document `.tex`, les huit canaux comme domaine, le viewport partagé,
l'espace lui-même : une image glissée devient la couleur de base, la forme se choisit, l'environnement
studio éclaire, et tout s'enregistre dans le dossier du projet.

**4 — Panneau matériau.** Tous les réglages du § 4 du brief, câblés en direct : rugosité, métal,
relief, tiling, émission. Réutiliser `SliderField`, `NumberField`, `PropertySection`, `ColorField` —
**ils existent**. Le seul contrôle neuf est le **double curseur de remap** (`design/RangeField.tsx`),
deux poignées sur un rail, plage surlignée. Le remap rugosité/métal passe par `onBeforeCompile` —
**vérifier les noms de chunks sur three 0.185 avant d'écrire**, ils bougent entre versions.
« Brillance » est l'**inverse** de la rugosité : inverser à l'affichage, stocker la rugosité. Une face
de plus dans `panels/inspector/`, **pas un panneau à part** : `main` a posé la règle d'un inspecteur
unique pour tout le studio.

**5 — Bande de canaux.** Huit vignettes 96 px (`Thumbnail`, `MediaTile`, `Flyout`/`MenuRow`), badge
généré / dérivé / importé, import de fichier, vue 2D par canal. Un canal **dérivé** se recalcule quand
sa source change ; un **généré** est figé — la distinction doit se voir.

**6 — Dérivations en shader.** `engines/texture/derive/` : quad plein écran, `WebGLRenderTarget`,
**port injectable** (jsdom n'a pas de WebGL). Sobel height→normal d'abord. **Aucune boucle JS sur des
pixels.** Puis « améliorer ce canal » : `model_sc-texture-converter`, **via le `JobManager`**, jamais
un appel direct au SDK. Un job rend six canaux ; `collector.ts` sait déjà les répartir par
`metadata.type`.

**7 — Tiling.** Aperçu 1×/2×/4× (multiplicateur **local**, jamais écrit dans `material.tiling`),
détection de coutures par gradient aux bords, seamless par décalage d'une demi-largeur. `overlap` et
`featherRadius` sont les paramètres de `model_scenario-texture`. Appliqué à tous les canaux **avec les
mêmes valeurs**, sinon ils se désalignent.

**8 — Export.** glTF/GLB, Unity, Unreal, Roblox, canaux bruts. Empaquetage ORM (AO=R, Roughness=G,
Metallic=B) **en une passe shader**. L'écriture disque passe par le main. `GLTFExporter` vient de
`three/addons`. C'est ici que « aperçu en 1024, export en pleine résolution » s'applique.

**Vérifié à l'écran** : l'espace s'ouvre, le document se crée, la barre d'outils répond, l'état vide
s'affiche. **Non vérifié** : la sphère éclairée et une image posée en couleur de base — le viewport
noir constaté venait de l'environnement studio manquant, corrigé depuis, mais la confirmation visuelle
attend un projet ouvert.

---

## 3.5 Espace Skyboxes

**Livré.** Une image entre par trois chemins et le ciel s'allume. Le moteur, l'étalonnage GPU, le
soleil attrapable au raycast, les sondes et l'undo étaient déjà là depuis l'étape précédente ;
`setSource` n'était simplement appelé de nulle part, et l'état vide promettait depuis le début
« Générez-en une ou déposez un panorama » sans que rien ne tienne la promesse.

**La famille `skybox` ne se déduit pas des capacités.** Vérifié contre l'API en ligne, pas supposé :
l'énumération des capacités n'a **aucune** valeur skybox, et les trois modèles publics
(`scenario-skybox-flux`, `scenario-skybox-gpt`, `hunyuan-world-image-to-skybox`) répondent `txt2img`
et `img2img` comme n'importe quel modèle d'image. Le tag **`sc:skybox`** est le seul signal qui
existe — d'où `familyOf(capabilities, tags)` qui consulte le tag en premier. Le même tag sert de
pré-filtre serveur : garder trois modèles sur six cents en marchant le catalogue page par page coûte
huit allers-retours pour remplir un écran. **`skybox-upscale` ne porte pas ce tag** et reste avec les
images, ce qui est correct : un agrandisseur ne produit pas le document de l'espace.

**Ce qu'il reste, dans l'ordre du coût croissant :**

**1. Trois vues sur quatre sont des boutons morts.** `SKYBOX_VIEWS` en déclare quatre ; le renderer
n'expose aucun `setView`. Le state de `SkyboxDocument.tsx` ne pilote que la couleur du bouton :
`equirect`, `cross` et `faces` ne dessinent rien.

**2. L'export n'existe pas, et son vocabulaire attend depuis le début.** `CUBE_FACES`, `FACE_LABELS`
(`Rt`/`Lf`/`Up`…, ce que les moteurs attendent), `CROSS_CELLS`, `FACE_SIZES`, `isCubeFace` sont
écrits et testés dans `shared/domain/skybox.ts` — et **référencés par leurs seuls tests**. Rien ne
convertit l'équirectangulaire en six faces, alors que la conception promet « aperçu 360, export HDRI
vers la 3D ». Le domaine a été écrit pour un export qui n'a pas suivi ; le faire, c'est une passe
shader et un écrivain, pas une refonte.

**3. Le `.sky` ne s'enregistre pas** — c'est l'un des quatre `DocumentIo` manquants du § 3.1, à
traiter avec eux et non à part.

**Un piège à connaître avant d'y toucher.** Un `.hdr` **n'est pas importable** : `IMPORTABLE_TYPES`
(`main/media/link.ts`) ne connaît que vidéo, audio et image, et un `.exr` importé est catalogué
`image`, jamais `skybox`. C'est sans conséquence aujourd'hui — le puits accepte toute image du
projet, quelle que soit son étagère — mais quiconque cherchera « pourquoi mon HDRI n'apparaît pas
dans l'import » cherchera là.

---

## 3.6 Dettes transverses

**Les index du catalogue n'ont pas été posés.** `catalog.ts` déclare des index simples
(`assets(type)`, `assets(created_at DESC)`, `asset_tags(tag)`, `assets(hash)`…). **Il manque l'index
composite `(type, created_at DESC)` et un FTS5** pour la recherche texte. Les deux requêtes coûteuses
de l'audit — `type = ?` à 15,17 ms et un `LIKE '%…%'` sans résultat à 22,53 ms — tombent dans le même
piège : parcourir toute la table pour remplir une page. **Le worker a déplacé ce coût, les index le
supprimeraient.**

**Une recherche engagée ne s'interrompt pas.** Six frappes produisent six recherches.
`catalog-client.ts` n'expose aucun abandon, et une requête `better-sqlite3` engagée ne s'interrompt
pas. Elles ne bloquent plus rien depuis le worker, mais elles occupent le thread — et l'invariant 6
demande que toute tâche longue soit annulable. À traiter **avec les index**, qui les rendront assez
brèves pour que la question se pose autrement.

**Le décodage du clone IPC** — 73 % du coût d'un ⌘S, intouché. Cf. § 3.3.

**Une commande asynchrone vole le geste en cours.** `document-store.ts` réécrit l'identifiant de
coalescence du document à **chaque** `runCommand` dès qu'un geste est ouvert, y compris pour une
commande venue d'ailleurs. Tant que toutes les écritures venaient de la main de l'utilisateur, elles
partageaient le geste et personne ne le voyait. L'espace Skyboxes a introduit le premier écrivain
**asynchrone** — une génération qui aboutit — et le rend atteignable : si un job se termine pendant
qu'un curseur est tenu, la suite du glissement cesse de fusionner et l'annulation se fragmente en
trois entrées au lieu d'une, dont la génération elle-même au milieu. Un ⌘Z fait alors disparaître
l'image au lieu de continuer à défaire le réglage. La ligne fautive est antérieure et sert les cinq
espaces : **la corriger touche l'historique de tous**, d'où son classement ici plutôt qu'un
rustinage local.

**Durabilité.** `documents.ts` renomme atomiquement, ce qui protège d'un crash **en cours
d'écriture**, mais ne fait pas de `fsync` : une coupure de courant peut perdre l'écriture. C'est écrit
dans son propre commentaire, et assumé.

**Le panneau assets est à droite dans tous les espaces**, Image compris, où il mange la largeur du
canvas pour rien. `TOOL_PLACEMENTS` (`shared/domain/tool.ts`) supporte déjà `workspaces` — le
correctif a été proposé et jamais appliqué : `workspaces: ['video', 'audio']` sur l'entrée droite, plus
une entrée `bottom` pour les autres.

**Le double dispatch des accélérateurs Electron n'a jamais été vérifié en conditions réelles.** macOS
consomme probablement la frappe avant le renderer, Windows/Linux non. Personne ne l'a mesuré sur les
trois plateformes.

**`src/main/menu/index.ts` n'a aucun test** — empreinte, débounce, cycle de vie par fenêtre.
`src/main/ipc/test-harness.ts` mocke déjà `ipcMain`, mais il faut l'étendre à
`app` / `BrowserWindow` / `Menu`.

---

# 4. Méthode — ce qui a marché

**Les revues qui exécutent le code trouvent beaucoup plus que celles qui le lisent.** Trois points de
comparaison, tous sur le mode Image :

| Quand | Comment | Trouvé |
|---|---|---|
| Jalon 0 | huit agents qui ont **lu** le code | 3 défauts |
| Jalon 2 | trois agents à qui il était demandé d'écrire des sondes vitest et de **reproduire** chaque défaut | **12 défauts**, dont une régression critique introduite par la passe de simplification elle-même — un garde ajouté dans `apply` neutralisait le replay de `mount`, et un document s'ouvrait sans aucune texture |
| Jalon 3 | un agent muni d'une **sonde instrumentée** | le nouveau chemin du déplacement de calque payait cinquante réordonnancements par frame — aucune lecture ne l'avait vu |

Quand une revue est déléguée, demander explicitement : de **reproduire empiriquement** chaque défaut
avant de l'affirmer, de rendre **la sortie de la sonde qui le prouve**, de séparer les défauts
confirmés des suspicions non reproduites, et de **nettoyer derrière soi** — le répertoire de travail
est le scratchpad indiqué en tête de session, jamais `src/`, jamais `/tmp`.

**Vérifier à l'écran ce qui se voit.** Le MCP `electron` fonctionne après `pnpm start:debug`. Règles,
repères, zoom, compositing, pointillés, viewport éclairé : **un jalon visuel validé uniquement par des
tests unitaires n'est validé qu'à moitié**. L'espace Textures en porte la trace — un viewport noir
venait de l'environnement studio manquant, ce qu'aucun test n'aurait dit. Attention, **le port 9222
est unique** : si une autre session a déjà lancé l'application, c'est son instance qu'on pilote.

**Deux réflexes qui ont payé.** Les tests existants attrapent les régressions de portée : deux d'entre
eux ont révélé qu'un bouton d'annulation agissait sur le mauvais document. Et **un commentaire qui
décrit un comportement disparu est un défaut à part entière** — quand on change un comportement, on
relit les commentaires autour.

**Rebaser souvent.** Plusieurs sessions travaillent en parallèle dans `.claude/worktrees/`. Les
conflits grossissent vite et deviennent des collisions de conception : **deux sessions ont déjà réécrit
le panneau des calques et le registre de commandes en même temps**. Corollaire pratique : préfixer
chaque commande par le chemin absolu de son worktree — le shell retombe ailleurs entre deux appels, et
un build lancé au mauvais endroit écrase le `out/` du voisin.

---

# 5. Performance — les mesures acquises

**Trois audits, tous menés le 7 août 2026** sur Apple M2 Max / macOS 26.5.2, en **build de
production**. **Ne pas refaire ces mesures.**

## Les six chiffres à ne pas redécouvrir

1. **8,33 ms** — le budget par frame du renderer sur un écran 120 Hz. C'est le chiffre qui compte, pas
   les 16,7 ms d'un écran 60 Hz.
2. **16 ms** — au-delà, une opération synchrone dans le **main** gèle TOUTES les fenêtres, y compris
   les détachées.
3. **React ne pèse rien en production** (0,15 ms/frame, 4,5 % du CPU occupé) et **huit fois plus en
   dev**. Mesurer en dev, c'est mesurer `jsxDEV` et `validateProperty`, qui n'existent pas en
   production.
4. **Le navigateur coalesce déjà les `pointermove`** : 600 événements injectés en 44 ms, 7 reçus. Il
   n'arrive jamais plus d'un `pointermove` par frame — il n'y a rien à coalescer dans un rAF.
5. **Le catalogue franchit les 16 ms vers 100 000 assets** et atteint 44 ms à 200 000.
6. **⌘S gèle toutes les fenêtres au-delà de ~5 500 nœuds.** Inatteignable au menu Ajouter, atteignable
   au premier import glTF.

**Une optimisation non mesurée est une complexité gratuite.** L'audit 3D est le cas d'école : cinq
pistes de revue, cinq réfutées par la mesure, **zéro ligne changée**.

## Audit 1 — le chemin chaud de l'inspecteur 3D : ce n'en est pas un

Scène au pire cas légal : sphère 128 × 128 (~16 000 sommets), cinq panneaux ouverts, 300 frames de
glissement par scénario.

| Scénario | CPU occupé / frame | % du budget 8,33 ms | Frames > 16,7 ms |
|---|---|---|---|
| Position X, 1 maille | 1,85 ms | 22 % | **0 / 299** |
| Segments 68↔128 | 2,18 ms | 26 % | **0 / 299** |
| Rayon, 1 maille | **3,31 ms** | 40 % | **0 / 299** |
| Rayon, 50 mailles | 3,81 ms | 46 % | **0 / 299** |
| Rayon, 1 maille, **dev** | 6,57 ms | 79 % | 0 / 299 |

Répartition (rayon, 1 maille, production) : reconstruction de géométrie **1,08 ms/frame, 33 % du CPU
occupé** ; `(program)` natif 0,81 ms ; `ViewHelper.render` (le trièdre, à chaque frame) 0,14 ms ;
**React 0,15 ms, 4,5 %** ; i18next 0,05 ms.

**Les cinq pistes de revue, réfutées une à une :**

- *« La géométrie se reconstruit dans l'événement, pas dans la frame »* — il n'y a rien à coalescer :
  299 frames, 299 émissions d'état, 299 reconstructions. Rapport 1,00.
- *« Rien n'est mémoïsé dans le panneau »* — mémoïser tout l'inspecteur ne peut pas rapporter plus que
  les 0,15 ms que React coûte en tout.
- *« La pile d'historique est recopiée par frame »* — `runCoalescing` coûte **0,0005 ms**. Copier 100
  références est un `memcpy` de 800 octets, six millièmes de pour cent du budget.
- *« Tout l'espace 3D se re-rend »* — l'amplification est réelle mais bornée par la précédente : passer
  de 1 à 50 mailles coûte +0,010 ms par maille. Il faudrait ~500 mailles pour saturer le budget.
- *« `TextureField` fait un `find` linéaire »* — cinq emplacements sur 2 000 assets en pire cas :
  0,0167 ms, 0,2 % du budget.

**Reproduire :**

```bash
pnpm exec electron-vite build
pnpm exec electron . --remote-debugging-port=9334 \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling
```

Renderer sur `localhost:9334`, onglet Performance. Cinq panneaux ouverts, une sphère, ses deux comptes
de segments à 128, puis glisser le champ visé sur la largeur du panneau. Sans les drapeaux, Chrome
suspend le `requestAnimationFrame` d'une fenêtre occultée et il n'y a plus rien à mesurer.

## Audit 2 — le catalogue quitte le thread principal

Coût d'une requête, driver de production `better-sqlite3` :

| Assets | par type | texte sans résultat | deux tags | première page | par id |
|---|---|---|---|---|---|
| 1 000 | 0,15 ms | 0,44 ms | 0,12 ms | 0,14 ms | 0,004 ms |
| 10 000 | 1,69 ms | 1,32 ms | 0,75 ms | 0,48 ms | 0,004 ms |
| **100 000** | **15,17 ms** | **22,53 ms** | 7,69 ms | 0,49 ms | 0,004 ms |
| **200 000** | **33,73 ms** | **43,82 ms** | **20,49 ms** | — | — |

Blocage mesuré dans l'application, 100 000 assets, seize recherches lourdes, sonde IPC continue :

| | AVANT (dans le main) | APRÈS (sur son thread) |
|---|---|---|
| Sondes | 16 687 | 32 297 |
| Pic maximal | **22,1 ms** | **8,4 ms** |
| **Sondes au-dessus de 16,7 ms** | **16** | **0** |

**Seize recherches lourdes, seize blocages** — un par requête, et le pic de 22,1 ms est très exactement
la requête mesurée à 22,53 ms au banc. Après : aucun blocage sur 32 297 sondes.

Le correctif est un seul changement : le catalogue s'exécute sur son propre `worker_threads`.
**`catalog.ts` n'a pas changé d'une ligne** — c'est ce que le port `SqliteDriver` rendait possible, à
une nuance près : échanger le driver ne pouvait pas suffire puisque toutes ses méthodes sont
synchrones, c'est le catalogue entier qui devait partir. Fichiers : `catalog-protocol.ts`,
`catalog-dispatch.ts`, `catalog-client.ts`, `catalog-thread.ts`, `catalog-worker.ts`,
`catalog-fixtures.ts`.

Trois décisions : **un thread, pas un pool** (SQLite n'accepte qu'un écrivain, les requêtes sont
courtes) ; **tout le catalogue part, pas seulement `search`** (une seconde connexion au même fichier
serait moins sûre, et `find` à 0,004 ms n'y perd qu'une latence de message) ; **le client rejette ce
qui est en vol si le thread meurt** (sans quoi un worker qui plante laisse l'interface attendre une
promesse que plus personne ne réglera).

**La recherche n'est pas devenue plus rapide — ce n'était pas l'objet.** C'est le même SQL, simplement
plus sur le thread qui dessine les fenêtres. Le prochain gain est dans les index (§ 3.6).

**Reproduire :**

```bash
pnpm exec electron-vite build
pnpm exec electron . --remote-debugging-port=9338 \
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding
```

Ouvrir un projet dont `.index/catalog.db` porte 100 000 lignes, puis, depuis la console du renderer,
marteler `window.studio.project.current()` en mesurant son aller-retour pendant que
`window.studio.assets.search({ type: 'video', limit: 200 })` tourne. Toute latence supérieure à 16,7 ms
sur la première est une frame perdue par toutes les fenêtres.

## Audit 3 — enregistrer et rouvrir un document 3D

Coût complet d'un ⌘S sur le thread principal — décoder le clone IPC, puis produire le texte. Un
`invoke` fait traverser un **objet**, pas un texte : `ipcMain` en décode le clone structuré sur le
thread principal avant d'appeler le handler, et l'ignorer sous-estime le coût réel.

| Nœuds | Total main | dont `JSON.stringify` | part du décodage | % du seuil de 16 ms |
|---|---|---|---|---|
| 50 | **0,130 ms** | 0,038 ms | 71 % | 1 % |
| 500 | 1,41 ms | 0,364 ms | 74 % | 9 % |
| 5 000 | 14,6 ms | 3,90 ms | 73 % | 91 % |
| 10 000 | 29,4 ms | 7,92 ms | 73 % | 184 % |
| 50 000 | 163 ms | 39,9 ms | 76 % | 1019 % |

Franchissement des 16 ms : **≈ 5 500 nœuds**.

`documents.ts` écrit sans indentation, et l'instinct était juste — l'indentation coûtait 1,7× (6,70 ms
contre 3,90 ms à 5 000 nœuds). Mais **c'est la plus petite moitié qui a été optimisée** : le décodage
pèse presque trois fois la sérialisation et n'est traité nulle part. Sans indentation le plafond passe
de ≈ 4 700 à ≈ 5 500 nœuds — pas d'ordre de grandeur.

Ouvrir : côté main, `JSON.parse` + encodage du clone, 0,127 ms à 50 nœuds, 14,0 ms à 5 000. Côté
renderer, la validation contre `property-fields.ts` est du travail sur le thread UI **une fois par
ouverture, pas par frame** — 0,020 ms à 50 nœuds, 19,5 ms à 50 000. Une correction d'une ligne y a
gagné 27 % : la liste des champs numériques d'un matériau était reconstruite
(`Object.entries(MATERIAL_SPECS).filter(…)`) **pour chaque nœud**, alors que la table est une constante
de module.

Le marqueur « modifié », lu par un sélecteur zustand **une fois par frame** pendant un glissement :
**0,00005 ms**, soit 0,0006 % d'une frame. Trois millièmes de pour cent de ce que React coûte déjà.

Corrigé sans mesure : **une double lecture au montage**. Le `StrictMode` de React 19 exécute deux fois
chaque effet, et `DocumentArea` est remonté à chaque changement d'espace — une ouverture valait deux
`JSON.parse` dans le main. `restoreDocument` retient la lecture en cours.

**Reproduire :** `pnpm bench`. Les trois fichiers sont versionnés — `src/main/project/documents.bench.ts`,
`src/renderer/src/engines/scene/scene-document.bench.ts`,
`src/renderer/src/stores/document-store.bench.ts`. Aux grandes tailles les mesures sont dominées par le
GC (`rme` jusqu'à 20 %) : la colonne à retenir est le **minimum**.

---

# 6. Les captures d'écran attendues

Le `README.md` racine et les deux guides utilisateur référencent des images qui n'existent pas encore.
Tant qu'un fichier manque, son emplacement reste visible dans le markdown sous forme de commentaire
HTML — rien ne casse.

| Fichier | Sujet |
|---|---|
| `docs/images/studio-3d.png` | Le studio dans l'espace 3D : rails aux deux bords, vue de scène au centre, arbre de scène et maillages à gauche, modèles à droite, étagère à assets en bas |
| `docs/images/studio-image.png` | L'espace Image : pile de calques, volet d'un groupe d'outils ouvert |
| `docs/images/settings-account.png` | La fenêtre de Réglages, section Compte, état authentifié visible |
| `docs/images/models-grid.png` | Le panneau Modèles en grille, facettes ouvertes |
| `docs/images/generate.png` | Le panneau Génération avec le formulaire d'un modèle, et la bande Jobs avec un job en cours |
| `docs/images/image-tools.png` | Un document image, volet du groupe Forme ouvert, pile de calques visible |
| `docs/images/scene-3d.png` | La vue 3D avec un maillage sélectionné, l'arbre de scène et le panneau Maillages |
| `docs/images/timeline.png` | L'espace Vidéo : timeline avec plusieurs clips, moniteur au-dessus |

**Conventions.** PNG, thème sombre, densité confort. **2560 × 1600** pour les vues plein écran,
recadrées au panneau pour les vues de détail. Fenêtre sans ombre portée du système — elle se voit mal
sur le fond clair de GitHub. **Un projet réel ouvert, avec de vrais assets** : une fenêtre vide ne
montre rien de ce que le logiciel sait faire. **Aucun identifiant, aucun jeton, aucun chemin personnel
lisible** ; la section Compte se capture avec des champs remplis mais masqués.

`pnpm start:debug` ouvre le port 9222, ce qui permet de piloter la fenêtre et de déclencher les
captures depuis l'extérieur plutôt qu'à la main.
