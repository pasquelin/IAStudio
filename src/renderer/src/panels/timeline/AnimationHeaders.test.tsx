import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { animationRows } from '@/engines/scene/animation-rows'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/scene-state'
import { addAnimationTrack } from '@/engines/scene/animation-commands'
import { animationViewOf, useAnimationViews } from '@/stores/animation-view'
import { installScene } from '@/stores/scene-fixtures'
import { sceneHistoryOf, sceneOf, useScenes, writeAnimationTrack } from '@/stores/scenes'
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
    nodes: [{ id: 'cube-1', name: 'Cube' }],
    expanded: new Set(expanded),
  })

const headers = (expanded: string[] = []) => {
  cleanup()
  return render(<AnimationHeaders documentId={DOCUMENT} rows={rowsOf(expanded)} />)
}

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
    const before = sceneHistoryOf(useScenes.getState(), DOCUMENT).past.length

    await userEvent.click(subject().getByRole('button', { name: /Rendre muette/ }))

    expect(sceneHistoryOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before)
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

  it('shows the object even before it holds a single channel', () => {
    installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [meshNode('cube-1')] })
    headers()

    expect(screen.getByTestId('anim-subject-cube-1')).toHaveTextContent('Cube')
    expect(screen.queryByTestId('anim-channel-t1')).not.toBeInTheDocument()
  })
})

describe('taking a key back off', () => {
  beforeEach(() => {
    withTwoChannels()
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({ views: {} })
  })

  const keyed = async (): Promise<void> => {
    await userEvent.click(subject().getByRole('button', { name: /Poser une clé sur/ }))
  }

  it('offers to remove where a key stands, having offered to pose where none did', async () => {
    headers()
    expect(subject().queryByRole('button', { name: /Retirer la clé/ })).not.toBeInTheDocument()

    await keyed()
    headers()

    expect(subject().getByRole('button', { name: /Retirer la clé/ })).toBeInTheDocument()
  })

  it('takes the key off every channel it was posed on', async () => {
    headers()
    await keyed()
    expect(tracks().every(track => track.keys.length === 1)).toBe(true)

    headers()
    await userEvent.click(subject().getByRole('button', { name: /Retirer la clé/ }))

    expect(tracks().every(track => track.keys.length === 0)).toBe(true)
  })

  it('costs ONE undo, like posing it did', async () => {
    headers()
    await keyed()
    const before = sceneHistoryOf(useScenes.getState(), DOCUMENT).past.length

    headers()
    await userEvent.click(subject().getByRole('button', { name: /Retirer la clé/ }))

    expect(sceneHistoryOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before + 1)
  })

  it('leaves a key standing elsewhere alone', async () => {
    useSceneViews.getState().setPlayhead(DOCUMENT, 0)
    headers()
    await keyed()

    useSceneViews.getState().setPlayhead(DOCUMENT, 2 * SECOND)
    headers()
    await userEvent.click(subject().getByRole('button', { name: /Poser une clé sur/ }))

    // Two keys now; removing the one at two seconds must not touch the one at zero.
    headers()
    await userEvent.click(subject().getByRole('button', { name: /Retirer la clé/ }))

    expect(tracks()[0]?.keys.map(key => key.time)).toEqual([0])
  })
})

describe('arranging the lines', () => {
  const TWO = [
    { id: 'cube-1', name: 'Cube' },
    { id: 'cube-2', name: 'Sphere' },
  ]

  beforeEach(() => {
    installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [meshNode('cube-1'), meshNode('cube-2')] })
    useAnimationViews.setState({ views: {} })

    render(
      <AnimationHeaders
        documentId={DOCUMENT}
        rows={animationRows(timelineOf(), { nodes: TWO, expanded: new Set() })}
      />,
    )
  })

  const grip = (name: string) => screen.getByRole('button', { name: new RegExp(name) })
  const orderOf = () => animationViewOf(useAnimationViews.getState(), DOCUMENT).order

  it('records the whole arrangement, not the line that moved, so nothing falls behind it', async () => {
    grip('déplacer la ligne Sphere').focus()
    await userEvent.keyboard('{ArrowUp}')

    expect(orderOf()).toEqual(['cube-2', 'cube-1'])
  })

  it('leaves the scene exactly as it was: the arrangement belongs to the sheet alone', async () => {
    grip('déplacer la ligne Sphere').focus()
    await userEvent.keyboard('{ArrowUp}')

    expect(sceneOf(useScenes.getState(), DOCUMENT).nodes.map(node => node.id)).toEqual([
      'cube-1',
      'cube-2',
    ])
    expect(sceneHistoryOf(useScenes.getState(), DOCUMENT).past).toHaveLength(0)
  })
})
