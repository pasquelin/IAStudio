import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
  type NativeImage,
  type WebContents,
} from 'electron'
import { MENU_ICON_SCALE } from '@shared/domain/context-menu'
import { TRANSLATIONS } from '@shared/i18n'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { windowLanguage } from './language'
import { parseContextMenuItems } from './validation'

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

/**
 * A glyph the window drew, filed at the density it drew it for.
 *
 * `createFromDataURL` files a bitmap as the 1× representation, which would draw a 32 px icon at
 * twice the size of a menu row; `addRepresentation` is what says "this is the @2x one". Marked
 * as a template image, which macOS reads as "recolour this to match the menu" — ignored on the
 * other platforms, where the window has already drawn it in the colour of the resolved theme.
 */
function glyph(dataURL: string): NativeImage {
  const image = nativeImage.createEmpty()
  image.addRepresentation({ scaleFactor: MENU_ICON_SCALE, dataURL })
  image.setTemplateImage(true)
  return image
}

/**
 * The menus the windows raise on their own surfaces — a row of the explorer, an asset, a tab.
 *
 * The window composes the rows and this pops them: the labels arrive translated and `enabled`
 * arrives decided, because the state they describe (what document is open, whether a transfer
 * is running) lives in exactly one place and it is not this one. What this side owns is the
 * part a drawn surface cannot have — the system's own menu, at the pointer, free of the window.
 *
 * **Answers the id of the row chosen, or `null`.** The choice comes back through `click` rather
 * than through `popup`'s own callback, and the two are ordered the wrong way round on macOS:
 * the menu closes BEFORE it sends the item's action, so a callback that resolved on the spot
 * would report a dismissal for every row anyone actually picked. One turn of the event loop is
 * what separates the two, and what makes a real dismissal answer `null`.
 */
export function registerContextMenu(): void {
  handle(CHANNELS.menuPopup, (event, items) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null

    let chosen: string | null = null
    const template: MenuItemConstructorOptions[] = parseContextMenuItems(items).map(item => ({
      label: item.label,
      enabled: item.enabled ?? true,
      ...(item.icon ? { icon: glyph(item.icon) } : {}),
      // macOS shows it on hover; Windows and Linux drop it without a word. Sent regardless —
      // what a row does is written once, wherever the platform can say it.
      ...(item.tooltip ? { toolTip: item.tooltip } : {}),
      click: () => {
        chosen = item.id
      },
    }))

    return new Promise<string | null>(resolve => {
      Menu.buildFromTemplate(template).popup({
        window,
        callback: () => setImmediate(() => resolve(chosen)),
      })
    })
  })
}
