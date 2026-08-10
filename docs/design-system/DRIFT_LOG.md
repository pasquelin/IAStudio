# DRIFT_LOG

`P0-button-tooltip` — tout bouton porte une infobulle qui explique son action. Quand le
libellé est déjà à l'écran, l'infobulle explique au lieu de le répéter (`HINT_*`) ; sinon elle
donne aussi le nom accessible (`TIP_*`). Source : décision de l'utilisateur du 2026-08-10,
portée dans `CLAUDE.md` § Interface.

Sont clos et n'y figurent plus : les `<ToolButton>` (le type exige `tooltip`), les `<button>`
écrits à la main, les appels à `<Button>`, et les rangées de menu de la coque — barre de titre,
onglets, sélecteur de compte, menu de section de l'accueil.

## Rangées de menu (18)

`MenuRow` porte déjà une prop `tip` — le design system l'avait prévu. Onze rangées la passent
depuis l'itération 13 ; celles-ci ne passent toujours rien.

**Le compte a monté seul deux fois** : 27 au recensement du matin, 29 à l'itération 12, sans
qu'aucune n'ait été traitée entre-temps. Ce sont des menus arrivés par d'autres branches — la
dérive est vivante, et c'est ce que ce journal existe pour montrer.

| P | Fichier:ligne | Règle | Preuve |
|---|---|---|---|
| P0 | src/renderer/src/design/TextureField.tsx:67 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/design/TextureField.tsx:79 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/assets/AssetMenu.tsx:52 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/assets/AssetMenu.tsx:61 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/channels/ChannelTile.tsx:151 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/channels/ChannelTile.tsx:165 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/channels/ChannelTile.tsx:179 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/channels/ChannelTile.tsx:188 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/explorer/EntryMenu.tsx:45 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/explorer/EntryMenu.tsx:50 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/explorer/EntryMenu.tsx:59 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/layers/LayerRow.tsx:117 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/layers/LayerStackActions.tsx:127 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/layers/LayerStackActions.tsx:150 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/shared/NodeActions.tsx:48 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/styles/StyleMenu.tsx:26 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/styles/StyleMenu.tsx:34 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/spaces/graph/GraphMenu.tsx:63 | P0-button-tooltip | prop `tip` non passée |

## Deux façons de câbler la même rangée

| P | Fichier:ligne | Règle | Preuve |
|---|---|---|---|
| P1 | src/renderer/src/design/Toolbar.tsx:241 | P1-duplicate-role | passe une `TooltipFactory` (`tipFor(orientation, 'flyout')`) là où les onze rangées de l'itération 13 passent `HINT_RIGHT` : la fabrique pose un `aria-label` sur une rangée dont le libellé est visible |

Quatre des vingt-et-un modes d'outil n'ont pas de `descriptionKey` (`scene-tools.ts`) : les
convertir demande d'écrire leur phrase, pas seulement de changer la fabrique. C'est pourquoi ce
n'est pas une ligne du lot 13.

## Le même vide écrit deux fois

| P | Fichier:ligne | Règle | Preuve |
|---|---|---|---|
| P1 | src/renderer/src/panels/documents/Documents.tsx:41 | P1-duplicate-role | réécrit à la main l'`EmptyState` « pas de projet » que `panels/shared/NoProject.tsx` porte déjà |
| P1 | src/renderer/src/panels/projects/Projects.tsx:48 | P1-duplicate-role | idem, avec les deux gestes dans l'ordre inverse |

## Sorties du journal à l'itération 13, corrigées ailleurs

- `design/ShelfTile.tsx:53` (P0) — le bouton porte `{...tip(label, false, hint)}` (ligne 56)
  depuis `816e2dca`. La ligne était vraie quand elle a été écrite ; elle ne l'est plus.
- `home/sections/Creations.tsx:110` (P1) — le fichier est devenu
  `panels/creations/Creations.tsx`, et il **lit** `SHELF_OVERLAY` (ligne 122) au lieu de le
  recopier.

## Ce qui reste à savoir

Les quatre fenêtres montent leur `TooltipHost`. Un `<Tooltip>` fermé ne rend rien du tout, donc
la seule preuve qu'un hôte est monté est un survol de bout en bout.

Les boutons à libellé visible se câblent par `HINT_*`, jamais par `TIP_*` : ce dernier pose un
`aria-label`, qui remplacerait le nom visible. Une rangée de menu en est toujours un.

Trois descripteurs exigent désormais leur phrase en même temps que leur mot —
`EmptyStateAction`, la diapositive de `Spotlight`, et le `submitHint` de `DynamicForm`. Un
appelant qui oublie l'un des deux premiers ne compile pas. **`MenuRow` n'a pas encore ce
verrou** : `tip` y reste optionnelle tant qu'un site ne la passe pas, et c'est le dernier geste
du chantier, pas le premier.
