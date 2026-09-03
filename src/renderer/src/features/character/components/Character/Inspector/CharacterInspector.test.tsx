import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Rig } from '@shared/domain/rig'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import { withQueries } from '@/features/shell/components/query-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { characterOf, seedCharacter, useCharacters } from '@/stores/character'
import { clearCharacters } from '@/stores/character-fixtures'
import { characterViewOf, useCharacterView } from '@/stores/characterView'
import { CharacterInspector } from './CharacterInspector'

const ASSET = 'asset-hero'
const SAMPLE = {
  bounds: { min: { x: -0.3, y: 0, z: -0.2 }, max: { x: 0.3, y: 1.8, z: 0.2 } },
  points: new Float32Array(),
}

const RIG: Rig = {
  origin: 'imported',
  bones: [
    { name: 'Hips', parent: null, rest: IDENTITY_TRANSFORM, role: 'Hips' },
    { name: 'Spine', parent: 'Hips', rest: IDENTITY_TRANSFORM },
  ],
}

const show = (): void => {
  // What the engine measured, where the tab puts it: this panel is mounted by the DOCK, outside
  // the surface holding the engine.
  useCharacterView.getState().noteCharacterSample(ASSET, SAMPLE)
  render(withQueries(<CharacterInspector assetId={ASSET} />))
}

const held = () => characterOf(useCharacters.getState(), ASSET)

beforeEach(() => {
  clearCharacters()
  useCharacterView.setState({ views: {} })
  installFakeBridge({})
})

describe('what a character is made of', () => {
  it('offers to make a bare mesh animatable, and nothing to edit yet', () => {
    seedCharacter(ASSET, null, {})
    show()

    expect(screen.getByText(/pas encore animable/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Nom')).not.toBeInTheDocument()
  })

  it('says a character is ready, and offers its bones once one is picked', () => {
    seedCharacter(ASSET, RIG, {})
    show()
    expect(screen.queryByLabelText('Articulation')).not.toBeInTheDocument()

    useCharacterView.getState().pickBone(ASSET, 'Spine')
    show()

    expect(screen.getAllByLabelText('Articulation')[0]).toBeInTheDocument()
  })

  // A rig arrives with the names its file spells, and `mixamorigHips` is not one anybody chose.
  it('renames the picked bone, and the rest of the skeleton follows', async () => {
    seedCharacter(ASSET, RIG, {})
    useCharacterView.getState().pickBone(ASSET, 'Hips')
    show()

    // Opened by a double-click, as every other name of the studio is — see `AssetInspector`.
    // The name in the identity row, not the option of the role picker beside it.
    const [shown] = screen.getAllByText('Hips')
    await userEvent.dblClick(shown as HTMLElement)

    const field = screen.getByLabelText('Nom')
    await userEvent.clear(field)
    await userEvent.type(field, 'Bassin{Enter}')

    expect(held().rig?.bones.map(one => one.name)).toEqual(['Bassin', 'Spine'])
    expect(held().rig?.bones[1]?.parent).toBe('Bassin')
  })

  it('ties a bone to a joint of the standard, taking the role from whoever held it', async () => {
    seedCharacter(ASSET, RIG, {})
    useCharacterView.getState().pickBone(ASSET, 'Spine')
    show()

    await userEvent.selectOptions(screen.getByLabelText('Articulation'), 'Hips')

    expect(held().rig?.bones.find(one => one.name === 'Spine')?.role).toBe('Hips')
    expect(held().rig?.bones.find(one => one.name === 'Hips')?.role).toBeUndefined()
  })

  it('adds a handle the joint reaches for, and takes it back', async () => {
    seedCharacter(ASSET, RIG, {})
    useCharacterView.getState().pickBone(ASSET, 'Spine')
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une poignée à suivre' }))
    expect(held().rig?.ik).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Retirer la poignée' }))
    expect(held().rig?.ik).toEqual([])
  })

  it('says this character knows no motion yet', () => {
    seedCharacter(ASSET, RIG, {})
    show()

    expect(screen.getByText(/aucun mouvement/)).toBeInTheDocument()
  })

  // Asked for at the first sight of the panel: a joint could only be put right by eye, and there
  // was no way at all to hold one axis while another moved.
  it('gives a picked joint the fields a scene gives a node, padlock included', async () => {
    seedCharacter(ASSET, RIG, {})
    useCharacterView.getState().pickBone(ASSET, 'Spine')
    show()

    // Folded, the three axes share one line and there is no room for three padlocks — the same
    // rule a scene's transform section follows.
    const [unfold] = screen.getAllByRole('button', { expanded: false })
    await userEvent.click(unfold as HTMLElement)

    await userEvent.click(screen.getByRole('button', { name: 'Figer l’axe X' }))

    expect(characterViewOf(useCharacterView.getState(), ASSET).heldAxes).toEqual(['x'])
  })
})
