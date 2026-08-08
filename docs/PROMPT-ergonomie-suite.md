# Prompt de reprise — ergonomie de l'espace Image

> À copier tel quel dans une nouvelle session. Supprimer ce fichier une fois la branche fusionnée.

---

Je reprends **Scenario Studio**, dans `/Users/pasquelin/Applications/scenario`.

La branche **`feat/ergonomie`** porte quatre commits validés et **non fusionnés**, dans le
worktree `.claude/worktrees/ergonomie`. Ta première tâche est de la réconcilier avec `develop`,
puis de la fusionner. Ensuite seulement, deux étapes restent à écrire.

## Avant la première ligne

1. `cd /Users/pasquelin/Applications/scenario/.claude/worktrees/ergonomie`
2. `git log --oneline develop..HEAD` — quatre commits doivent apparaître.
3. Lis `CLAUDE.md`, puis **`docs/REPRISE.md` § 3.2**, dont l'encadré décrit exactement la
   collision qui t'attend.
4. `pnpm install` si le lockfile a bougé. Si `pnpm start` répond `Error: Electron uninstall`,
   c'est le piège du worktree neuf : `node node_modules/electron/install.js`.

## Tâche 1 — la réconciliation, et c'est le vrai travail

`develop` a fusionné `15d4f97` — « Les peintres d'outils quittent le moteur pour l'overlay » —
pendant que la branche était écrite. Les deux vont dans le même sens ; `develop` est arrivée la
première. **Huit zones de conflit sur trois fichiers** : `CanvasEngine.ts`, `CanvasOverlay.ts`,
`CanvasOverlay.test.ts`.

**Fais un `git merge develop`, pas un rebase** : les trois commits touchent tous les mêmes
fichiers, et un rebase te ferait résoudre la même collision trois fois.

Ce qu'il faut porter sur le nouveau modèle, et rien de plus :

- `scene.paint` n'existe plus. Le moteur publie un `ToolChrome` que l'overlay dessine.
- `tools.handles: Rect | null` doit devenir des **`Corners`** (la boîte suit la rotation) et
  porter en plus **la poignée survolée**, pour qu'elle soit dessinée un pixel plus large.
- `drawSelection`, `drawCrop` et `drawPending` vivent maintenant dans l'overlay : ils doivent
  appeler **`ants()`**, déjà écrit et testé dans `CanvasOverlay.ts`.
- La phase des ants et le drapeau `marching` traversent la même frontière.

**Le nouveau modèle simplifie ce travail plutôt qu'il ne le gêne.** Les peintres sont désormais
du côté où les ants vivent, et la poignée illuminée devient **testable** — une revue l'avait
signalée comme structurellement intestable en jsdom, faute de contexte 2D. Profites-en pour la
couvrir.

Ne sont **pas** en conflit et se fusionnent tels quels : `handles.ts`, `cursors.ts`,
`shared/domain/command.ts`, les deux bundles i18n, `main/menu/template.ts`, `image-tools.ts`,
`ImageDocument.tsx`.

Puis : `pnpm validate` vert, `/simplify`, `/code-review`, et fusion `--no-ff` dans `develop`.

## Ce que la branche a livré — ne le refais pas

**La boîte de transformation suit le calque.** `layerBoxOf` ignorait `transform.rotation` : les
poignées d'un calque de travers flottaient à côté de l'image. La géométrie passe par
`layerMatrix`, la matrice que Pixi compose déjà pour le sprite, donc elle ne peut plus diverger.

**La rotation n'a plus de poignée.** Elle s'attrape dans le quart de disque **hors** de chaque
coin, mesuré contre les deux arêtes qui en partent — pas contre le milieu de la boîte, qui sur un
calque 1000×100 fait disparaître l'anneau le long de l'arête longue.

**Le curseur s'oriente** sur la direction nominale de la poignée, tournée par l'angle du calque
et retournée par le signe de ses échelles. Lire l'angle depuis le centre répond à une autre
question : sur un 1024×256, le coin nord-est est à 14° de l'horizontale.

**`resizeBy` recalait la position dans l'espace non tourné** — et ce recalage déplaçait le pivot
autour duquel la rotation s'applique, faisant sauter l'arête ancrée de 707 px à un quart de tour.
Corrigé, et **vérifié dans l'application** : le coin ancré ne bouge plus d'un pixel.

**Les marching ants** façon map3D : double trait clair/sombre, un seul helper pour les trois
surfaces qui pointillent, boucle rAF qui meurt dès que rien n'est pointillé.

**Les vingt raccourcis d'outil existent.** Ils étaient affichés sur les boutons et écoutés par
personne. Le conflit `L` (lasso contre ligne) est tranché : le lasso le garde, la ligne prend
`⇧R`. Un menu **Outils** natif donne une porte aux quatre outils sans touche.

**Le fond des règles** monte d'un cran au-dessus du châssis, graduations comprises.

## Tâche 2 — les deux étapes qui restent

**Le pinceau a une taille, et on la voit.** `BrushSettings` porte `size`, `hardness` et
`opacity` ; `BrushControls` n'expose que la couleur — on peint à 24 px pour toujours. Ajouter les
trois réglages avec `SliderField`, les touches `[` et `]` en commandes de registre, et un
**cercle d'aperçu** au diamètre réel dessiné dans l'overlay au survol : pas un curseur CSS, le
diamètre suit le zoom.

**Ce qui refuse le dit au curseur.** Quand l'outil armé n'a pas de cible peignable
(`paintTarget()` nul : groupe, calque de réglage, calque verrouillé) ou que le calque est
verrouillé en position, le pinceau, le pot, les formes et le déplacement retournent sans un mot.
Le curseur doit devenir `not-allowed` — le refus se lit **avant** le clic, ce qu'aucun toast ne
permet, et un toast par geste refusé serait pire que le silence.

## Deux choses à savoir sur l'environnement

**Le serveur MCP `electron` s'est déconnecté en cours de session.** S'il ne revient pas, un
pilote CDP minimal fait l'affaire : `fetch('http://127.0.0.1:9222/json/list')` pour trouver la
page, puis un WebSocket sur `webSocketDebuggerUrl` et `Runtime.evaluate` / `Page.captureScreenshot`.
Attention : les captures sont en **pixels physiques**, les `clientX` en pixels CSS — le facteur
vaut ~1,03 ici et m'a fait viser à côté deux fois. Sonde le curseur (`canvas.style.cursor`) pour
localiser les poignées au lieu de calculer leurs coordonnées.

**L'application traîne des onglets morts** qui affichent « Ce document n'est plus ouvert ». C'est
un vrai défaut d'usage, il appartient à la couche documents, et il fausse toute vérification
visuelle — on croit piloter un document et on pilote un onglet vide. À traiter, mais séparément.

## Un piège trouvé à mes dépens

`defaultBinding` accepte **n'importe quelle chaîne**. J'ai écrit `'P'` au lieu de `'KeyP'` pour
seize commandes : le typecheck est passé, le lint aussi, et pas un test du dépôt n'a bronché.
Seul un test de bout en bout — une touche sur la fenêtre, l'outil armé vérifié — l'a attrapé.
**Une garde sur le format des signatures manque au registre**, et elle vaudrait son écriture.
