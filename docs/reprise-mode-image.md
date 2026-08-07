# Prompt de reprise — Mode Image

> À coller tel quel dans une nouvelle session Claude Code, à la racine de `scenario`.

---

## Ce que tu reprends

Tu continues la construction du **mode Image** de Scenario Studio. Deux jalons sur onze sont
livrés, rebasés sur `main`, tests verts. Ta mission est de livrer les jalons 2 à 10.

**Travaille dans le worktree existant**, jamais dans le dépôt principal :

```bash
cd /Users/pasquelin/Applications/scenario/.claude/worktrees/image-mode
```

Branche `feat/image-mode`, basée sur `main` (`d855911`). Trois commits :

| Commit | Contenu |
|---|---|
| `0f15294` | Registre de commandes partagé + menu natif généré |
| `2f29d78` | Modèle de document image enrichi (arbre de calques) |
| `3a16e0e` | Corrections de revue : huit bugs de traversée d'arbre |

D'autres sessions travaillent en parallèle dans `.claude/worktrees/`. `main` bouge vite —
**rebase régulièrement** (`git rebase main`), les conflits grossissent sinon.

Lis `CLAUDE.md` à la racine du worktree avant toute chose. Il est impératif, pas indicatif.

---

## Le socle déjà en place (ne le réécris pas)

### Registre de commandes — `src/shared/domain/command.ts`

Source unique de ce que l'application sait faire. Le menu natif Electron **en est généré**
(`src/main/menu/commands.ts`), jamais écrit à la main. Ajouter une entrée au menu = ajouter un
descripteur au registre, rien d'autre.

```ts
type CommandDescriptor = {
  id: CommandId
  binding?: Signature              // 'Meta+KeyZ', par position physique (event.code)
  accelerator?: PlatformAccelerator // exception : quand les plateformes divergent
  scope?: CommandScope             // 'scene' | 'sequence' ; absent = global
  workspaces?: readonly WorkspaceId[]
  labelKey?: MenuLabelKey          // requis si `menu` est présent
  menu?: { path: readonly MenuLabelKey[]; order: number; separatorBefore?: boolean }
}
```

- `run` et `enabled` **ne sont pas dans `shared/`** : ce sont des fermetures sur les stores du
  renderer, elles ne traversent pas l'IPC. Elles vivent dans
  `src/renderer/src/commands/registry.ts`, qui pousse au main l'ensemble des commandes activées.
- Ce push est **dédoublonné avant l'IPC** (`useNativeMenu.ts`). Ne retire pas ce garde : la tête
  de lecture s'écrit à chaque image décodée, sans lui une séquence en lecture réveille le
  processus main soixante fois par seconde.
- Le main débounce la reconstruction du menu à 50 ms et compare une empreinte.
- `useShortcuts` **s'efface** pour toute frappe que le menu natif porte réellement
  (`menuOwnsKey`) : Electron déclenche l'accélérateur ET délivre le keydown.
- `edit.undo` / `edit.redo` sont **globaux** : ils agissent sur le document en avant quel que
  soit son type, via `DocumentHistoryPort` (`stores/document-store.ts`). Les boutons d'une barre
  d'outils gardent la portée de *leur* document — c'est une distinction que les tests vérifient.
- ⌘Z dans un champ de saisie rend la frappe, pas le calque : le canal `window:edit` demande à
  Chromium d'annuler dans le champ focalisé.

### Modèle de document — `src/renderer/src/engines/canvas/canvas-state.ts`

**Un arbre**, pas une liste. `state.layers` est la racine, jamais le document entier.

```ts
type Layer = PixelLayer | GroupLayer | AdjustmentLayer   // discriminé par `kind`
```

Chaque calque porte : `visible`, `locked: {pixels, position, alpha}`, `opacity`, `fillOpacity`,
`blend` (16 modes), `mask?`, `clipped`, `transform`. Le document porte `dpi`, `colorMode`,
`bitDepth`, `guides`.

Helpers obligatoires — **ne parcours jamais l'arbre à la main** :

| Helper | Quand |
|---|---|
| `allLayers(layers)` | tout le document, profondeur d'abord |
| `layerById(state, id)` | trouver, à n'importe quelle profondeur |
| `mapLayers(layers, change)` | remplacer ou retirer **un** calque |
| `updateSiblings(layers, id, change)` | opérer sur le **niveau** d'un calque (réordonner, fusionner, dupliquer) |
| `pixelLayer(id, name, fill?)` / `groupLayer(...)` | construire, jamais un littéral |

**Les pixels ne sont pas dans le modèle.** Ils vivent dans les `RenderTexture` de `CanvasEngine`,
indexées par id de calque. C'est l'invariant 3 du `CLAUDE.md` : un moteur se reconstruit depuis
son état sérialisé. Ne mets jamais d'objet GPU dans `CanvasState`.

Opérations disponibles (`commands.ts`), toutes testées : `addLayer`, `removeLayer`,
`reorderLayer`, `groupLayers`, `ungroupLayer`, `mergeDown`, `flatten`, `duplicateLayer`,
`resizeCanvas`, `resizeImage`, `cropToRect`, `setLayerBlend/Locks/FillOpacity/Clipped/Opacity/Visible`,
`renameLayer`.

`resizeCanvas` déplace le cadre sans toucher aux pixels ; `resizeImage` rééchantillonne. Cette
distinction est le cœur du modèle — un calque déborde du cadre, le cadre est une fenêtre posée
dessus.

---

## Ce qui est **différent du prompt d'origine** — lis ceci avant de coder

Le prompt initial décrivait un dépôt qui n'est pas celui-ci. Quatre écarts déjà tranchés :

1. **Il n'y a pas de `shared/gpu/GpuPipeline`, ni `passes/adjust`, ni `passes/blur`, ni
   `readback`, ni `shared/model/adjustments`, ni `shared/export/encode`.** Rien de tout cela
   n'existe. Le prompt disait « arrête-toi, ils existent » : c'est faux. Tu devras les écrire.
2. **Le moteur image est PixiJS v8, pas three.js.** `RenderTexture`, `Graphics`, `Filter`.
   Le socle GPU se construit sur `Filter` de Pixi, pas sur un pipeline WebGL nu.
   `pixi.js/unsafe-eval` est importé en premier — la CSP d'Electron interdit `unsafe-eval` et
   Pixi compile ses shaders avec `new Function()`.
3. **Pas de `THREE.Texture` dans le modèle.** Un modèle qui contient un objet GPU n'est plus
   sérialisable, donc viole l'invariant 3.
4. **`hue` n'existe pas dans les blend modes de Pixi.** Il est déclaré dans le modèle et retombe
   sur `normal` dans `CanvasEngine`, en attendant un filtre maison. Ne le mappe pas sur autre
   chose : ce serait compositer faux.

---

## Les jalons restants

Livre dans cet ordre. Chaque jalon se termine par la **definition of done** du `CLAUDE.md` :
tests colocalisés écrits dans le même mouvement, `pnpm validate` vert, `/simplify`,
`/code-review`, et seulement alors l'annonce.

### Jalon 2 — Double canvas, navigation

Overlay `<canvas>` 2D au-dessus du canvas Pixi. Il se redessine à chaque frame, ne contient
**aucun pixel du document**, et dessine en coordonnées écran : les traits font 1 px réel quel que
soit le zoom. Rien de ce qui y est dessiné n'apparaît à l'export.

Zoom / pan / ajuster-à-la-fenêtre, règles, repères (`guides` existe déjà dans le modèle),
magnétisme, barre de zoom en bas du panneau central.

### Jalon 3 — Historique des pixels

**Le bloquant fonctionnel du mode Image aujourd'hui.** Dans `ImageDocument.tsx`,
`onStrokeEnd: () => undefined` : ⌘Z n'annule aucun coup de pinceau. L'historique ne voit jamais
les pixels.

Historique **en deltas par tuiles de 512** sur la bbox sale — jamais d'instantané complet, une
pile de 50 instantanés en 4096² fait 3 Go. Fais aussi écrire l'outil `move` dans l'état : il
déplace aujourd'hui le sprite Pixi, ce qui est perdu au prochain `apply` et absent de l'historique.

### Jalon 4 — Compositing + panneau Calques

Groupes, écrêtage, masques de fusion, 16 modes (importe `pixi.js/advanced-blend-modes`),
`fillOpacity`. `CanvasEngine.apply` parcourt déjà l'arbre — ne casse pas ça, c'était un bug qui
détruisait les textures des enfants de groupe.

`LayersPanel` : glisser-déposer avec indicateur d'insertion, vignettes, renommage au double-clic,
`Alt`+clic sur l'œil pour isoler, `Alt`+glisser pour dupliquer, sélection multiple, groupes
repliables. Il rend aujourd'hui une liste plate : c'est le jalon qui le rend arborescent.

### Jalon 5 — Registre d'outils

Extraire le `switch` d'outils hors de `CanvasEngine` vers `engines/canvas/tools/` :
`onPointerDown/Move/Up`, `drawOverlay`, `onDeactivate`. Barre d'options horizontale en haut du
panneau central, **pilotée par l'outil actif**. Flyouts sur clic long, dernier outil du groupe
affiché, `Maj`+raccourci cycle.

Outils déjà câblés dans le moteur : pinceau, gomme, pot, pipette, déplacer, main, marquee
rectangle (visuel seul). Déclarés mais morts : `crop`, `shape`, `text`, `comment` (voir
`UNBUILT_TOOLS`).

### Jalon 6 — Sélection

**Un masque 8 bits, jamais un tracé vectoriel.** `RenderTexture` + `bounds` + `feather`.
Pointillés **dérivés** du masque : détection de contour → marching squares → polylignes en
coordonnées document → dessin sur l'overlay avec `setLineDash` animé, deux passes (noir puis
blanc décalé de 4) pour rester visible sur tout fond. Transforme en coordonnées écran **au
dessin**, sinon l'épaisseur change avec le zoom.

Rectangle, ellipse, lasso. Modes booléens : `Maj` ajoute, `Alt` soustrait, `Maj+Alt` intersecte.
Contour progressif. Tous les outils respectent la sélection.

Le marquee actuel dessine un rectangle et **ne sélectionne rien** — aucun outil ne le lit.

### Jalon 7 — Transformation

`⌘T`. Boîte englobante, 8 poignées, zone de rotation dans les ~20 px à l'extérieur de chaque
coin. Modificateurs à respecter **exactement** — les utilisateurs les ont dans les doigts :

| Geste | Effet |
|---|---|
| `Maj` + coin | proportions |
| `Alt` + poignée | depuis le centre |
| `Maj+Alt` + coin | proportions depuis le centre |
| hors de la boîte | rotation libre |
| `Maj` + rotation | incréments de 15° |
| `Cmd` + poignée | distorsion d'un coin |
| `Cmd+Maj` + arête | inclinaison |
| `Entrée` / double-clic | valider · `Échap` annuler |

Point d'origine déplaçable. **Non destructive jusqu'à la validation** : les pixels ne sont
rééchantillonnés qu'à la fin, l'interpolation (bicubique par défaut) est un réglage, et chaîner
plusieurs transformations sans revalider ne doit pas dégrader.

Plus : rotations 90°/180°, symétries, déformation (grille 3×3).

### Jalon 8 — Peinture

Pression du stylet (`PointerEvent.pressure`) câblée sur taille et opacité.
`getCoalescedEvents()` pour ne pas perdre de points sur les tablettes haute fréquence, tout en
composant une seule fois par frame. **Texture de brouillon** : le trait en cours se dessine à
part et n'est fusionné dans le calque qu'au `pointerup`. Rectangles sales — un coup de pinceau ne
salit que la bbox du trait. Dégradé (linéaire, radial, angulaire, réfléchi, losange). Pot de
peinture en **vrai flood fill** par tolérance : il peint aujourd'hui edge-to-edge.

### Jalon 9 — Sélection auto + réglages

Écris `engines/canvas/passes/` en `Filter` Pixi : `adjust`, `blur`, `morphology`, `threshold`.
Baguette magique (flood fill par tolérance en espace Lab, contigu ou global), sélection rapide,
`Modifier ▸` (dilater, contracter, contour, lisser), plage de couleurs avec aperçu du masque.
Calques de réglage : niveaux, courbes, TSL, balance des couleurs.

### Jalon 10 — Export

PNG / JPEG / WebP depuis `renderer.extract`. Aplatissement de la pile. `Taille de l'image` et
`Taille de la zone de travail` comme deux commandes distinctes du menu. **Rien de l'overlay ne
doit apparaître à l'export.**

---

## Interdits

- **Aucun pixel traité sur CPU.** Ni `getImageData` + boucle, ni Canvas2D pour le document. Le
  Canvas2D est réservé à l'overlay.
- **Ne modélise pas la sélection comme un tracé vectoriel.**
- **N'écris pas le menu Electron à la main** — génère-le depuis le registre.
- **Ne dessine jamais le chrome d'interface dans le canvas du document.**
- **Ne stocke pas d'instantanés de pixels** dans l'historique.
- **Pas de bibliothèque d'édition d'image tierce** (Fabric, Konva, tui-image-editor) : elles
  imposent leur modèle de document.
- **Pas de dépendance nouvelle sans validation de l'utilisateur.**

---

## Dette connue, à traiter quand tu la croises

1. **`src/main/menu/index.ts` n'a aucun test** — empreinte, débounce 50 ms, filtrage des ids
   entrants, cycle de vie par fenêtre. C'est testable : `src/main/ipc/test-harness.ts` mocke
   déjà `ipcMain` (voir `src/main/settings/handlers.test.ts`), mais il faut l'étendre avec
   `app`/`BrowserWindow`/`Menu` et permettre de passer un événement porteur d'un `sender.id` —
   `invoke()` passe `{}` aujourd'hui.
2. **Le double dispatch des accélérateurs Electron n'a pas été vérifié dans l'app réelle.**
   macOS consomme probablement la frappe avant le renderer, Windows/Linux non. `menuOwnsKey`
   protège du second cas et ne nuit pas au premier, mais cela demande une vérification via
   `pnpm dev:debug` + MCP `electron`.
3. **Le panneau `assets` est à droite dans tous les espaces**, y compris Image, parce que son
   placement dans `shared/domain/tool.ts` n'a pas de champ `workspaces` et que le choix a été
   raisonné pour la vidéo. En mode Image il mange la largeur du canvas pour rien. Correctif
   proposé, **non appliqué, à valider avec l'utilisateur** : `workspaces: ['video', 'audio']` sur
   l'entrée droite + une seconde entrée `bottom` pour les autres espaces.
4. Les calques d'ajustement, `mask`, `clipped`, `fillOpacity`, `isolation`, `guides`, `dpi`,
   `colorMode` et `bitDepth` existent dans le modèle **sans aucun consommateur**. Les jalons 4,
   9 et 10 les branchent. Tant qu'ils n'ont pas de vrai appelant, certaines décisions de
   conception restent devinées.

---

## Méthode de travail qui a marché

- **Les revues qui exécutent le code trouvent plus que celles qui le lisent.** Au jalon 1, deux
  agents qui ont écrit des sondes vitest et mesuré ont trouvé huit bugs réels ; huit agents qui
  avaient seulement lu, au jalon 0, en avaient trouvé trois. Demande explicitement à tes agents
  de reproduire empiriquement chaque défaut.
- **Fais nettoyer derrière les agents** : l'un d'eux a laissé un fichier sonde dans `src/`.
- Les tests attrapent les régressions de portée : au jalon 0, deux tests existants ont révélé
  que mon bouton d'annulation agissait sur le mauvais document.
- Un commentaire qui décrit un comportement disparu est un défaut à part entière dans ce dépôt.
  Quand tu changes un comportement, relis les commentaires autour.

## Commandes

```bash
pnpm validate   # typecheck + lint + format:check + test — vert avant tout commit
pnpm dev:debug  # + port 9222, requis par le MCP electron
pnpm test       # vitest run
```

Messages de commit **en français**, dans le style du dépôt : une phrase d'accroche qui dit ce qui
change de nature, puis le pourquoi. Regarde `git log` pour le ton.
