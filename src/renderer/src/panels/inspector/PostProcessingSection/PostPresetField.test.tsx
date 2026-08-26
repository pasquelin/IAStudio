import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_STACK, type PostStack } from '@shared/domain/postProcessing'
import { usePostPresets } from '@/stores/postPresets'
import { PostPresetField } from './PostPresetField'

const STACK: PostStack = {
  enabled: true,
  effects: [{ id: 'fx-1', effect: 'bloom', enabled: true, params: {} }],
}

const field = (stack: PostStack = STACK) => {
  cleanup()
  render(<PostPresetField title="Scène" stack={stack} onApply={vi.fn()} />)
}

const saved = () => usePostPresets.getState().saved

/** The menu row, then whatever it opened — the two gestures every case here starts with. */
const choose = async (name: RegExp | string) => {
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  await userEvent.click(screen.getByRole('menuitem', { name }))
}

describe('naming a preset', () => {
  beforeEach(() => {
    usePostPresets.setState({ saved: [] })
  })

  /**
   * § 8 asks for a preset one NAMES. Saved under the composition's own title, every preset a
   * scene ever saved was called "Scène" — a list of identical rows nobody can pick from.
   */
  it('saves under the name that was typed, not under the title of the composition', async () => {
    field()
    await choose('Enregistrer')
    await userEvent.type(screen.getByLabelText('Nom du préréglage'), 'Nuit froide{Enter}')

    expect(saved().map(preset => preset.name)).toEqual(['Nuit froide'])
    expect(saved()[0]?.stack.effects).toHaveLength(1)
  })

  // Leaving abandons: a half-typed name would otherwise become a preset nobody asked for.
  it('saves nothing when the field is left', async () => {
    field()
    await choose('Enregistrer')
    await userEvent.type(screen.getByLabelText('Nom du préréglage'), 'À moitié{Escape}')

    expect(saved()).toEqual([])
  })

  it('renames a preset without touching what it holds', async () => {
    usePostPresets.setState({ saved: [{ id: 'p1', name: 'Nuit', stack: STACK }] })
    field(EMPTY_STACK)

    await choose(/Renommer Nuit/)
    await userEvent.type(screen.getByLabelText('Nom du préréglage'), 'Nuit froide{Enter}')

    expect(saved()).toEqual([{ id: 'p1', name: 'Nuit froide', stack: STACK }])
  })

  it('offers the saved presets to pick from, under their own name', async () => {
    usePostPresets.setState({ saved: [{ id: 'p1', name: 'Nuit', stack: STACK }] })
    field()

    expect(screen.getByRole('option', { name: 'Nuit' })).toBeInTheDocument()
  })
})
