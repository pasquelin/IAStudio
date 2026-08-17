import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_ANIMATION } from '@shared/domain/scene'
import { SECOND } from '@shared/domain/time'
import { animationTrack, timelineWith } from '@/engines/scene/animation-fixtures'
import {
  addAnimationTrack,
  setAnimationKey,
  setTimelineSettings,
} from '@/engines/scene/animationCommands'
import { animationRows } from '@/engines/scene/animationRows'
import { meshNode, modelNodeFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { useAnimationViews } from '@/stores/animation-view'
import { installScene } from '@/stores/scene-fixtures'
import { sceneHistoryOf, sceneOf, useScenes } from '@/stores/scenes'
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
    nodes: [],
    expanded: new Set(),
    clips: [{ nodeId: 'perso', name: 'Walk', start: 1 * SECOND, duration: 2 * SECOND }],
  })

const keyRows = () =>
  animationRows(timelineWith([animationTrack('a', 'position', [key(1)])]), {
    nodes: [{ id: 'cube', name: 'Circle' }],
    expanded: new Set(),
  })

describe('dragging a clip block', () => {
  beforeEach(() => {
    installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [modelWithClip()] })
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({
      views: {
        [DOCUMENT]: { viewport: VIEWPORT, expanded: [], selected: [], autoKey: false, order: [] },
      },
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
    const before = sceneHistoryOf(useScenes.getState(), DOCUMENT).past.length

    press(canvas(), 'pointerdown', 150, 30)
    for (const x of [200, 250, 300, 350, 400]) press(canvas(), 'pointermove', x, 30)
    press(canvas(), 'pointerup', 400, 30)

    expect(sceneHistoryOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before + 1)
  })

  it('opens a second entry for a second drag, rather than swallowing it into the first', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={blockRows()} />)
    const before = sceneHistoryOf(useScenes.getState(), DOCUMENT).past.length

    press(canvas(), 'pointerdown', 150, 30)
    press(canvas(), 'pointermove', 300, 30)
    press(canvas(), 'pointerup', 300, 30)

    press(canvas(), 'pointerdown', 300, 30)
    press(canvas(), 'pointermove', 500, 30)
    press(canvas(), 'pointerup', 500, 30)

    expect(sceneHistoryOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before + 2)
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
      views: {
        [DOCUMENT]: { viewport: VIEWPORT, expanded: [], selected: [], autoKey: false, order: [] },
      },
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

describe('following a duration that changes', () => {
  beforeEach(() => {
    installScene(DOCUMENT, EMPTY_SCENE)
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({
      views: {
        [DOCUMENT]: { viewport: VIEWPORT, expanded: [], selected: [], autoKey: false, order: [] },
      },
    })
  })

  const playhead = () => useSceneViews.getState().views[DOCUMENT]?.playhead

  const lengthen = (seconds: number): void => {
    const store = useScenes.getState()
    store.runCommand(DOCUMENT, setTimelineSettings({ duration: seconds * SECOND }))
  }

  it('holds the head inside the band it had at the start', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={keyRows()} />)

    press(canvas(), 'pointerdown', 900, 4)
    expect(playhead()).toBe(5 * SECOND)
  })

  it('lets the head go further once the band is made longer', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={keyRows()} />)

    act(() => lengthen(20))
    press(canvas(), 'pointerdown', 900, 4)

    // Nine hundred pixels is nine seconds, which a twenty-second band holds.
    expect(playhead()).toBe(9 * SECOND)
  })

  it('pulls the head back in when the band is made shorter', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={keyRows()} />)
    act(() => lengthen(20))
    press(canvas(), 'pointerdown', 900, 4)

    act(() => lengthen(3))
    press(canvas(), 'pointerdown', 900, 4)

    expect(playhead()).toBe(3 * SECOND)
  })
})

describe('removing a picked key with the keyboard', () => {
  beforeEach(() => {
    installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [meshNode('cube')] })
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({
      views: {
        [DOCUMENT]: { viewport: VIEWPORT, expanded: [], selected: [], autoKey: false, order: [] },
      },
    })
  })

  /** One channel holding two keys, at one and two seconds. */
  function keyedRows() {
    const state = useScenes.getState()
    const opened = addAnimationTrack({ nodeId: 'cube', property: 'position' }, 'Cube', 't1')
    act(() => state.runCommand(DOCUMENT, opened))
    act(() => state.runCommand(DOCUMENT, setAnimationKey('t1', 1 * SECOND, { x: 1, y: 0, z: 0 })))
    act(() => state.runCommand(DOCUMENT, setAnimationKey('t1', 2 * SECOND, { x: 2, y: 0, z: 0 })))

    return animationRows(sceneOf(useScenes.getState(), DOCUMENT).animation, {
      nodes: [{ id: 'cube', name: 'Cube' }],
      expanded: new Set(),
    })
  }

  const keys = () => sceneOf(useScenes.getState(), DOCUMENT).animation.tracks[0]?.keys ?? []

  const press = (element: Element, key: string): void => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  }

  it('removes the key that was picked, and only it', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={keyedRows()} />)
    act(() => useAnimationViews.getState().setSelected(DOCUMENT, ['cube@1000000']))

    act(() => press(canvas(), 'Delete'))

    expect(keys().map(key => key.time)).toEqual([2 * SECOND])
  })

  it('answers Backspace too, which is what a Mac keyboard offers', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={keyedRows()} />)
    act(() => useAnimationViews.getState().setSelected(DOCUMENT, ['cube@2000000']))

    act(() => press(canvas(), 'Backspace'))

    expect(keys().map(key => key.time)).toEqual([1 * SECOND])
  })

  it('lets the selection go once the key it named is gone', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={keyedRows()} />)
    act(() => useAnimationViews.getState().setSelected(DOCUMENT, ['cube@1000000']))

    act(() => press(canvas(), 'Delete'))

    expect(useAnimationViews.getState().views[DOCUMENT]?.selected).toEqual([])
  })

  it('does nothing at all when no key is picked', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={keyedRows()} />)

    act(() => press(canvas(), 'Delete'))

    expect(keys()).toHaveLength(2)
  })
})
