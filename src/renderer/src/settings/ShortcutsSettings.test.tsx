import { fireEvent, render, screen } from '@testing-library/react'
import userEvent, { PointerEventsCheckLevel, type UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { useSettings } from '@/stores/settings'
import { useSettingsDraft } from '@/stores/settings-draft'
import { ShortcutsSettings } from './ShortcutsSettings'

const staged = () => useSettingsDraft.getState().pending.shortcuts?.overrides

/**
 * The command button of a row, which is what shows the binding and starts a capture. Found by
 * its label rather than by role: the panel renders 115 buttons, and `getByRole` with a name
 * re-derives the accessible name of every one of them after each re-render — 293 ms a call
 * against 7 ms here, for the same element. One test below still asserts the role, so the
 * accessible shape stays covered.
 */
const rowFor = (title: string): HTMLElement => screen.getByLabelText(title)

/**
 * The button that arms the chord search. Its own text is its accessible name — and the only
 * element carrying it, unlike the command titles, which a `getByText` would find on their
 * label `span` rather than on their button.
 */
const searchButton = (): HTMLElement => screen.getByText('Chercher par touche')

function press(code: string, modifiers: Partial<KeyboardEventInit> = {}): void {
  fireEvent.keyDown(window, { code, ...modifiers })
}

let user: UserEvent

beforeEach(() => {
  // A session rather than the direct API, whose defaults are paid on every interaction: a
  // delay between events, and a pointer-events check walking the ancestors of every target.
  // The latter is inert here anyway — the renderer tests load no stylesheet, so nothing can
  // be covered (`vitest.config.ts` limits `css.include` to `index.css?raw`).
  user = userEvent.setup({ delay: null, pointerEventsCheck: PointerEventsCheckLevel.Never })
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useSettingsDraft.setState({ pending: {}, touched: new Set() })
})

describe('showing the bindings', () => {
  it('shows the key each command answers to, as it is printed on the keyboard', () => {
    render(<ShortcutsSettings />)

    // The one place the role is asserted, so that `rowFor` may use the cheaper query everywhere
    // else without the panel losing its accessible shape.
    expect(screen.getByRole('button', { name: 'Déplacer' })).toHaveTextContent('G')
  })

  it('says so when a command is bound to nothing, rather than showing a blank', () => {
    render(<ShortcutsSettings />)

    expect(rowFor('Réinitialiser la disposition')).toHaveTextContent('Aucune')
  })

  // Grouped by scope because that IS the rule: the same key on two surfaces is the design.
  it('groups commands by the surface that listens to them', () => {
    render(<ShortcutsSettings />)

    expect(screen.getByText('Dans la vue 3D')).toBeInTheDocument()
    expect(screen.getByText('Dans le montage')).toBeInTheDocument()
  })
})

describe('capturing a new binding', () => {
  it('records the combination that was pressed', async () => {
    render(<ShortcutsSettings />)
    await user.click(rowFor('Déplacer'))

    press('KeyT', { metaKey: true })

    expect(staged()).toEqual({ 'scene.translate': 'Meta+KeyT' })
  })

  // Nobody knows what `Meta+BracketLeft` is called; everybody can press it.
  it('ignores a modifier pressed on its own, which is not a shortcut', () => {
    render(<ShortcutsSettings />)
    fireEvent.click(rowFor('Déplacer'))

    press('ShiftLeft', { shiftKey: true })

    expect(staged()).toBeUndefined()
    expect(rowFor('Déplacer')).toHaveTextContent('Appuyez…')
  })

  it('leaves the capture on Escape, binding nothing — a capture with no way out is a trap', () => {
    render(<ShortcutsSettings />)
    fireEvent.click(rowFor('Déplacer'))

    press('Escape')

    expect(staged()).toBeUndefined()
    expect(rowFor('Déplacer')).toHaveTextContent('G')
  })

  it('stages the remap rather than writing it, so Cancel can take it back', async () => {
    render(<ShortcutsSettings />)
    await user.click(rowFor('Déplacer'))
    press('KeyT')

    // Written nowhere yet: the buffer is what Apply flushes.
    expect(useSettings.getState().settings.shortcuts.overrides).toEqual({})
    expect(staged()).toEqual({ 'scene.translate': 'KeyT' })
  })

  it('drops the remap rather than freezing the current default', async () => {
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        shortcuts: { overrides: { 'scene.translate': 'KeyT' } },
      },
    })
    render(<ShortcutsSettings />)

    await user.click(
      screen.getByRole('button', { name: /Restaurer la valeur par défaut — Déplacer/ }),
    )

    // Removed, not set back to `KeyG`: a future version changing that default reaches this
    // user too, which pinning the value would prevent.
    expect(staged()).toEqual({})
  })
})

describe('conflicts', () => {
  it('says nothing while two surfaces merely share a key, which is the design', () => {
    render(<ShortcutsSettings />)

    expect(screen.queryByTitle(/se disputent cette touche/)).not.toBeInTheDocument()
  })

  it('flags two commands of one surface fighting over the same key', async () => {
    render(<ShortcutsSettings />)
    await user.click(rowFor('Pivoter'))
    press('KeyG')

    // Both sides are flagged: neither is more wrong than the other.
    expect(screen.getAllByTitle(/se disputent cette touche/)).toHaveLength(2)
  })
})

describe('searching by chord', () => {
  it('answers what a combination is taken by, which is the question people ask', async () => {
    render(<ShortcutsSettings />)
    await user.click(searchButton())

    press('KeyG')

    expect(rowFor('Déplacer')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pivoter' })).not.toBeInTheDocument()
  })

  it('says a key is free rather than showing an empty screen', async () => {
    render(<ShortcutsSettings />)

    // `SearchByChord` is not a `CommandRow`: the role asserted above says nothing about it, and
    // a click would work just as well on a `div`. `toHaveRole` costs 3 ms where a named
    // `getByRole` costs 370.
    expect(searchButton()).toHaveRole('button')
    await user.click(searchButton())

    press('KeyJ', { metaKey: true, altKey: true })

    expect(screen.getByText(/elle est libre/)).toBeInTheDocument()
  })
})

describe('only one thing listens at a time', () => {
  /*
   * The row and the search box each held their own listening state, so starting a search and
   * then clicking a row left both live: one keypress was recorded as a binding AND used as a
   * query.
   */
  it('stops the search when a row starts capturing', async () => {
    render(<ShortcutsSettings />)
    await user.click(searchButton())
    await user.click(rowFor('Déplacer'))

    press('KeyT')

    expect(staged()).toEqual({ 'scene.translate': 'KeyT' })
    // The query never took it, so every command is still listed.
    expect(rowFor('Pivoter')).toBeInTheDocument()
  })

  it('stops a capture when the search starts', async () => {
    render(<ShortcutsSettings />)
    await user.click(rowFor('Déplacer'))
    await user.click(searchButton())

    press('KeyG')

    expect(staged()).toBeUndefined()
    expect(rowFor('Déplacer')).toBeInTheDocument()
  })

  it('leaves the capture when the same row is clicked again', async () => {
    render(<ShortcutsSettings />)
    await user.click(rowFor('Déplacer'))
    expect(rowFor('Déplacer')).toHaveTextContent('Appuyez…')

    await user.click(rowFor('Déplacer'))

    expect(rowFor('Déplacer')).toHaveTextContent('G')
  })
})
