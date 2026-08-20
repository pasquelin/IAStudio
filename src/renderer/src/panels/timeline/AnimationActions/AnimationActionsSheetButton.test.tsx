import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { installScene } from '@/stores/scene-fixtures'
import { sceneHistoryOf, sceneOf, useScenes } from '@/stores/scenes'
import { AnimationActionsSheetButton } from './AnimationActionsSheetButton'

const DOCUMENT = 'doc-1'

const sheet = () => sceneOf(useScenes.getState(), DOCUMENT).animation.sheet

const withScene = (selectedIds: string[], band: string[] = []) => {
  installScene(DOCUMENT, {
    ...EMPTY_SCENE,
    nodes: [meshNode('house'), meshNode('walker')],
    selectedIds,
    animation: { ...EMPTY_SCENE.animation, sheet: band },
  })
}

const button = () => screen.getByRole('button', { name: /Ajouter à la bande/ })

/*
 * The door into animating anything: a band that shows only what somebody put there needs a way
 * to put something there, or nothing can ever be keyed. It reads the SELECTION rather than
 * offering a list — a map of 8 000 objects is not one anybody scrolls through.
 */
describe('putting the selection on the band', () => {
  beforeEach(() => {
    withScene(['walker'])
    render(<AnimationActionsSheetButton documentId={DOCUMENT} />)
  })

  it('puts what is selected on the band', async () => {
    await userEvent.click(button())

    expect(sheet()).toEqual(['walker'])
  })

  it('costs one undo, and gives the band back as it was', async () => {
    await userEvent.click(button())
    const { past } = sceneHistoryOf(useScenes.getState(), DOCUMENT)
    expect(past).toHaveLength(1)

    useScenes.getState().undo(DOCUMENT)

    expect(sheet()).toEqual([])
  })
})

describe('what the button refuses', () => {
  it('is off when nothing is selected — there is nothing to put anywhere', () => {
    withScene([])
    render(<AnimationActionsSheetButton documentId={DOCUMENT} />)

    expect(button()).toBeDisabled()
  })

  it('is off when the selection is already on the band', () => {
    withScene(['walker'], ['walker'])
    render(<AnimationActionsSheetButton documentId={DOCUMENT} />)

    expect(button()).toBeDisabled()
  })
})
