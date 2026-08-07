import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { useSettings } from '@/stores/settings'
import { useSettingsDraft } from '@/stores/settings-draft'
import { ShortcutsSettings } from './ShortcutsSettings'

const staged = () => useSettingsDraft.getState().pending.shortcuts?.overrides

/** The command button of a row, which is what shows the binding and starts a capture. */
const rowFor = (title: string): HTMLElement => screen.getByRole('button', { name: title })

function press(code: string, modifiers: Partial<KeyboardEventInit> = {}): void {
  fireEvent.keyDown(window, { code, ...modifiers })
}

beforeEach(() => {
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useSettingsDraft.setState({ pending: {}, touched: new Set() })
})

describe('showing the bindings', () => {
  it('shows the key each command answers to, as it is printed on the keyboard', () => {
    render(<ShortcutsSettings />)

    expect(rowFor('Déplacer')).toHaveTextContent('G')
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
    await userEvent.click(rowFor('Déplacer'))

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
    await userEvent.click(rowFor('Déplacer'))
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

    await userEvent.click(
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
    await userEvent.click(rowFor('Pivoter'))
    press('KeyG')

    // Both sides are flagged: neither is more wrong than the other.
    expect(screen.getAllByTitle(/se disputent cette touche/)).toHaveLength(2)
  })
})

describe('searching by chord', () => {
  it('answers what a combination is taken by, which is the question people ask', async () => {
    render(<ShortcutsSettings />)
    await userEvent.click(screen.getByRole('button', { name: 'Chercher par touche' }))

    press('KeyG')

    expect(rowFor('Déplacer')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pivoter' })).not.toBeInTheDocument()
  })

  it('says a key is free rather than showing an empty screen', async () => {
    render(<ShortcutsSettings />)
    await userEvent.click(screen.getByRole('button', { name: 'Chercher par touche' }))

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
    await userEvent.click(screen.getByRole('button', { name: 'Chercher par touche' }))
    await userEvent.click(rowFor('Déplacer'))

    press('KeyT')

    expect(staged()).toEqual({ 'scene.translate': 'KeyT' })
    // The query never took it, so every command is still listed.
    expect(rowFor('Pivoter')).toBeInTheDocument()
  })

  it('stops a capture when the search starts', async () => {
    render(<ShortcutsSettings />)
    await userEvent.click(rowFor('Déplacer'))
    await userEvent.click(screen.getByRole('button', { name: 'Chercher par touche' }))

    press('KeyG')

    expect(staged()).toBeUndefined()
    expect(rowFor('Déplacer')).toBeInTheDocument()
  })

  it('leaves the capture when the same row is clicked again', async () => {
    render(<ShortcutsSettings />)
    await userEvent.click(rowFor('Déplacer'))
    expect(rowFor('Déplacer')).toHaveTextContent('Appuyez…')

    await userEvent.click(rowFor('Déplacer'))

    expect(rowFor('Déplacer')).toHaveTextContent('G')
  })
})
