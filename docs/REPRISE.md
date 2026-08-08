# Scenario Studio — reprise

**Le seul document de travail du projet.** État, ce qu'il reste à faire, les mesures acquises, la
méthode. Vérifié dans le code le 8 août 2026.

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

**679 fichiers dans `src/`. 3048 tests verts sur 257 fichiers. 6 espaces éditables. 2 types de
documents sur 6 savent s'enregistrer — l'espace Image, lui, exporte mais ne s'enregistre pas encore.**

`pnpm validate` est vert, **budget de couverture compris** : il lance `test:coverage`, dont les
seuils sont des **budgets d'éléments non couverts** par glob (`vitest.config.ts`), pas des
pourcentages.

**Il sortait en 1 sur `main` le 8 août** : `engines/{scene,skybox,viewport,texture,gpu}/**` était
à 367 branches non couvertes pour 310 permises, depuis la fusion des espaces Image et 3D. Deux
chantiers l'ont refermé sans se concerter — `test/gpu-coverage` sur le GPU, `feat/3d-finition` sur
les 57 branches de logique pure qui n'en étaient pas. Le glob est à **232 pour 310**, 78 de marge.
Ce qui reste dessous est du moteur WebGL que jsdom n'exécute pas.

`engines/{timeline,canvas,audio,core}/**` suit à **242 pour 250**, huit de marge : c'est lui, le
tendu. Deux globs sont à **zéro** : `main/diagnostics/**` et `renderer/src/services/**`, le canal
qui dit les échecs — une branche que personne n'exerce y serait un échec que personne ne lirait.

**Couvrir avant d'élargir** ; le commentaire du fichier dit le seul cas où élargir est légitime
(un glob dont la marge de croissance est du GPU intestable).

> **Un grain de sable environnemental subsiste : `src/renderer/src/settings/ShortcutsSettings.test.tsx`
> dépasse son budget de 5 s par test quand la machine porte plusieurs sessions** — des
> sous-ensembles différents à chaque passage, verts en isolation. C'est `userEvent` qui est lent,
> pas une régression. Il rend `validate` capricieux pour tout le monde tant que plusieurs worktrees
> tournent en parallèle.

L'application démarre par `pnpm start`.

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

**L'espace Image édite pour de bon** — calques, groupes, masques, seize modes de fusion,
sélection qui borne les outils, poignées de transformation, formes, texte, calques de réglage,
cinq éditions IA et l'export PNG. Une image de l'étagère y entre par trois portes : le dépôt sur
la toile, le double-clic, et l'outil Image… (`⇧⌘K`). **Il s'ouvre sur le pointeur, jamais sur le
pinceau** : le premier clic sur une image ne doit pas pouvoir y laisser une trace. Le pinceau écrit
là où le curseur est, y compris sur un calque déplacé, mis à l'échelle ou pivoté. Cf. § 3.2 pour ce
qui reste.

**La configuration** — un registre de commandes unique lu par le menu natif, le clavier et l'écran
des raccourcis ; un registre de réglages qui gouverne les préférences et la validation côté main.

**La persistance des documents** — écriture atomique, marque « modifié », puce sur l'onglet,
relecture à l'ouverture. Le mécanisme est générique ; **deux espaces y sont branchés**, la 3D et les
Textures.

**Le manuel utilisateur** — 19 chapitres, fr et en (`docs/fr/manuel/`, `docs/en/manual/`), vérifiés
contre le code le 8 août 2026 après la fusion de l'espace Image. Il ne se relit pas, il **se
vérifie** : les registres (`COMMAND_REGISTRY`, `IMAGE_TOOLS`, `UNBUILT_TOOLS`, `TOOL_PLACEMENTS`,
`IO_BY_KIND`) et le bundle i18n disent ce que le logiciel fait — l'impression qu'on en a, non.

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
- **L'étagère à assets était à droite dans tous les espaces**, où elle mangeait la largeur du
  canvas. `TOOL_PLACEMENTS` (`shared/domain/tool.ts`) la pose désormais en **bande du bas** partout
  sauf en Vidéo, où la colonne de gauche la porte — la timeline occupe le bas.

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

## 3.2 Mode Image

**Jalons 0 à 3, puis 4, 6, 7, 9 et 10 livrés et fusionnés dans `main`.** Moteur : **PixiJS v8, pas
three.js**. Ce qui reste tient en dix points, § « Ce qui reste, par ordre de valeur » — et le premier
en débloque cinq à lui seul.

### Le socle déjà posé — ne pas le réécrire

**Le registre de commandes appartient à `shared/domain/command.ts`.** `COMMAND_REGISTRY`, une entrée
par commande avec `scope`, `titleKey`, `helpKey`, `defaultBinding` ; les overrides de touches vivent
dans `stores/bindings.ts`. Ajouter une commande, c'est trois choses : un descripteur dans
`COMMAND_REGISTRY`, deux clés i18n (`commands.<nom>.title` / `.help`) dans `fr.json` **et**
`en.json`, et un `case` dans le `switch` du document concerné. Le mode Image a son scope `'canvas'`
et dix-huit commandes — les dix du zoom et des repères, plus `deselect`, `maskFromSelection`,
`export`, et les cinq éditions IA — exécutées par `ImageDocument` derrière
`useShortcuts({ scope: 'canvas', enabled: active, onCommand: run })` — **le document en avant est le
seul à écouter**.

**Le modèle de document est un arbre.** `engines/canvas/canvas-state.ts`, `state.layers` est la
racine, jamais le document entier :

    type Layer = PixelLayer | GroupLayer | AdjustmentLayer | TextLayer   // discriminé par `kind`

**Ne jamais parcourir l'arbre à la main** : `allLayers`, `layerById`, `mapLayers`, `updateSiblings`,
`pixelLayer` / `groupLayer`. **Les pixels ne sont pas dans le modèle** — ils vivent dans les
`RenderTexture` de `CanvasEngine`, indexées par id de calque (invariant 3). `resizeCanvas` déplace le
cadre sans toucher aux pixels ; `resizeImage` rééchantillonne, mais les textures ne le sont **pas
encore** — c'est `resurface`, le blocage décrit plus bas.

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

### Cinq écarts avec ce qu'on croit savoir

1. **Le socle GPU se construit sur `Filter` de Pixi.** `import 'pixi.js/unsafe-eval'` vient en
   premier : la CSP d'Electron interdit `unsafe-eval` et Pixi compile ses shaders avec
   `new Function()`. `engines/canvas/adjust-filter.ts` est le premier écrit ; `blur`,
   `morphology` et `threshold` restent à faire.
2. **Aucun objet GPU dans le modèle.**
3. **`hue` n'existe pas dans les modes de fusion de Pixi** — 8.19 l'a *commenté hors* de son propre
   type `BLEND_MODES`, si bien que le littéral ne typecheckerait même pas. La table
   `BLEND_BY_MODE` le fait retomber sur `normal`, explicitement et sous test. Ne pas le mapper sur
   autre chose.
4. **Pixi lit le canal ROUGE d'un masque de sprite, pas l'alpha.** `setMask({ channel: 'alpha' })`
   est le chemin pour l'autre. Les deux sont utilisés, pour des raisons différentes — voir § 3.2.
5. **Le `blendMode` d'un `Container` n'est qu'hérité**, et chaque enfant écrit le sien : un groupe
   ne compose vraiment qu'à travers une passe hors écran.

### Ce que `feat/image` a livré — fusionnée dans `main` le 8 août 2026

Trente-quatre commits, fusionnés (`dbc65f8`) ; la branche et son worktree n'existent plus. Les
jalons 4, 6, 7, 9 et 10 sont **largement faits** ; ce qui reste est listé plus bas, avec sa raison.

**Compositing (jalon 4).** Les seize modes de fusion fusionnent vraiment — il manquait
`import 'pixi.js/advanced-blend-modes'`, sans lequel onze des seize retombaient silencieusement sur
`normal` ; il faut aussi `useBackBuffer: true` à l'`init` et
`Filter.defaultOptions.resolution = 'inherit'`, les deux dans `engines/core/mount.ts`. Les groupes
sont des `Container` qui composent leur sous-arbre, l'écrêtage découpe sur l'**alpha** de sa base
(voir l'écart 5 ci-dessous), les masques de calque existent et se peignent au pinceau
(`setPaintTarget`), `fillOpacity` est distingué de `opacity`. Le calcul pur est sorti dans
`engines/canvas/compositor.ts`, testable sans GPU : qui écrête qui, quel conteneur porte quel groupe,
et une signature de placement qui évite de reconstruire l'arbre à chaque frame d'un glissement.

**Le panneau Calques (jalon 4).** Renommage sur double-clic, les trois verrous derrière un bouton,
repli des groupes, indentation, grouper / dégrouper / dupliquer, et un inspecteur de calque complet
(opacité, opacité de fond, les seize modes, écrêtage, verrous, transform).

**Sélection (jalon 6).** Rectangle, ellipse et lasso, dans `stores/canvas-views.ts` — session, hors
historique. Le pinceau, la gomme et le pot sont bornés par un **pochoir GPU**, jamais par un test par
touche. « Faire un masque de la sélection » relie les deux, ce qui est le prérequis de l'inpainting.

**Transformation (jalon 7).** Les huit poignées plus la rotation (`engines/canvas/handles.ts`,
arithmétique pure et testée sans GPU — `layerBoxOf` y vit aussi, sortie du moteur), les six formes,
et le texte comme genre de calque qui reste éditable.

> **Deux pièges de poignée, trouvés en revue et corrigés.** La compensation de position se calculait
> contre `transform.x` comme si la boîte y commençait : faux dès que l'origine n'est pas 0, donc
> toujours, `IDENTITY` la posant à 0,5 — l'arête qu'on tire *contre* dérivait pendant qu'on
> redimensionnait. Et la borne anti-écrasement portait sur le *pas* d'un geste, non sur l'échelle
> cumulée : trois glissements successifs atteignaient encore un millionième. Les deux ont un test de
> mutation.

**Réglages (jalon 9).** `engines/canvas/adjust-filter.ts` reprend le GLSL de
`engines/gpu/passes/adjust.ts` dans un `Filter` Pixi. Un calque de réglage grade **tout ce qui est
sous lui dans son parent**, ou le seul calque du dessous s'il est écrêté.

**L'IA dans le canvas.** `maskFrom` porté dans le descripteur de champ, un champ image qui accepte un
dépôt d'asset, l'envoi d'une image à `assets.upload` par un canal IPC typé, `snapshot()` /
`maskSnapshot()`, et cinq actions d'édition qui **préparent le formulaire sans jamais le soumettre**.

**Export (jalon 10).** ⇧⌘E aplatit le document et l'écrit sur le disque.

**Ce que les revues ont encore rattrapé, après coup.** Le bouton du groupe *Cadre* s'armait alors que
ses trois modes sont grisés — `Toolbar` n'hérite pas le `disabled` d'un mode, si bien que le bouton
paraissait vivant et ne faisait rien ; il porte désormais son propre `disabled`, et tout le chemin de
recadrage a été retiré du moteur plutôt que laissé injoignable. Un calque texte refusait aussi le
pinceau *dans son masque*, alors que seule sa propre texture est réécrite à chaque lettre.

### Le blocage qui commandait tout le reste — levé

**`resurface` existe** (`CanvasEngine`, branché sur la détection de cadre déplacé d'`apply`). Il
recrée chaque texture à la nouvelle taille, **masques compris**, y recopie l'ancienne image à
l'origine — sans décalage, `resizeCanvas` déplaçant déjà les transforms — et jette les tuiles
d'annulation en signalant chacune, une capture nommant sa tuile dans les coordonnées de sa surface.

Avec lui, la peinture en espace calque (`layer-space.ts`) : le pinceau, la gomme, les formes, le pot
borné et le masque de sélection traversent un conteneur portant la matrice inverse du calque. Sans
ça, peindre sur un calque déplacé, mis à l'échelle ou pivoté tombait à côté du curseur — général et
préexistant, dont le recadrage n'était qu'un symptôme.

> Photoshop évite la question en interdisant la combinaison : un calque raster n'y porte aucune
> matrice, seulement un rectangle en coordonnées de canevas, et le seul type qui garde une transform
> vivante — l'objet dynamique — est celui que le pinceau refuse. Figma ne se la pose pas, ses brosses
> produisant du vecteur. Ce dépôt a choisi l'autre modèle, assumé dans la JSDoc de `flipImage` ; il
> le finit donc.

**Ce qui reste à rebrancher.** Les cinq commandes existent et sont testées ; il leur manque leur
entrée d'interface :

- **Miroir et quart de tour : faits.** Quatre entrées de registre, un menu **Image** dans
  `main/menu/template.ts` — conditionné à l'espace comme le menu Ajouter de la 3D. À savoir avant
  d'ajouter une commande d'espace : **le menu natif n'exposait aucune commande de scope `canvas`**,
  toutes passaient par le clavier. Une commande sans raccourci par défaut et sans entrée de menu
  est injoignable.
- **Fusionner et Aplatir : faits.** `mergeInto` vise une surface qui existe déjà — composition
  immédiate, le calque du dessus porté à travers le document puis ramené dans les pixels du dessous.
  `flattenInto` vise un calque qui n'existe pas encore : composé pendant que la pile est là, gardé en
  attente, versé quand la surface naît. **L'ordre est le contrat** : composer, puis lancer la
  commande — après elle, ce dont l'image est faite n'existe plus.
- **Recadrer** — le seul qui reste, et le plus lourd. `54730cc` a retiré **tout le chemin de
  recadrage du moteur** ; il ne subsiste que le littéral `'crop'` dans l'union et dans
  `UNBUILT_TOOLS`. Le rebrancher, c'est réécrire le geste : glisser un cadre, l'afficher dans
  l'overlay, valider au relâchement.


**Une conséquence à écrire dans le manuel le jour où le recadrage est offert** : rétrécir perd ce qui
tombe hors du cadre, et les tuiles d'annulation partent avec. Le cadre revient sur ⌘Z, les pixels
retirés non. C'est le comportement de Photoshop « Supprimer les pixels rognés » **coché**, sauf que
son historique à lui les rend.

<!-- Conservé pour mémoire : ce que chacune cassait avant `resurface`. -->

| Fonctionnalité | Ce qui casse sans `resurface` |
|---|---|
| Recadrage | Le cadre bouge, la texture non : le pinceau écrit au décalage du recadrage |
| Miroir, quart de tour | Les calques sont posés hors du cadre |
| Fusionner vers le bas | La texture du calque du dessus est détruite sans être composée |
| Aplatir | Le document devient transparent, et ⌘Z ne rend pas les pixels |
| Persistance | Une sauvegarde qui perd les traits de pinceau |

Les commandes correspondantes vivent dans `engines/canvas/commands.ts` (`cropToRect`, `flipImage`,
`rotateImage`, `mergeDown`, `flatten`).

### Ce qui reste, par ordre de valeur

1. **Le geste de recadrage**, ci-dessus — le dernier des cinq.
2. **La persistance** (jalon 10). Le format est tranché : un dossier `<nom>.img/` avec le JSON et un
   PNG par calque, inspectable et réparable à la main. `serializeCanvas` / `deserializeCanvas`
   existent et ne sont appelés que par leurs propres tests ; `PixelLayer.source` et `loadInto`
   couvrent déjà la relecture d'un calque venu d'un asset. Il manque le canal IPC d'écriture
   multi-fichiers et l'extraction par calque.
3. **La classification des modèles.** `familyOf` (`main/scenario/schema.ts`) ne produit jamais les
   familles `upscale`, `background-removal` ni `vectorization` : trois des cinq actions d'édition IA
   — Détourer, Agrandir, Vectoriser — n'ont donc aucun modèle à trouver et s'arrêtent proprement sur
   « aucun modèle réglé ». Travail de catalogue, pas d'espace Image. **Régénérer la zone** et
   **Étendre**, en famille `image`, fonctionnent de bout en bout.
4. **Le preset suit la famille de l'édition, pas celle de l'espace.** `prepare(family, …)` range le
   preset sous la famille de l'édition alors que le Generator de l'espace Image lit `preset.image` :
   même avec un modèle d'agrandissement réglé, « Agrandir » ouvrirait un formulaire qui ne montre pas
   l'image envoyée. Même endroit à reprendre que le point 3.
5. **Le réordonnancement des calques par glisser.** `reorderLayer` existe et est testée, sans bouton.
   **Aucune liste réordonnable n'existe dans `design/`** — le seul `draggable` du dépôt est
   `DraggableAsset`, qui sort un asset vers l'extérieur. L'écrire dans une liste virtualisée à groupes
   imbriqués, avec indicateur de dépose et cible calculée par niveau, est un morceau à part entière.
6. **La pile de calques est un arbre rendu par `Collection`, qui est une liste.** `design/Tree.tsx`
   existe, virtualisé, avec l'indentation, le chevron, `role="treeitem"`, `aria-expanded` et le repli
   aux flèches — la pile n'a rien de tout cela : un lecteur d'écran y entend une liste plate, et c'est
   le seul arbre du studio où les flèches ne replient rien. `Tree` attend des nœuds plats
   `{ id, parentId }` et un `Set` d'ouverts tenu par l'appelant, là où les calques s'imbriquent et
   portent `collapsed` dans le document : `panels/layers/layer-rows.ts` est à une ligne de pouvoir
   émettre les deux.
7. **Deux réglages manquent sur les six de la spec.** `AdjustmentKind` expose `exposure | contrast |
   saturation | temperature` — celles que la passe applique vraiment. Courbes et LUT demandent chacune
   une texture de correspondance et un éditeur ; les offrir dans le panneau sans les appliquer serait
   un curseur inerte.
8. **Registre d'outils (jalon 5).** Le `switch` de `CanvasEngine.onPointerDown` a grandi avec les
   gestes de forme, de recadrage, de texte et de poignée. L'extraction vers `engines/canvas/tools/`
   reste un refactor interne, sans effet visible — à faire quand un neuvième geste sera à ajouter, pas
   avant. Les trois obstacles décrits au jalon 5 tiennent toujours.
9. **Peinture avancée (jalon 8).** Pression du stylet, `getCoalescedEvents`, texture de brouillon,
   dégradés, vrai flood fill par tolérance, `brush.hardness` qui n'a toujours aucun lecteur.
10. **La sélection ne se convertit pas depuis un masque.** « Faire un masque de la sélection » existe ;
    l'inverse demanderait de relire la texture du masque pour en extraire le contour — un aller-retour
    GPU puis un balayage d'un million de pixels sur le thread UI, ce que l'invariant 6 interdit.

### Dette connue, relevée en revue et assumée

- **Un calque masqué ou écrêté dont le mode de fusion n'est pas `normal` compose faux.** Pixi
  implémente un masque comme un filtre, et `FilterSystem` lie sa cible **en l'effaçant** : le sprite
  est dessiné sur du vide, puis recollé en `normal`. Un `multiply` sur un calque écrêté sort noir. Le
  corriger demande d'appliquer la fusion au *résultat* masqué — une refonte de la composition, que
  jsdom ne peut pas vérifier.
- **`clipped` sur un groupe est ignoré.** `setLayerClipped` l'accepte, le compositeur n'en fait rien.
- **L'opacité d'un calque de réglage n'a pas d'effet.** Son conteneur porte les calques qu'il grade :
  y poser `alpha` fondrait ce qu'il grade plutôt que le grading. L'œil retire la passe ; l'opacité
  demanderait de mélanger la passe gradée avec l'originale.
- **`GroupIsolation` reste sans effet.** `pass-through` est documenté comme « laisse un réglage
  atteindre ce qui est sous le groupe » ; le compositeur récurse par niveau et ne l'honore pas. C'est
  le calque de réglage qui donne enfin son sens à ce type.
- **`useBackBuffer: true` est inconditionnel** : chaque rendu racine passe par une copie plein écran,
  même pour un document qui n'emploie que `normal`. `renderer.backBuffer.useBackBuffer` est un champ
  mutable — il pourrait suivre la présence d'un mode avancé dans l'état.
- **`composite()` et `placement()` allouent un arbre par `apply`**, donc jusqu'à soixante fois par
  seconde pendant un glissement, pour un résultat presque toujours identique. Un hachage roulant
  calculé dans la boucle de synchronisation existante supprimerait l'allocation.
- **Les textures d'images placées ne sont jamais déchargées** du cache de Pixi : une par image posée,
  pour toute la session.
- **La pipette n'a pas suivi le passage en espace calque.** `pick` extrait depuis `surface.sprite`
  avec un cadre en coordonnées document ; l'espace que Pixi donne à ce cadre quand la cible est un
  sprite transformé ne s'établit pas sans GPU. Laissée telle quelle plutôt que corrigée au jugé —
  à trancher avec le MCP `electron`, en même temps que les quatre dettes de compositing.
- **`maskKey` partage l'espace de noms des ids de calque** (`${id}:mask`). Les ids de l'application
  sont des UUID, mais `deserializeCanvas` accepte n'importe quelle chaîne.
- **Le glisser-déposer d'asset est copié dans quatre espaces** (image, texture, skybox, timeline) :
  même état de survol, mêmes trois gestionnaires, même chaîne de classes. Un `useAssetDrop` et un
  composant de liseré dans `design/` les réduiraient à deux lignes chacun.
- **`image-generation.ts` et `skybox-generation.ts` sont identiques à huit lignes près** (59 sur 94 le
  sont au caractère). Une fabrique commune s'impose dès le troisième espace qui recevra des
  générations.

### Ce qui a été appris et qui n'était pas su

- **Pixi lit le canal ROUGE d'un masque, pas l'alpha** (`effectsMixin.mjs`, `channel: 'red'`), et sa
  propre documentation propose `setMask({ channel: 'alpha' })`. Le masque de calque garde donc le
  rouge — c'est l'ergonomie Photoshop, on peint en noir pour cacher et en blanc pour révéler.
  L'écrêtage, lui, est passé sur l'alpha : ce qui découpe un calque écrêté, c'est là où sa base a des
  pixels, pas leur rougeur.
- **Un masque neuf doit naître blanc.** Né effacé, il faisait disparaître le calque à l'instant où on
  cochait la case.
- **Le `blendMode` d'un `Container` v8 n'est qu'hérité**, et chaque enfant écrit le sien : le mode de
  fusion d'un groupe ne faisait rien du tout. Son `alpha` multiplie **par enfant**, donc deux calques
  qui se chevauchent dans un groupe à 50 % se transparaissaient. Les deux n'ont de sens qu'à travers
  une passe hors écran — d'où la condition `isolate || blend !== 'normal' || opacity < 1`.
- **Un shader copié d'un espace colorimétrique à l'autre ment.** Le pivot du contraste, 0,18, est le
  gris moyen en **lumière linéaire** ; les textures du canvas sont en sRGB, où il vaut 0,5. Pivoter à
  0,18 éclaircissait toute l'image au lieu de la durcir.
- **L'état doit porter ce que le moteur dessine.** `placeAsset` écrivait le calque dans le store puis
  appelait `loadInto` — or le moteur n'apprend l'existence du calque qu'un commit React plus tard, si
  bien que **l'image n'arrivait jamais**, et trois suites de tests passaient autour du trou. La source
  vit maintenant dans `PixelLayer.source`, et le moteur la dessine quand il construit la surface : le
  redo, l'onglet rouvert et le changement d'espace pendant une génération sont réparés du même coup.
  C'est l'invariant 3 — un moteur se reconstruit depuis son état — qui n'était pas tenu.

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


## 3.3 Espace 3D

> **Fusionné dans `main`, en deux temps.** Onze étapes d'abord
> (`feat/3d-completion`, plan et journal dans
> [`docs/plans/2026-08-08-3d-completion.md`](plans/2026-08-08-3d-completion.md)), puis cinq commits
> de finition (`feat/3d-finition`) : le canal qui dit les échecs, Draco et KTX2, la ligne du manuel
> sur le sprite, et la dette de couverture refermée.

**Ce qui existait avant** — 17 primitives, 5 types de lumières, gizmo translate/rotate/scale,
sélection par raycast, inspecteur dérivé des descripteurs, undo avec coalescing par geste, 5 slots
de textures PBR, outliner, vol libre, enregistrement du document.

**Ce que la branche ajoute** — sélection multiple, groupes et reparentage, import glTF/GLB,
magnétisme et repère local, ombres réglables par nœud, environnement IBL depuis une skybox du
projet, glisser-déposer d'un asset dans le viewport, dupliquer/copier/coller, `sprite`, caméra
orthographique, six vues normalisées, trois modes d'affichage, export glTF/GLB/USDZ, et un BVH
construit en worker pour le picking.

### Ce qui manque encore

| Manque | Pourquoi il reste |
|---|---|
| `text` 3D | `TextGeometry` exige une police au format typeface. **Tranché le 8 août** : `opentype.js` autorisé, polices libres embarquées **et** polices du système, la typographie partagée pour que l'espace Image en profite — son calque texte code `fontFamily: 'sans-serif'` en dur. Pas encore codé |
| Instanciation, LOD | écartés par le plan tant qu'aucun cas réel ne les réclame : le seul coût mesuré était le picking, et il est réglé |
| Clic du `ViewHelper` | son animation déplace la caméra sans prévenir `OrbitControls` ; la cible de l'orbite divergerait |
| three livré deux fois | le chunk du worker BVH pèse 490 ko parce qu'il embarque three, déjà dans le bundle principal. Chargé à la demande et en local, donc supportable — mais c'est du poids d'installation en double |

**Comblé depuis** — l'export d'un sprite est documenté (ni glTF ni USDZ n'ont d'objet face à la
caméra, vérifié dans le code des exporteurs) ; le chapitre 09 a ses sections sur le magnétisme,
le repère local, les ombres et l'environnement ; **Draco et KTX2 sont branchés**, décodeurs
copiés depuis three au postinstall et servis depuis `public/` — le chemin absolu qu'on croit
naturel casse en `file://`, il fallait le relatif, vérifié sur le build empaqueté.

### Les échecs de la 3D ne sont plus silencieux

`diagnostics:report` va du renderer vers le main, en regard de `diagnostics.onLog` qui fait
l'inverse. Le main préfixe le domaine par `renderer/` à l'arrivée et n'accepte qu'un domaine de
la liste partagée `LOG_SCOPES` : une ligne ne peut pas se faire passer pour lui.

Six échecs y sont branchés : un `.glb` illisible, une texture introuvable — sous un nom par
espace, 3D, Textures et Skyboxes —, un export de scène ou d'image que le disque refuse, et un
enregistrement de document qui échoue.

Trois choses apprises en le construisant, toutes trouvées en revue :

- **le cache de textures est construit par trois moteurs**, et annonçait `scene.texture` pour les
  trois. Il reçoit son rapporteur comme il reçoit déjà son chargeur ;
- **un échec périmé accusait un fichier que la scène allait dessiner** : relâcher puis reprendre
  une clé pendant que le premier chargement volait encore, et son rejet était rapporté alors que
  le second allait aboutir — la déduplication gravait ensuite ce fantôme et aurait tu le vrai ;
- **un rapport est dit une fois par sujet**, sinon un moteur reconstruit à chaque panneau détaché
  remplit le journal. La mémoire s'efface au changement de projet.

**Ce qui reste du chantier « surface d'erreur »** : rien ne s'affiche encore à l'écran, et six
autres avaleurs de rejets attendent (`Rail`, `peaks`, `prepareEdit`, `decoder-pool`,
`useWaveSurfer`, `Models`). Une piste écartée volontairement : journaliser dans `handle()` couvrirait
les quarante canaux d'un coup, mais une erreur du SDK embarque la clé API — il faudrait la réduire
avant, et `log.ts` l'écrit en gros.

### Le plafond du décodage IPC a été contourné, pas résolu

**⌘S gèle toutes les fenêtres au-delà de ~5 500 nœuds**, et c'est le **décodage du clone IPC** qui
l'y amène — 73 % du coût, deux fois et demie la sérialisation, intouché.

L'import glTF aurait dû faire franchir ce plafond : un GLB apporte ses maillages par milliers. Il
ne le fait pas, parce que **le modèle importé est un seul nœud portant une référence**, jamais un
sous-arbre de nœuds. Le document grossit d'une ligne quel que soit le poids du fichier. Le prix est
que l'intérieur d'un modèle ne s'édite pas ; une commande « éclater » est ce qui lèverait la
limite le jour où elle gênera. **Le décodage reste à traiter avant tout ce qui poserait des nœuds
par milliers.**

### Ce que la nuit a appris

- **Un helper de lumière porte l'identifiant de sa lumière** pour qu'un clic dessus la sélectionne.
  Il est donc posé dans le viewport **à côté** des nœuds, comme la grille, le trièdre, le gizmo et
  la cible d'une directionnelle. L'export s'en sort par construction — il ne reçoit que les objets
  des nœuds — et c'est vérifié sur le fichier produit, pas supposé.
- **`GLTFLoader` nomme chaque maille qu'il ramène.** Le picking rendait donc `mesh_0` comme
  identifiant de nœud, écrivant un fantôme dans la sélection, l'historique et le document.
  `nodeIdOf` n'accepte plus qu'un nom que le moteur a lui-même posé.
- **Un type de nœud ignoré du chargeur disparaît en silence.** `isSceneNode` ne connaissait pas
  `group` : une scène groupée rouvrait sans ses groupes, leurs enfants pendant à un parent que
  rien ne nommait. Le même piège attendait `sprite`. **Tout nouveau type de nœud se teste par un
  aller-retour disque.**
- **Les exporteurs écrivent une transformation locale.** Exporter une sélection imbriquée sans
  aplatir la place où elle est dans son parent, pas où elle est dans la scène.
- **`SpriteMaterial` naît transparent** — three l'écrase exprès. L'éteindre à pleine opacité fait
  dessiner le carré entier de toute image à canal alpha.
- **Un `Sprite` n'est pas un `Mesh`** : toute branche de libération gardée par `instanceof Mesh`
  laisse fuir son matériau.
- **La conversion rad→deg→rad n'est pas exacte.** Diffé en radians, un axe intact était déclaré
  bougé à 13 % près : une rotation écrasait les deux autres axes de la sélection.
- **Un `SettingRow` de genre `number` refuse les décimales** — deux réglages de magnétisme étaient
  inatteignables, leur propre défaut compris. Un test verrouille la règle pour tout futur réglage.

### Le coût d'un clic, mesuré

`scene-picking.bench.ts`. Le rayon qui *touche* est le cas cher : three teste une sphère englobante
avant de marcher les triangles, donc un rayon qui rate ne coûte rien quelle que soit la densité.

| Scène | Avant | Avec le BVH |
|---|---|---|
| 3 modèles de 131k triangles | 7,3 ms | **0,016 ms** |
| 3 modèles de 524k triangles | 32 ms | **0,018 ms** |
| 2500 petites mailles | 0,13 ms | — |

Le seuil que le plan s'était fixé était 2 ms. L'arbre est construit **en Web Worker** (invariant 6),
seulement au-delà de 20 000 triangles, et seulement pour les modèles importés : une primitive du
studio fait trente triangles et se marche plus vite qu'un arbre ne se construit.

**Le chemin chaud de l'inspecteur n'est pas un sujet** — audité, chiffré, clos. Cf. § 5.

### À revoir en priorité

**Les étapes 8 à 11 n'ont été relues que par leur auteur.** La limite hebdomadaire de l'API a coupé
les sous-agents en pleine revue de l'étape 8 ; `/simplify` et `/code-review` ont été menés à la
main pour `sprite`, les modes d'affichage, l'export et le BVH, puis une dernière fois avant la
fusion sur les résolutions de rebase. Les bugs trouvés à ces relectures sont écrits dans le plan,
étape par étape — mais un seul regard n'en vaut pas deux, et c'est là qu'une lecture humaine
rapporte le plus. **Les deux résolutions de rebase à regarder en premier** : la réunion de
`generation-claims.ts`, créé des deux côtés, et l'extraction de `saveDialog` dans `services.ts`,
où un export d'image et un export de scène partagent désormais un dialogue.

Second point : **sur Windows et Linux, un raccourci qu'une surface écoute elle-même attend la
touche Windows, pas `Ctrl`** — `signatureOf` lit `event.metaKey`. C'est la convention de tout
`COMMAND_REGISTRY`, `⌘Z` compris, donc antérieure à cette branche ; la corriger touche la
résolution des raccourcis de toute l'application. Documenté aux chapitres 15 et 18 du manuel.

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

**Le double dispatch des accélérateurs Electron n'a jamais été vérifié en conditions réelles.** macOS
consomme probablement la frappe avant le renderer, Windows/Linux non. Personne ne l'a mesuré sur les
trois plateformes.

**`src/main/menu/index.ts` n'a aucun test** — empreinte, débounce, cycle de vie par fenêtre.
`src/main/ipc/test-harness.ts` mocke déjà `ipcMain`, mais il faut l'étendre à
`app` / `BrowserWindow` / `Menu`.

**Aucun test ne s'exécute sur l'application lancée.** Les 250 fichiers de test sont unitaires :
`find src -name '*.e2e.*'` ne rend rien. Tout ce qui ne se prouve qu'en conditions réelles —
ouverture, parcours des six espaces, détachement d'un panneau, fermeture propre, consoles main et
renderer sans erreur — est vérifié à la main, à chaque fois, par qui livre. C'est le poste de
vérification le plus cher du projet et le seul qu'aucune porte ne tient.

En ajouter demande **Playwright ou équivalent**, donc une dépendance : la décision revient au
propriétaire du dépôt. **Reporté le 8 août 2026, pas abandonné** — noté ici pour que la prochaine
session le retrouve. Suivi sous `L7` dans `.claude/loop/BACKLOG.md`.

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

**Une fusion sans conflit n'est pas une fusion sans contradiction.** La fusion de `feat/image` en a
fait la démonstration : un autre travail avait documenté, dans huit chapitres du manuel, que
« l'espace Image ne sait pas ouvrir une image existante » — au moment précis où cette branche
l'implémentait. Les deux textes touchaient des lignes différentes, donc **git les a mêlés
proprement, sans rien signaler**, et le manuel décrivait deux logiciels à la fois.

La règle qui en sort : **après toute fusion touchant à la fois du code et de la documentation,
relire ce que la doc affirme sur ce que le code vient de changer** — un grep sur les tournures de
manque (« ne sait pas », « pas encore », « rien du tout », « aucun bouton ») trouve en trente
secondes ce qu'aucun outil de fusion ne verra jamais. Et vérifier chaque affirmation dans le code
plutôt qu'au jugé : sur les quatre limites suspectes de ce lot, **trois étaient tombées, une
tenait encore** — le recadrage, toujours dans `UNBUILT_TOOLS`. Supprimer la quatrième aurait fait
mentir la doc dans l'autre sens.

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
