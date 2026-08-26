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

const field = (stack: PostStack = STACK, onApply = vi.fn()) => {
  cleanup()
  render(<PostPresetField title="Scène" stack={stack} onApply={onApply} />)
  return onApply
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

/**
 * A preset is a GESTURE and never a value: it builds a stack, and from then on the stack is what
 * the panel shows. The row that came back to "None" after a pick read as a pick that had failed —
 * and left open whether the effects already there had been kept.
 */
describe('what the preset row says it does', () => {
  beforeEach(() => {
    usePostPresets.setState({ saved: [] })
  })

  // And "None" could not have served: a SHIPPED preset already answers to that name — the one
  // that empties the stack — so the resting row and a real choice read exactly alike.
  it('rests on the gesture rather than on a state', () => {
    field()
    expect(screen.getByRole('combobox')).toHaveDisplayValue('Remplacer la composition…')
    expect(screen.getAllByRole('option', { name: 'Aucun' })).toHaveLength(1)
  })

  /**
   * And it truly replaces. Appending instead would double what the shipped presets share —
   * `colorGrading` is in 11 of the 12, `smaa` in 10 — which is two gradings and a wasted pass.
   */
  it('hands back the preset alone, never the two stacks joined', async () => {
    const onApply = field(STACK)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'game')

    const applied = onApply.mock.calls[0]?.[0] as PostStack
    expect(applied.effects.map(one => one.effect)).toEqual([
      'bloom',
      'colorGrading',
      'vignette',
      'fxaa',
    ])
  })
})
