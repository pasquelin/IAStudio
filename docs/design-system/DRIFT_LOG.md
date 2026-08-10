# DRIFT_LOG

`P0-button-tooltip` — tout bouton porte une infobulle qui explique son action. Quand le
libellé est déjà à l'écran, l'infobulle explique au lieu de le répéter (champ `description`).
Source : décision de l'utilisateur du 2026-08-10, portée dans `CLAUDE.md` § Interface.

Les `<ToolButton>` n'y figurent plus : le type l'exige désormais, la régression est
impossible.

## Boutons à icône seule — l'action est indevinable au survol

| P | Fichier:ligne | Règle | Preuve |
|---|---|---|---|

## Peau recopiée

| P | Fichier:ligne | Règle | Preuve |
|---|---|---|---|
| P1 | src/renderer/src/home/sections/Creations.tsx:110 | P1-local-skin | les trois lignes de `SHELF_OVERLAY` recopiées à la main, arrivées avec `feat/accueil` après l'extraction du 2026-08-10 |

## Boutons à libellé visible — l'infobulle doit expliquer, pas répéter

| P | Fichier:ligne | Règle | Preuve |
|---|---|---|---|
| P0 | src/renderer/src/app/ActivityList.tsx:147 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/app/ActivityList.tsx:157 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/app/TitleBar.tsx:219 | P0-button-tooltip | pastille d'espace, aucune description |
| P0 | src/renderer/src/app/UpdateStatus.tsx:31 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/design/CollectionBar.tsx:245 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/design/PropertySection.tsx:20 | P0-button-tooltip | en-tête pliable, aucune description |
| P0 | src/renderer/src/dictation/DictationStatus.tsx:38 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/dictation/DictationStatus.tsx:68 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/dictation/DictationStatus.tsx:83 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/home/HomeView.tsx:96 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/home/sections/ByMode.tsx:52 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/home/sections/Explore.tsx:89 | P0-button-tooltip | onglet, aucune description |
| P0 | src/renderer/src/home/sections/Projects.tsx:65 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/home/sections/Tools.tsx:93 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/panels/inspector/TextureInspector.tsx:215 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/panels/inspector/TextureInspector.tsx:238 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/panels/view/View.tsx:54 | P0-button-tooltip | libellé visible, aucune description |

## Ce qui bloque une partie du lot

Les quatre fenêtres montent leur `TooltipHost` : la principale depuis toujours, les
Préférences, l'Usage et les Licences depuis le 2026-08-10. Plus rien n'est bloqué.

Un `<Tooltip>` fermé **ne rend rien du tout** — vérifié. Le seul test qui prouve qu'un hôte
est monté est donc un survol de bout en bout, ce qui a imposé de monter l'hôte d'une fenêtre
dans le même lot qu'au moins un de ses boutons.

`design/Button.tsx` n'accepte aujourd'hui aucune infobulle : le composant des boutons à
libellé des docks doit d'abord en porter une, comme `ToolButton`.

Les boutons à libellé visible se câblent par `HINT_*` (`helpers/tooltip.ts`), jamais par
`TIP_*` : ce dernier pose un `aria-label`, qui remplacerait le nom visible.
