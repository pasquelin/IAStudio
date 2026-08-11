import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_ANIMATION } from '@shared/domain/scene'
import { SECOND } from '@shared/domain/time'
import { animationTrack, timelineWith } from '@/engines/scene/animation-fixtures'
import { animationRows } from '@/engines/scene/animation-rows'
import { modelNodeFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/scene-state'
import { useAnimationViews } from '@/stores/animation-view'
import { installScene } from '@/stores/scene-fixtures'
import { historyOf, sceneOf, useScenes } from '@/stores/scenes'
import { useSceneViews } from '@/stores/scene-views'
import { AnimationCanvas } from './AnimationCanvas'

const DOCUMENT = 'doc-1'

/** One pixel per 10 ms, so a second is a hundred pixels across. */
const VIEWPORT = { scale: 100 / SECOND, offset: 0, scrollTop: 0 }

const key = (seconds: number) => ({ time: seconds * SECOND, value: { x: 0, y: 0, z: 0 } })

const canvas = () => screen.getByTestId('animation-canvas')

/**
 * A pointer event on the canvas. jsdom lays nothing out, so the bounding box is all zeros and a
 * client coordinate IS the canvas coordinate — which is what makes the arithmetic readable here.
 */
function press(element: Element, type: string, x: number, y: number): void {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  element.dispatchEvent(event)
}

const modelWithClip = () => {
  const node = modelNodeFixture('perso')
  return {
    ...node,
    model: { ...node.model, animation: { ...DEFAULT_ANIMATION, clip: 'Walk', start: 1 * SECOND } },
  }
}

const blockRows = () =>
  animationRows(timelineWith([]), {
    nameOf: () => 'Perso',
    expanded: new Set(),
    clips: [{ nodeId: 'perso', name: 'Walk', start: 1 * SECOND, duration: 2 * SECOND }],
  })

const keyRows = () =>
  animationRows(timelineWith([animationTrack('a', 'position', [key(1)])]), {
    nameOf: () => 'Circle',
    expanded: new Set(),
  })

describe('dragging a clip block', () => {
  beforeEach(() => {
    installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [modelWithClip()] })
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({
      views: { [DOCUMENT]: { viewport: VIEWPORT, expanded: [], selected: [], autoKey: false } },
    })
  })

  const startOf = (): number => {
    const node = sceneOf(useScenes.getState(), DOCUMENT).nodes[0]
    return node?.type === 'model' ? (node.model.animation?.start ?? -1) : -1
  }

  it('slides the block, keeping where inside it the pointer took hold', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={blockRows()} />)

    // Grabbed half a second into a block that starts at one second, dropped at three.
    press(canvas(), 'pointerdown', 150, 30)
    press(canvas(), 'pointermove', 300, 30)

    expect(startOf()).toBe(2.5 * SECOND)
  })

  it('costs ONE undo entry however many pixels the drag crossed', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={blockRows()} />)
    const before = historyOf(useScenes.getState(), DOCUMENT).past.length

    press(canvas(), 'pointerdown', 150, 30)
    for (const x of [200, 250, 300, 350, 400]) press(canvas(), 'pointermove', x, 30)
    press(canvas(), 'pointerup', 400, 30)

    expect(historyOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before + 1)
  })

  it('opens a second entry for a second drag, rather than swallowing it into the first', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={blockRows()} />)
    const before = historyOf(useScenes.getState(), DOCUMENT).past.length

    press(canvas(), 'pointerdown', 150, 30)
    press(canvas(), 'pointermove', 300, 30)
    press(canvas(), 'pointerup', 300, 30)

    press(canvas(), 'pointerdown', 300, 30)
    press(canvas(), 'pointermove', 500, 30)
    press(canvas(), 'pointerup', 500, 30)

    expect(historyOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before + 2)
  })

  it('never slides a block before the start of the band', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={blockRows()} />)

    press(canvas(), 'pointerdown', 150, 30)
    press(canvas(), 'pointermove', -900, 30)

    expect(startOf()).toBe(0)
  })
})

describe('scrubbing and picking on the band', () => {
  beforeEach(() => {
    installScene(DOCUMENT, EMPTY_SCENE)
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({
      views: { [DOCUMENT]: { viewport: VIEWPORT, expanded: [], selected: [], autoKey: false } },
    })
  })

  const playhead = () => useSceneViews.getState().views[DOCUMENT]?.playhead

  it('moves the head when the ruler is pressed — the gesture nothing offered before', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={keyRows()} />)

    press(canvas(), 'pointerdown', 300, 4)

    expect(playhead()).toBe(3 * SECOND)
  })

  it('keeps following the pointer while it is held down', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={keyRows()} />)

    press(canvas(), 'pointerdown', 100, 4)
    press(canvas(), 'pointermove', 400, 4)

    expect(playhead()).toBe(4 * SECOND)
  })

  it('holds the head inside the band rather than running past its end', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={keyRows()} />)

    // The band lasts five seconds; nine hundred pixels is nine.
    press(canvas(), 'pointerdown', 900, 4)

    expect(playhead()).toBe(5 * SECOND)
  })

  it('picks the key under the pointer', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={keyRows()} />)

    press(canvas(), 'pointerdown', 100, 48)

    expect(useAnimationViews.getState().views[DOCUMENT]?.selected).toEqual(['cube@1000000'])
  })

  it('lets go of the selection on a press that lands on nothing', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={keyRows()} />)
    press(canvas(), 'pointerdown', 100, 48)

    press(canvas(), 'pointerdown', 100, 4_000)

    expect(useAnimationViews.getState().views[DOCUMENT]?.selected).toEqual([])
  })
})
