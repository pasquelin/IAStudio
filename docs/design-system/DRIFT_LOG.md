# DRIFT_LOG

`P0-button-tooltip` — tout bouton porte une infobulle qui explique son action. Quand le
libellé est déjà à l'écran, l'infobulle explique au lieu de le répéter (`HINT_*`) ; sinon elle
donne aussi le nom accessible (`TIP_*`). Source : décision de l'utilisateur du 2026-08-10,
portée dans `CLAUDE.md` § Interface.

**Le recensement des itérations 4 à 9 était incomplet.** Il ne comptait que les `<button>`
bruts et les `<ToolButton>` : les appels à `<Button>` et à `<MenuRow>`, qui rendent eux aussi un
bouton, n'y figuraient pas. Trente-sept sites manquaient. Le tableau ci-dessous les inclut, et
c'est pourquoi le compte remonte alors qu'aucun bouton n'a été ajouté au logiciel.

Les `<ToolButton>` n'y figurent pas : le type l'exige, la régression est impossible.

## `<button>` bruts sans infobulle (0)

Aucun. Tous les `<button>` écrits à la main portent leur infobulle.

## Appels à `<Button>` (10)

`Button` répand ses props sur son `<button>`, donc `{...HINT_*}` y passe sans rien changer au
composant. Deux d'entre eux tiennent leur libellé d'un appelant (`EmptyState`) : la phrase doit
venir du même endroit que le mot, donc du descripteur d'action.

| P | Fichier:ligne | Règle | Preuve |
|---|---|---|---|
| P0 | src/renderer/src/design/DynamicForm.tsx:256 | P0-button-tooltip | aucune infobulle au site d'appel |
| P0 | src/renderer/src/design/EmptyState.tsx:34 | P0-button-tooltip | aucune infobulle au site d'appel |
| P0 | src/renderer/src/design/EmptyState.tsx:35 | P0-button-tooltip | aucune infobulle au site d'appel |
| P0 | src/renderer/src/design/PromptAssistant.tsx:176 | P0-button-tooltip | aucune infobulle au site d'appel |
| P0 | src/renderer/src/design/PromptAssistant.tsx:178 | P0-button-tooltip | aucune infobulle au site d'appel |
| P0 | src/renderer/src/home/HomeView.tsx:67 | P0-button-tooltip | aucune infobulle au site d'appel |
| P0 | src/renderer/src/home/RefusedSection.tsx:32 | P0-button-tooltip | aucune infobulle au site d'appel |
| P0 | src/renderer/src/home/sections/Spark.tsx:58 | P0-button-tooltip | aucune infobulle au site d'appel |
| P0 | src/renderer/src/home/sections/Spotlight.tsx:206 | P0-button-tooltip | aucune infobulle au site d'appel |
| P0 | src/renderer/src/panels/inspector/TextureInspector.tsx:326 | P0-button-tooltip | aucune infobulle au site d'appel |

## Rangées de menu (27)

`MenuRow` porte déjà une prop `tip` — le design system l'avait prévu — et un seul appelant
s'en sert (`Toolbar`, via `tipFor(orientation, 'flyout')`). Les autres ne passent rien.

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
| P0 | src/renderer/src/design/Toolbar.tsx:234 | P0-button-tooltip | prop `tip` non passée |
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
| P0 | src/renderer/src/panels/layers/LayerRow.tsx:117 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/layers/LayerStackActions.tsx:127 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/layers/LayerStackActions.tsx:150 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/shared/NodeActions.tsx:48 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/styles/StyleMenu.tsx:26 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/panels/styles/StyleMenu.tsx:34 | P0-button-tooltip | prop `tip` non passée |
| P0 | src/renderer/src/spaces/graph/GraphMenu.tsx:50 | P0-button-tooltip | prop `tip` non passée |

## Peau recopiée

| P | Fichier:ligne | Règle | Preuve |
|---|---|---|---|
| P1 | src/renderer/src/home/sections/Creations.tsx:110 | P1-local-skin | les trois lignes de `SHELF_OVERLAY` recopiées à la main, arrivées avec `feat/accueil` après l'extraction du 2026-08-10 |

## Ce qui reste à savoir

Les quatre fenêtres montent leur `TooltipHost` : la principale depuis toujours, les
Préférences, l'Usage et les Licences depuis le 2026-08-10. Plus rien n'est bloqué.

Un `<Tooltip>` fermé **ne rend rien du tout** — vérifié. Le seul test qui prouve qu'un hôte
est monté est donc un survol de bout en bout.

Les boutons à libellé visible se câblent par `HINT_*`, jamais par `TIP_*` : ce dernier pose un
`aria-label`, qui remplacerait le nom visible.
