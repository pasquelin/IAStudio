import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { animationRows } from '@/engines/scene/animation-rows'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/scene-state'
import { addAnimationTrack } from '@/engines/scene/animation-commands'
import { useAnimationViews } from '@/stores/animation-view'
import { installScene } from '@/stores/scene-fixtures'
import { historyOf, sceneOf, useScenes, writeAnimationTrack } from '@/stores/scenes'
import { useSceneViews } from '@/stores/scene-views'
import { AnimationHeaders } from './AnimationHeaders'

const DOCUMENT = 'doc-1'

const timelineOf = () => sceneOf(useScenes.getState(), DOCUMENT).animation
const tracks = () => timelineOf().tracks

/** A cube with a position and a scale channel, which is what the panel adds. */
function withTwoChannels(): void {
  const base = { ...EMPTY_SCENE, nodes: [meshNode('cube-1')] }
  const one = addAnimationTrack({ nodeId: 'cube-1', property: 'position' }, 'Cube · Position', 't1')
  const two = addAnimationTrack({ nodeId: 'cube-1', property: 'scale' }, 'Cube · Scale', 't2')
  installScene(DOCUMENT, two.apply(one.apply(base)))
}

const rowsOf = (expanded: string[] = []) =>
  animationRows(timelineOf(), {
    nameOf: () => 'Cube',
    expanded: new Set(expanded),
  })

const headers = (expanded: string[] = []) =>
  render(<AnimationHeaders documentId={DOCUMENT} rows={rowsOf(expanded)} />)

const subject = () => within(screen.getByTestId('anim-subject-cube-1'))

describe('the column beside the band', () => {
  beforeEach(() => {
    withTwoChannels()
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({ views: {} })
  })

  it('shows the name of what it drives — the whole point of the column', () => {
    headers()
    expect(screen.getByTestId('anim-subject-cube-1')).toHaveTextContent('Cube')
  })

  it('names each channel once the subject is unfolded', () => {
    headers(['cube-1'])

    expect(screen.getByTestId('anim-channel-t1')).toHaveTextContent('Cube · Position')
    expect(screen.getByTestId('anim-channel-t2')).toHaveTextContent('Cube · Scale')
  })

  it('mutes every channel of a subject together, so a half-muted object cannot happen', async () => {
    headers()
    await userEvent.click(subject().getByRole('button', { name: /Rendre muette/ }))

    expect(tracks().map(track => track.muted)).toEqual([true, true])
  })

  it('turns a MIXED subject fully on rather than flipping each channel its own way', async () => {
    // One of the two already muted: pressing the subject switch must not leave them opposed.
    writeAnimationTrack(DOCUMENT, 't1', track => ({ ...track, muted: true }))
    headers()

    await userEvent.click(subject().getByRole('button', { name: /Rendre muette/ }))

    expect(tracks().map(track => track.muted)).toEqual([true, true])
  })

  it('keeps a switch off the undo stack: it is how one works, not what one made', async () => {
    headers()
    const before = historyOf(useScenes.getState(), DOCUMENT).past.length

    await userEvent.click(subject().getByRole('button', { name: /Rendre muette/ }))

    expect(historyOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before)
  })

  it('keys the subject at the head, on every one of its channels', async () => {
    useSceneViews.getState().setPlayhead(DOCUMENT, 2 * SECOND)
    headers()

    await userEvent.click(subject().getByRole('button', { name: /Poser une clé sur Cube/ }))

    expect(tracks()[0]?.keys).toHaveLength(1)
    expect(tracks()[1]?.keys[0]?.time).toBe(2 * SECOND)
  })

  it('removes one channel and leaves the other, from the channel row', async () => {
    headers(['cube-1'])

    const row = within(screen.getByTestId('anim-channel-t1'))
    await userEvent.click(row.getByRole('button', { name: /Supprimer la piste/ }))

    expect(tracks().map(track => track.id)).toEqual(['t2'])
  })

  it('shows nothing at all for a scene with no track', () => {
    installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [meshNode('cube-1')] })
    const { container } = headers()

    expect(container.querySelectorAll('[data-testid^="anim-"]')).toHaveLength(0)
  })
})
