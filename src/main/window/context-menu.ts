import {
  app,
  Menu,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
  type WebContents,
} from 'electron'
import { TRANSLATIONS } from '@shared/i18n'
import { windowLanguage } from './language'

/**
 * The rows a right-click offers inside a text field.
 *
 * Disabled rather than dropped, as `AssetMenu` explains: a menu whose length changes with the
 * selection is one nobody can learn. `registerAccelerator: false` for the reason the Edit menu
 * already gives — reserving ⌘X would take the key from the very field this was raised in.
 */
function fieldMenu(params: ContextMenuParams, contents: WebContents): MenuItemConstructorOptions[] {
  const t = TRANSLATIONS[windowLanguage()].menu
  const { editFlags, misspelledWord } = params

  const spelling: MenuItemConstructorOptions[] = misspelledWord
    ? [
        // Chromium answers with none of its own for a word it cannot guess at, and the row below
        // is then the only thing the menu has to say about it.
        ...params.dictionarySuggestions.map(word => ({
          label: word,
          click: () => contents.replaceMisspelling(word),
        })),
        {
          label: t.addToDictionary,
          click: () => void contents.session.addWordToSpellCheckerDictionary(misspelledWord),
        },
        { type: 'separator' },
      ]
    : []

  const clipboard = (
    role: 'cut' | 'copy' | 'paste' | 'selectAll',
    enabled: boolean,
  ): MenuItemConstructorOptions => ({ role, label: t[role], enabled, registerAccelerator: false })

  return [
    ...spelling,
    clipboard('cut', editFlags.canCut),
    clipboard('copy', editFlags.canCopy),
    clipboard('paste', editFlags.canPaste),
    clipboard('selectAll', editFlags.canSelectAll),
  ]
}

/**
 * The clipboard and spelling menu of every text field in the studio.
 *
 * Electron ships no context menu at all — a right-click shows nothing anywhere unless one is
 * popped up from here — and the spellchecker is on, which had the studio underlining misspellings
 * it offered no way to correct.
 *
 * **Nothing outside an editable node.** Every other surface draws its own in the renderer
 * (`design/ContextMenu`), and a native menu beside it would be a second one for a single press.
 *
 * Beside `lockNavigation` and called from the same place, before any window exists: registered
 * from the menu layer instead, it would reach only the windows opened after the IPC handlers —
 * and whether that covers everything is a fact about another file that nothing here could hold.
 *
 * The language is read at the click: the menu is built afresh every time, so it follows a change
 * without being told of one.
 */
export function registerFieldMenu(): void {
  app.on('browser-window-created', (_event, window) => {
    const contents = window.webContents

    contents.on('context-menu', (_contextEvent, params) => {
      if (!params.isEditable) return
      Menu.buildFromTemplate(fieldMenu(params, contents)).popup({ window })
    })
  })
}
