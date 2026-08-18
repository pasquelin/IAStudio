import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { clipLane, embeddedClip, type ClipRef } from '@shared/domain/scene'
import { SECOND } from '@shared/domain/time'
import { animationTrack, timelineWith } from '@/engines/scene/animation-fixtures'
import {
  addAnimationTrack,
  setAnimationKey,
  setTimelineSettings,
} from '@/engines/scene/animationCommands'
import { animationRows, CHANNEL_HEIGHT, SUBJECT_HEIGHT } from '@/engines/scene/animationRows'
import { RULER_HEIGHT } from '@/engines/timeline/timelineGeometry'
import { meshNode, modelNodeFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { animationViewOf, useAnimationViews } from '@/stores/animationView'
import { useModelClips } from '@/stores/modelClips'
import { installScene } from '@/stores/scene-fixtures'
import { sceneHistoryOf, sceneOf, useScenes } from '@/stores/scenes'
import { useSceneViews } from '@/stores/sceneViews'
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
function press(element: Element, type: string, x: number, y: number, buttons = 1): void {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, buttons })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  element.dispatchEvent(event)
}

const walkBlock: ClipRef = embeddedClip('c1', 'Walk', { start: 1 * SECOND })

const modelWithClip = () => {
  const node = modelNodeFixture('perso')
  return { ...node, model: { ...node.model, lanes: [clipLane('main', [walkBlock])] } }
}

const blockRows = () =>
  animationRows(timelineWith([]), {
    nodes: [{ id: 'perso', name: 'Perso' }],
    expanded: new Set(['perso']),
    lanes: [
      {
        nodeId: 'perso',
        laneId: 'main',
        name: 'Animation 1',
        blocks: [{ clipId: 'c1', name: 'Walk', start: 1 * SECOND, duration: 2 * SECOND }],
      },
    ],
  })

/** The vertical middle of the lane row, which sits under the object's own line. */
const LANE_Y = RULER_HEIGHT + SUBJECT_HEIGHT + CHANNEL_HEIGHT / 2

const keyRows = () =>
  animationRows(timelineWith([animationTrack('a', 'position', [key(1)])]), {
    nodes: [{ id: 'cube', name: 'Circle' }],
    expanded: new Set(),
  })

describe('dragging a clip block', () => {
  beforeEach(() => {
    installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [modelWithClip()] })
    // How long the clip runs in the file, which only the engine knows and a trim is measured
    // against: without it a block has no width and every trim is refused.
    useModelClips.getState().report(DOCUMENT, 'perso', ['Walk'], { Walk: 2 })
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({
      views: {
        [DOCUMENT]: {
          viewport: VIEWPORT,
          expanded: [],
          selected: [],
          pickedBlock: null,
          autoKey: false,
          order: [],
        },
      },
    })
  })

  const blockOf = (): ClipRef | null => {
    const node = sceneOf(useScenes.getState(), DOCUMENT).nodes[0]
    return node?.type === 'model' ? (node.model.lanes?.[0]?.clips[0] ?? null) : null
  }

  const startOf = (): number => blockOf()?.start ?? -1

  it('slides the block, keeping where inside it the pointer took hold', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={blockRows()} />)

    // Grabbed half a second into a block that starts at one second, dropped at three.
    press(canvas(), 'pointerdown', 150, LANE_Y)
    press(canvas(), 'pointermove', 300, LANE_Y)

    expect(startOf()).toBe(2.5 * SECOND)
  })

  it('costs ONE undo entry however many pixels the drag crossed', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={blockRows()} />)
    const before = sceneHistoryOf(useScenes.getState(), DOCUMENT).past.length

    press(canvas(), 'pointerdown', 150, LANE_Y)
    for (const x of [200, 250, 300, 350, 400]) press(canvas(), 'pointermove', x, LANE_Y)
    press(canvas(), 'pointerup', 400, LANE_Y)

    expect(sceneHistoryOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before + 1)
  })

  it('opens a second entry for a second drag, rather than swallowing it into the first', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={blockRows()} />)
    const before = sceneHistoryOf(useScenes.getState(), DOCUMENT).past.length

    press(canvas(), 'pointerdown', 150, LANE_Y)
    press(canvas(), 'pointermove', 300, LANE_Y)
    press(canvas(), 'pointerup', 300, LANE_Y)

    press(canvas(), 'pointerdown', 300, LANE_Y)
    press(canvas(), 'pointermove', 500, LANE_Y)
    press(canvas(), 'pointerup', 500, LANE_Y)

    expect(sceneHistoryOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before + 2)
  })

  it('shows the block one presses as the chosen one, and drops the picked keys', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={blockRows()} />)
    useAnimationViews.getState().setSelected(DOCUMENT, ['a@0'])

    press(canvas(), 'pointerdown', 150, LANE_Y)

    const view = animationViewOf(useAnimationViews.getState(), DOCUMENT)
    expect(view.pickedBlock).toBe('c1')
    expect(view.selected).toEqual([])
  })

  // Dragged past the end, a block would sit where the head never goes: the head is clamped to the
  // duration, so its last frames could show a pose nothing can reach.
  it('never slides a block past the end of the band', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={blockRows()} />)

    press(canvas(), 'pointerdown', 150, LANE_Y)
    press(canvas(), 'pointermove', 9000, LANE_Y)

    expect(startOf()).toBeLessThanOrEqual(5 * SECOND)
  })

  it('never slides a block before the start of the band', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={blockRows()} />)

    press(canvas(), 'pointerdown', 150, LANE_Y)
    press(canvas(), 'pointermove', -900, LANE_Y)

    expect(startOf()).toBe(0)
  })

  // Pressed at the block's own end rather than in its body: this is the gesture that read as a
  // move that did not work, because nothing said the pointer was over a trim zone.
  it('lengthens the block by its end rather than sliding it', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={blockRows()} />)

    press(canvas(), 'pointerdown', 299, LANE_Y)
    press(canvas(), 'pointermove', 400, LANE_Y)

    expect(startOf()).toBe(1 * SECOND)
    expect(blockOf()?.duration).toBe(3 * SECOND)
  })

  // A pointerup lost off the window used to leave the gesture open, and the next edit of the same
  // node coalesced into it: one ⌘Z undid two drags.
  it('closes the gesture on a move with no button held', () => {
    render(<AnimationCanvas documentId={DOCUMENT} rows={blockRows()} />)
    const before = sceneHistoryOf(useScenes.getState(), DOCUMENT).past.length

    press(canvas(), 'pointerdown', 150, LANE_Y)
    press(canvas(), 'pointermove', 300, LANE_Y)
    press(canvas(), 'pointermove', 300, LANE_Y, 0)

    press(canvas(), 'pointerdown', 300, LANE_Y)
    press(canvas(), 'pointermove', 500, LANE_Y)
    press(canvas(), 'pointerup', 500, LANE_Y)

    expect(sceneHistoryOf(useScenes.getState(), DOCUMENT).past).toHaveLength(before + 2)
  })
})

describe('scrubbing and picking on the band', () => {
  beforeEach(() => {
    installScene(DOCUMENT, EMPTY_SCENE)
    useSceneViews.setState({ views: {} })
    useAnimationViews.setState({
      views: {
        [DOCUMENT]: {
          viewport: VIEWPORT,
          expanded: [],
          selected: [],
          pickedBlock: null,
          autoKey: false,
          order: [],
        },
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
        [DOCUMENT]: {
          viewport: VIEWPORT,
          expanded: [],
          selected: [],
          pickedBlock: null,
          autoKey: false,
          order: [],
        },
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
        [DOCUMENT]: {
          viewport: VIEWPORT,
          expanded: [],
          selected: [],
          pickedBlock: null,
          autoKey: false,
          order: [],
        },
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
