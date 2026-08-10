# DRIFT_LOG

`P0-button-tooltip` — tout bouton porte une infobulle qui explique son action. Quand le
libellé est déjà à l'écran, l'infobulle explique au lieu de le répéter (`HINT_*`) ; sinon elle
donne aussi le nom accessible (`TIP_*`). Source : décision de l'utilisateur du 2026-08-10,
portée dans `CLAUDE.md` § Interface.

Sont clos et n'y figurent plus : les `<ToolButton>` (le type exige `tooltip`), les `<button>`
écrits à la main, et les appels à `<Button>`. Restent les rangées de menu.

## Rangées de menu (29)

`MenuRow` porte déjà une prop `tip` — le design system l'avait prévu — et un seul appelant
s'en sert (`Toolbar`, via `tipFor(orientation, 'flyout')`). Les autres ne passent rien.

**Le compte monte tout seul** : 27 au recensement du matin, 29 maintenant, sans qu'aucune
n'ait été traitée. Ce sont des menus ajoutés par d'autres branches fusionnées entre-temps —
la dérive est vivante, et c'est exactement ce que ce journal existe pour montrer.

| P | Fichier:ligne | Règle | Preuve |
|---|---|---|---|
| P0 | src/renderer/src/app/AccountSelect.tsx:70 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/app/AccountSelect.tsx:85 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/app/DocumentTabMenu.tsx:36 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/app/DocumentTabMenu.tsx:41 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/app/DocumentTabMenu.tsx:51 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/app/TitleBar.tsx:148 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/app/TitleBar.tsx:157 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/design/TextureField.tsx:67 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/design/TextureField.tsx:79 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/home/SectionMenu.tsx:52 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/home/SectionMenu.tsx:61 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/home/SectionMenu.tsx:72 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/home/SectionMenu.tsx:86 | P0-button-tooltip | prop `tip` non passée |
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

## Peau recopiée

| P | Fichier:ligne | Règle | Preuve |
|---|---|---|---|
| P1 | src/renderer/src/home/sections/Creations.tsx:110 | P1-local-skin | les trois lignes de `SHELF_OVERLAY` recopiées à la main, arrivées avec `feat/accueil` après l'extraction du 2026-08-10 |

## Ce qui reste à savoir

Les quatre fenêtres montent leur `TooltipHost`. Un `<Tooltip>` fermé ne rend rien du tout, donc
la seule preuve qu'un hôte est monté est un survol de bout en bout.

Les boutons à libellé visible se câblent par `HINT_*`, jamais par `TIP_*` : ce dernier pose un
`aria-label`, qui remplacerait le nom visible.

Trois descripteurs exigent désormais leur phrase en même temps que leur mot —
`EmptyStateAction`, la diapositive de `Spotlight`, et le `submitHint` de `DynamicForm`. Un
appelant qui oublie l'un des deux premiers ne compile pas.
