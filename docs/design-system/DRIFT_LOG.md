# DRIFT_LOG

`P0-button-tooltip` — tout bouton porte une infobulle qui explique son action. Quand le
libellé est déjà à l'écran, l'infobulle explique au lieu de le répéter (champ `description`).
Source : décision de l'utilisateur du 2026-08-10, portée dans `CLAUDE.md` § Interface.

Les `<ToolButton>` n'y figurent plus : le type l'exige désormais, la régression est
impossible.

## Boutons à icône seule — l'action est indevinable au survol

| P | Fichier:ligne | Règle | Preuve |
|---|---|---|---|
| P0 | src/renderer/src/app/AccountSelect.tsx:40 | P0-button-tooltip | `aria-label`, aucun `data-tooltip-id` |
| P0 | src/renderer/src/app/ActivityStatus.tsx:30 | P0-button-tooltip | `aria-label`, aucun `data-tooltip-id` |
| P0 | src/renderer/src/app/JobsStatus.tsx:49 | P0-button-tooltip | `aria-label`, aucun `data-tooltip-id` |
| P0 | src/renderer/src/design/Carousel.tsx:205 | P0-button-tooltip | point de page, `aria-label` seul |
| P0 | src/renderer/src/design/Carousel.tsx:244 | P0-button-tooltip | flèche de rail, `aria-label` seul |
| P0 | src/renderer/src/home/ShelfCard.tsx:104 | P0-button-tooltip | `aria-label`, aucun `data-tooltip-id` |
| P0 | src/renderer/src/home/sections/Creations.tsx:107 | P0-button-tooltip | `aria-label`, aucun `data-tooltip-id` |
| P0 | src/renderer/src/home/sections/Favorites.tsx:71 | P0-button-tooltip | `aria-label`, aucun `data-tooltip-id` |
| P0 | src/renderer/src/home/sections/Spark.tsx:84 | P0-button-tooltip | `aria-label`, aucun `data-tooltip-id` |
| P0 | src/renderer/src/panels/channels/ChannelTile.tsx:103 | P0-button-tooltip | `aria-label`, aucun `data-tooltip-id` |
| P0 | src/renderer/src/settings/SettingRow.tsx:349 | P0-button-tooltip | fenêtre Préférences — et son arbre ne monte aucun `TooltipHost` |
| P0 | src/renderer/src/settings/ShortcutsSettings.tsx:113 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/ShortcutsSettings.tsx:128 | P0-button-tooltip | idem |

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
| P0 | src/renderer/src/home/ShelfCard.tsx:58 | P0-button-tooltip | vignette cliquable, aucune description |
| P0 | src/renderer/src/home/sections/ByMode.tsx:52 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/home/sections/Explore.tsx:89 | P0-button-tooltip | onglet, aucune description |
| P0 | src/renderer/src/home/sections/Projects.tsx:65 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/home/sections/Tools.tsx:93 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/licences/LicencesWindow.tsx:33 | P0-button-tooltip | fenêtre Licences — aucun `TooltipHost` dans son arbre |
| P0 | src/renderer/src/panels/inspector/TextureInspector.tsx:215 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/panels/inspector/TextureInspector.tsx:238 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/panels/view/View.tsx:54 | P0-button-tooltip | libellé visible, aucune description |
| P0 | src/renderer/src/settings/AccountSettings.tsx:107 | P0-button-tooltip | fenêtre Préférences — aucun `TooltipHost` |
| P0 | src/renderer/src/settings/AccountSettings.tsx:114 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/AccountSettings.tsx:140 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/AccountSettings.tsx:148 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/AccountSettings.tsx:155 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/AccountSettings.tsx:242 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/SettingActions.tsx:31 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/SettingRow.tsx:131 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/SettingsWindow.tsx:47 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/SettingsWindow.tsx:110 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/SettingsWindow.tsx:147 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/SettingsWindow.tsx:314 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/SettingsWindow.tsx:317 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/SettingsWindow.tsx:320 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/ShortcutsSettings.tsx:275 | P0-button-tooltip | idem |
| P0 | src/renderer/src/settings/ShortcutsSettings.tsx:284 | P0-button-tooltip | idem |
| P0 | src/renderer/src/usage/UsageJournal.tsx:60 | P0-button-tooltip | fenêtre Usage — aucun `TooltipHost` dans son arbre |
| P0 | src/renderer/src/usage/UsageWindow.tsx:66 | P0-button-tooltip | idem |
| P0 | src/renderer/src/usage/UsageWindow.tsx:87 | P0-button-tooltip | idem |
| P0 | src/renderer/src/usage/UsageWindow.tsx:99 | P0-button-tooltip | idem |
| P0 | src/renderer/src/usage/UsageWindow.tsx:139 | P0-button-tooltip | idem |

## Ce qui bloque une partie du lot

Les fenêtres **Préférences**, **Usage** et **Licences** rendent leur propre arbre React et
**ne montent aucun `TooltipHost`** — il n'est monté que dans `app/Shell.tsx`. Vingt-trois des
lignes ci-dessus y vivent : leur poser des attributs d'infobulle avant de monter l'hôte
écrirait du texte que personne ne verrait jamais. C'est le prochain lot.

`design/Button.tsx` n'accepte aujourd'hui aucune infobulle : le composant des boutons à
libellé des docks doit d'abord en porter une, comme `ToolButton`.
