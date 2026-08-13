import type { MenuItemConstructorOptions } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRANSLATIONS } from '@shared/i18n'
import { setWindowLanguage } from './language'
import { registerFieldMenu } from './context-menu'

/**
 * Electron in a bottle for this file alone, rather than the shared `ipc/test-harness`: what is
 * doubled here — a web contents that reports a right-click, a menu that pops up — is of no use to
 * the sixteen suites that harness serves, and teaching it about the spellchecker would put a
 * special case under all of them.
 *
 * `vi.hoisted` because `vi.mock` factories run above the imports: a plain const would still be in
 * its temporal dead zone when the factory is called.
 */
const electron = vi.hoisted(() => {
  const created: ((event: unknown, window: unknown) => void)[] = []
  const popped: { items: MenuItemConstructorOptions[]; window: unknown }[] = []

  return {
    created,
    popped,
    app: {
      on: (event: string, listener: (event: unknown, window: unknown) => void) => {
        if (event === 'browser-window-created') created.push(listener)
      },
    },
    Menu: {
      buildFromTemplate: (items: MenuItemConstructorOptions[]) => ({
        popup: (options: { window: unknown }) =>
          void popped.push({ items, window: options.window }),
      }),
    },
  }
})

vi.mock('electron', () => ({ app: electron.app, Menu: electron.Menu }))

/** A caret in a text field, with a misspelled word under the pointer. */
const inField = {
  isEditable: true,
  misspelledWord: 'coleur',
  dictionarySuggestions: ['couleur', 'chaleur'],
  editFlags: { canCut: true, canCopy: true, canPaste: true, canSelectAll: true },
}

type RightClick = Partial<Omit<typeof inField, 'editFlags'>> & {
  editFlags?: Partial<typeof inField.editFlags>
}

/** A window as Electron announces it, with what a case reads of what the menu did to it. */
function openWindow() {
  const corrected: string[] = []
  const learned: string[] = []
  let raise: ((event: unknown, params: unknown) => void) | null = null

  const window = {
    webContents: {
      on: (event: string, listener: (event: unknown, params: unknown) => void) => {
        if (event === 'context-menu') raise = listener
      },
      replaceMisspelling: (word: string) => void corrected.push(word),
      session: { addWordToSpellCheckerDictionary: (word: string) => void learned.push(word) },
    },
  }

  for (const announce of electron.created) announce({}, window)

  return {
    window,
    corrected,
    learned,
    rightClick: (params: RightClick = {}) =>
      raise?.(
        {},
        { ...inField, ...params, editFlags: { ...inField.editFlags, ...params.editFlags } },
      ),
  }
}

/** The menu the last right-click raised, or nothing at all if it raised none. */
function lastMenu(): MenuItemConstructorOptions[] {
  const menu = electron.popped.at(-1)
  if (!menu) throw new Error('no menu was popped up')
  return menu.items
}

const labels = (): (string | undefined)[] => lastMenu().map(item => item.label)

function choose(label: string | undefined): void {
  const click: unknown = lastMenu().find(item => item.label === label)?.click
  if (typeof click !== 'function') throw new Error(`the menu has no ${label} row`)
  click()
}

beforeEach(() => {
  electron.created.length = 0
  electron.popped.length = 0
  setWindowLanguage('fr')
  registerFieldMenu()
})

describe('the menu a right-click raises', () => {
  it('offers the clipboard in the language of the studio', () => {
    const field = openWindow()

    field.rightClick({ misspelledWord: '' })
    const french = labels()
    setWindowLanguage('en')
    field.rightClick({ misspelledWord: '' })

    expect(french).toEqual([
      TRANSLATIONS.fr.menu.cut,
      TRANSLATIONS.fr.menu.copy,
      TRANSLATIONS.fr.menu.paste,
      TRANSLATIONS.fr.menu.selectAll,
    ])
    expect(labels()).toEqual([
      TRANSLATIONS.en.menu.cut,
      TRANSLATIONS.en.menu.copy,
      TRANSLATIONS.en.menu.paste,
      TRANSLATIONS.en.menu.selectAll,
    ])
  })

  /**
   * The whole reason a native menu exists here: everywhere else the studio draws its own in the
   * renderer, and a second one for a single press is what this would otherwise be.
   */
  it('raises nothing outside a field one can type in', () => {
    const field = openWindow()

    field.rightClick({ isEditable: false })

    expect(electron.popped).toEqual([])
  })

  it('disables what the caret cannot do', () => {
    const field = openWindow()

    field.rightClick({ misspelledWord: '', editFlags: { canCut: false, canCopy: false } })

    expect(lastMenu().map(item => item.enabled)).toEqual([false, false, true, true])
  })

  it('corrects a misspelled word to the suggestion that was chosen', () => {
    const field = openWindow()

    field.rightClick()
    choose('chaleur')

    expect(field.corrected).toEqual(['chaleur'])
  })

  // Chromium answers with no suggestion at all for a word it cannot guess at, and this row is
  // then the only thing the menu has to say about it.
  it('learns a word Chromium had no suggestion for', () => {
    const field = openWindow()

    field.rightClick({ dictionarySuggestions: [] })

    expect(labels()[0]).toBe(TRANSLATIONS.fr.menu.addToDictionary)
    choose(TRANSLATIONS.fr.menu.addToDictionary)
    expect(field.learned).toEqual(['coleur'])
  })

  // Wired per window: the menu belongs to the one that was clicked in, not to whichever was
  // focused when it opened.
  it('pops up over the window the click came from', () => {
    openWindow()
    const second = openWindow()

    second.rightClick()

    expect(electron.popped).toHaveLength(1)
    expect(electron.popped[0]?.window).toBe(second.window)
  })
})
