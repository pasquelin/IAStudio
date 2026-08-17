import { action, type AssistantAction } from './assistantAction'
import { SETTINGS_SECTION_IDS } from './settings'

/**
 * What surrounds the documents — the window, the account, the updates, and the three small lists
 * the studio keeps outside every project.
 *
 * None of these edits a document, and none of them can be undone by ⌘Z, which is why they carry no
 * history and why `commitment` stays `none` all the same: pinning a recipe or opening a window
 * takes nothing away from anyone.
 *
 * The four commands a client still cannot reach are `app.settings`, `app.assistant`, `app.dictate`
 * and `window.fullScreen` — `runGlobalCommand` answers `false` for all four. Two of them are
 * ANSWERED here by the capability rather than by the command, since that is what a program wants:
 * `settings.open` and `window.fullScreen`. The other two are not, and deliberately — an outside
 * client has no use for opening the assistant it is replacing, nor for dictating.
 */

export const SHELL_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'auth.state',
    titleKey: 'assistant.actions.authState.title',
    descriptionKey: 'assistant.actions.authState.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'window.state',
    titleKey: 'assistant.actions.windowState.title',
    descriptionKey: 'assistant.actions.windowState.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'window.fullScreen',
    titleKey: 'assistant.actions.windowFullScreen.title',
    descriptionKey: 'assistant.actions.windowFullScreen.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'settings.open',
    titleKey: 'assistant.actions.settingsOpen.title',
    descriptionKey: 'assistant.actions.settingsOpen.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'section',
        kind: 'choice',
        labelKey: 'assistant.fields.settingsSection',
        required: true,
        options: SETTINGS_SECTION_IDS,
      },
    ],
  }),
  action({
    name: 'updates.state',
    titleKey: 'assistant.actions.updatesState.title',
    descriptionKey: 'assistant.actions.updatesState.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'media.capabilities',
    titleKey: 'assistant.actions.mediaCapabilities.title',
    descriptionKey: 'assistant.actions.mediaCapabilities.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    /**
     * The path-taking half of `media.ingest`, whose own channel raises the native picker no client
     * can fill. Adds a row, takes nothing away — hence `none`, like a new folder.
     */
    name: 'media.adopt',
    titleKey: 'assistant.actions.mediaAdopt.title',
    descriptionKey: 'assistant.actions.mediaAdopt.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [{ key: 'path', kind: 'text', labelKey: 'assistant.fields.filePath', required: true }],
  }),
  action({
    name: 'fonts.list',
    titleKey: 'assistant.actions.fontsList.title',
    descriptionKey: 'assistant.actions.fontsList.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'favorites.list',
    titleKey: 'assistant.actions.favoritesList.title',
    descriptionKey: 'assistant.actions.favoritesList.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'favorite.pin',
    titleKey: 'assistant.actions.favoritePin.title',
    descriptionKey: 'assistant.actions.favoritePin.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'assetId', kind: 'text', labelKey: 'assistant.fields.assetId', required: true },
    ],
  }),
  action({
    name: 'favorite.unpin',
    titleKey: 'assistant.actions.favoriteUnpin.title',
    descriptionKey: 'assistant.actions.favoriteUnpin.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'favoriteId', kind: 'text', labelKey: 'assistant.fields.favoriteId', required: true },
    ],
  }),
  action({
    name: 'fileInfo.open',
    titleKey: 'assistant.actions.fileInfoOpen.title',
    descriptionKey: 'assistant.actions.fileInfoOpen.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [{ key: 'path', kind: 'text', labelKey: 'assistant.fields.filePath', required: true }],
  }),
  action({
    name: 'mirror.open',
    titleKey: 'assistant.actions.mirrorOpen.title',
    descriptionKey: 'assistant.actions.mirrorOpen.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
]
