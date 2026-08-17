import { act, fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { addClip } from '@/engines/timeline/commands'
import {
  RULER_HEIGHT,
  timeToX,
  tracksHeight,
  xToTime,
  type Viewport,
} from '@/engines/timeline/timelineGeometry'
import { clipFixture } from '@/engines/timeline/timeline-fixtures'
import type { Clip } from '@/engines/timeline/timelineState'
import { EMPTY_SEQUENCE, EMPTY_SOUND_SEQUENCE, snapToFrame } from '@/engines/timeline/timelineState'
import { startAssetDrag } from '@/helpers/assetDrag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { fakeMenu } from '@/helpers/menu-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssets } from '@/stores/assets'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { useTimelineView, viewportOf } from '@/stores/timelineView'
import { TIMELESS_DURATION } from '@/engines/timeline/insert'
import { TimelineCanvas } from './TimelineCanvas'
import type { VideoToolId } from './videoTools'

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'rush.mp4',
  type: 'video',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

const clip = clipFixture('clip-1', 0, 1_000_000, { assetId: 'asset-1' })

function dataTransfer(assetId: string): DataTransfer {
  const transfer = dragTransfer()
  if (assetId) startAssetDrag({ dataTransfer: transfer }, { id: assetId, type: 'video' })
  return transfer
}

function paint(tool: VideoToolId = 'select') {
  const view = render(<TimelineCanvas documentId="doc-1" tool={tool} />)
  const canvas = view.container.querySelector('canvas')
  if (!canvas) throw new Error('the timeline renders no canvas')
  return canvas
}

const clipsOf = (): Clip[] => sequenceOf(useSequences.getState(), 'doc-1').tracks[0]?.clips ?? []

const viewOf = (): Viewport => viewportOf(useTimelineView.getState(), 'doc-1')

/**
 * A canvas that can paint, which is the only condition under which the strip ever learns its
 * own width — `test-setup` sizes every element but hands back a null 2D context, so `paint`
 * returns before measuring anything.
 *
 * Every drawing call is a no-op: nothing is asserted on what was drawn, only on what the
 * component did with the width it read back.
 */
function laidOut(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const context = new Proxy({} as CanvasRenderingContext2D, {
    get: () => () => undefined,
    set: () => true,
  })
  // One `as`, and the reason is the signature rather than the value: `getContext` is overloaded,
  // and a spy takes its LAST overload — the WebGPU one — so a 2D context reads as the wrong type.
  vi.spyOn(canvas, 'getContext').mockReturnValue(context as unknown as GPUCanvasContext)
  return canvas
}

/**
 * Moves the playhead the way the transport does: a replace, outside the history. Inside `act`,
 * since nothing about it comes from an event — the effects it wakes must have run when it
 * hands back.
 */
function movePlayhead(playhead: number): void {
  act(() => {
    const store = useSequences.getState()
    store.replace('doc-1', { ...sequenceOf(store, 'doc-1'), playhead })
  })
}

let menu = fakeMenu()

describe('TimelineCanvas', () => {
  beforeEach(() => {
    useTimelineView.setState({ viewports: {} })
    useAssets.setState({ items: [asset()] })
    menu = fakeMenu()
    installFakeBridge({ menu: menu.bridge })
  })

  it('turns a dropped asset into a clip on the track it landed on', async () => {
    fireEvent.drop(paint(), {
      clientX: 200,
      clientY: RULER_HEIGHT + 10,
      dataTransfer: dataTransfer('asset-1'),
    })

    // Settled first: a drop resolves through `droppedAsset`, which fetches a library asset
    // before handing it over — so the clip is added a microtask after the gesture.
    await Promise.resolve()

    expect(clipsOf()).toHaveLength(1)
    expect(clipsOf()[0]).toMatchObject({ assetId: 'asset-1', start: 2_000_000 })
  })

  it('gives a clip the probed duration of its asset', async () => {
    useAssets.setState({ items: [asset({ probe: { duration: 8_000_000, codec: 'avc1' } })] })

    fireEvent.drop(paint(), {
      clientX: 0,
      clientY: RULER_HEIGHT + 10,
      dataTransfer: dataTransfer('asset-1'),
    })

    // Settled first: a drop resolves through `droppedAsset`, which fetches a library asset
    // before handing it over — so the clip is added a microtask after the gesture.
    await Promise.resolve()

    expect(clipsOf()[0]?.duration).toBe(8_000_000)
  })

  it('falls back to a default length for an asset that has not been probed yet', async () => {
    fireEvent.drop(paint(), {
      clientX: 0,
      clientY: RULER_HEIGHT + 10,
      dataTransfer: dataTransfer('asset-1'),
    })

    // Settled first: a drop resolves through `droppedAsset`, which fetches a library asset
    // before handing it over — so the clip is added a microtask after the gesture.
    await Promise.resolve()

    expect(clipsOf()[0]?.duration).toBe(TIMELESS_DURATION)
  })

  it('refuses a drop on the ruler, which holds no track', () => {
    fireEvent.drop(paint(), { clientX: 200, clientY: 4, dataTransfer: dataTransfer('asset-1') })
    expect(clipsOf()).toHaveLength(0)
  })

  /** Well below the last row of a montage that opens on two, whatever their height. */
  const BELOW_THE_TRACKS = RULER_HEIGHT + tracksHeight(EMPTY_SEQUENCE) + 20

  it('opens the rows a drop below the last track needs, rather than refusing it', async () => {
    useAssets.setState({
      items: [asset({ probe: { duration: 5_000_000, codec: 'avc1', channels: 2 } })],
    })

    fireEvent.drop(paint(), {
      clientX: 200,
      clientY: BELOW_THE_TRACKS,
      dataTransfer: dataTransfer('asset-1'),
    })

    // Settled first: a drop resolves through `droppedAsset`, which fetches a library asset
    // before handing it over — so the clip is added a microtask after the gesture.
    await Promise.resolve()

    const { tracks } = sequenceOf(useSequences.getState(), 'doc-1')
    expect(tracks.map(track => track.id)).toEqual(['V1', 'A1', 'V2', 'A2'])
    expect(tracks[2]?.clips[0]).toMatchObject({ assetId: 'asset-1', start: 2_000_000 })
    expect(tracks[3]?.clips).toHaveLength(1)
  })

  // Left to bubble rather than swallowed, so the shell still answers it by opening the asset:
  // the Audio workspace has no monitor to paint a rush on, and opens no picture row for one.
  it('leaves a rush dropped below a sound montage to the shell', () => {
    act(() => {
      useSequences.getState().replace('doc-1', EMPTY_SOUND_SEQUENCE)
    })

    const shell = vi.fn()
    document.body.addEventListener('drop', shell)
    fireEvent.drop(paint(), {
      clientX: 200,
      // Its own rows, which outnumber a sequence's: the empty space starts lower here.
      clientY: RULER_HEIGHT + tracksHeight(EMPTY_SOUND_SEQUENCE) + 20,
      dataTransfer: dataTransfer('asset-1'),
    })
    document.body.removeEventListener('drop', shell)

    expect(shell).toHaveBeenCalled()
    expect(sequenceOf(useSequences.getState(), 'doc-1').tracks).toHaveLength(4)
  })

  // The one half `AssetDropTarget` shares with it: a surface that prevents every dragover
  // swallows the files dragged in from the desktop, and the drop then does nothing.
  it('leaves a file dragged in from the desktop alone', () => {
    const transfer = dragTransfer()
    transfer.setData('text/plain', 'anything')

    expect(fireEvent.dragOver(paint(), { dataTransfer: transfer })).toBe(true)
  })

  it('lets a drag of ours land', () => {
    expect(fireEvent.dragOver(paint(), { dataTransfer: dataTransfer('asset-1') })).toBe(false)
  })

  it('ignores a drag that carries something other than an asset', () => {
    fireEvent.drop(paint(), {
      clientX: 200,
      clientY: RULER_HEIGHT + 10,
      dataTransfer: dataTransfer(''),
    })

    expect(clipsOf()).toHaveLength(0)
  })

  it('deletes the selected clip on Delete', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))

    fireEvent.keyDown(paint(), { code: 'Delete' })

    expect(clipsOf()).toHaveLength(0)
  })

  it('leaves the sequence alone on Delete with nothing selected', () => {
    useSequences.setState({
      states: {
        'doc-1': { ...EMPTY_SEQUENCE, tracks: [{ ...EMPTY_SEQUENCE.tracks[0]!, clips: [clip] }] },
      },
    })

    fireEvent.keyDown(paint(), { code: 'Delete' })

    expect(clipsOf()).toHaveLength(1)
  })

  it('splits a clip under the blade', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))

    fireEvent.pointerDown(paint('blade'), { clientX: 40, clientY: RULER_HEIGHT + 10 })

    expect(clipsOf()).toHaveLength(2)
  })

  /**
   * WHERE it cuts, which the count above cannot tell apart: the blade cuts under the pointer and
   * the `S` shortcut cuts at the playhead — two gestures, and the bar used to describe the wrong
   * one. The playhead is parked elsewhere, so a cut that drifted to it would show; and the click
   * lands off a frame boundary, so the expectation has to run the real sum rather than agree with
   * it by accident.
   */
  it('splits under the pointer, not at the playhead the shortcut uses', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    useSequences.getState().replace('doc-1', {
      ...sequenceOf(useSequences.getState(), 'doc-1'),
      playhead: 800_000,
    })

    fireEvent.pointerDown(paint('blade'), { clientX: 41, clientY: RULER_HEIGHT + 10 })

    const { settings } = sequenceOf(useSequences.getState(), 'doc-1')
    const [first] = clipsOf()
    expect(first?.duration).toBe(snapToFrame(xToTime(41, viewOf()), settings) - clip.start)
  })

  it('moves the playhead when the ruler is pressed', () => {
    fireEvent.pointerDown(paint(), { clientX: 300, clientY: 4 })
    expect(sequenceOf(useSequences.getState(), 'doc-1').playhead).toBe(3_000_000)
  })

  it('splits whatever the playhead crosses, without asking for a selection first', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    useSequences.getState().replace('doc-1', {
      ...sequenceOf(useSequences.getState(), 'doc-1'),
      selectedId: null,
      playhead: 400_000,
    })

    fireEvent.keyDown(paint(), { code: 'KeyS' })

    expect(clipsOf()).toHaveLength(2)
  })

  it('zooms in and out around the middle of the strip', () => {
    const canvas = paint()
    const before = viewOf().scale

    fireEvent.keyDown(canvas, { code: 'Equal', metaKey: true })
    expect(viewOf().scale).toBeGreaterThan(before)

    fireEvent.keyDown(canvas, { code: 'Minus', metaKey: true })
    expect(viewOf().scale).toBeCloseTo(before)
  })

  it('sends the playhead to the start and to the end of the montage', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    const canvas = paint()

    fireEvent.keyDown(canvas, { code: 'End' })
    expect(sequenceOf(useSequences.getState(), 'doc-1').playhead).toBe(1_000_000)

    fireEvent.keyDown(canvas, { code: 'Home' })
    expect(sequenceOf(useSequences.getState(), 'doc-1').playhead).toBe(0)
  })

  /**
   * The playhead moves on its own while the transport runs, and nothing was following it: a
   * montage longer than the strip ran off the right edge within seconds, and what stayed on
   * screen was a still picture of a moment nobody was watching any more.
   */
  it('scrolls the strip after a playhead that has left the frame', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clipFixture('c', 0, 600_000_000)))
    laidOut(paint())
    expect(viewOf().offset).toBe(0)

    movePlayhead(500_000_000)

    expect(viewOf().offset).toBeGreaterThan(0)
  })

  /**
   * A montage offered nothing at all to a right-click: every edit was a key, so whoever had not
   * learnt them had no way to cut, unlink or delete a clip.
   */
  it('offers what can be done to the clip under the pointer', async () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))

    fireEvent.contextMenu(paint(), { clientX: 50, clientY: RULER_HEIGHT + 10 })

    await vi.waitFor(() =>
      expect(menu.labels()).toEqual([
        'Couper le clip',
        'Délier l’image et le son',
        'Supprimer le clip',
      ]),
    )
    // Greyed rather than dropped, so the menu keeps the same shape whatever it is opened over:
    // this clip is tied to nothing, and the playhead sits on its very start.
    expect(menu.offers('Délier l’image et le son')).toBe(false)
    expect(menu.offers('Couper le clip')).toBe(false)
  })

  it('runs the row that was chosen on the clip it was opened over', async () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    menu.picks('Supprimer le clip')

    fireEvent.contextMenu(paint(), { clientX: 50, clientY: RULER_HEIGHT + 10 })

    await vi.waitFor(() => expect(clipsOf()).toHaveLength(0))
  })

  /**
   * `pointerdown` fires before `contextmenu`, so the press that raises the menu was also
   * picking the clip up: it followed the pointer while the menu was open, and the drag's own
   * pointer-up rewound the montage to where the press began — over the deletion the menu had
   * just run. On screen: the clip slid, and nothing was deleted.
   */
  it('deletes from the menu without the press underneath moving anything', async () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    menu.picks('Supprimer le clip')
    const canvas = paint()

    fireEvent.pointerDown(canvas, { clientX: 50, clientY: RULER_HEIGHT + 10, button: 2 })
    fireEvent.contextMenu(canvas, { clientX: 50, clientY: RULER_HEIGHT + 10 })
    await vi.waitFor(() => expect(clipsOf()).toHaveLength(0))

    // The pointer travels on, as it does while a native menu is open and after it closes.
    fireEvent.pointerMove(canvas, { clientX: 300, clientY: RULER_HEIGHT + 10 })
    fireEvent.pointerUp(canvas, { clientX: 300, clientY: RULER_HEIGHT + 10 })

    expect(clipsOf()).toHaveLength(0)
  })

  /**
   * A Mac's main keyboard has one key marked « delete », and it reports `Backspace` — the
   * binding says `Delete`, which is that keyboard's `fn`-delete. Pressing the key that says
   * delete did nothing at all.
   */
  it('deletes the selected clip from the key that says delete', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    const canvas = paint()

    fireEvent.keyDown(canvas, { code: 'Backspace' })

    expect(clipsOf()).toHaveLength(0)
  })

  /**
   * Every edit here is undoable and always was, but nothing said so and nothing held it: the
   * key travels through the native Edit menu, which declares it WITHOUT reserving it, and a
   * regression there would leave the montage looking like an editor with no way back.
   */
  it('takes back the last edit on the undo key, and puts it back on redo', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    const canvas = paint()

    fireEvent.keyDown(canvas, { code: 'KeyZ', metaKey: true })
    expect(clipsOf()).toHaveLength(0)

    fireEvent.keyDown(canvas, { code: 'KeyZ', metaKey: true, shiftKey: true })
    expect(clipsOf()).toHaveLength(1)
  })

  it('raises nothing over a gap, where there is no clip to act on', async () => {
    fireEvent.contextMenu(paint(), { clientX: 50, clientY: RULER_HEIGHT + 10 })

    await Promise.resolve()
    expect(menu.raised).toHaveLength(0)
  })

  it('drags the view under the hand tool, which was declared and did nothing', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clipFixture('c', 0, 60_000_000)))
    const canvas = paint('hand')

    fireEvent.pointerDown(canvas, { clientX: 300, clientY: RULER_HEIGHT + 30 })
    fireEvent.pointerMove(canvas, { clientX: 100, clientY: RULER_HEIGHT + 30 })

    // Dragged left by 200 px: the strip moves right, so the view starts later in the montage.
    expect(viewOf().offset).toBe(Math.round(200 / viewOf().scale))
  })

  it('leaves the montage untouched while the hand drags across a clip', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    const before = clipsOf()
    const canvas = paint('hand')

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: RULER_HEIGHT + 30 })
    fireEvent.pointerMove(canvas, { clientX: 90, clientY: RULER_HEIGHT + 30 })
    fireEvent.pointerUp(canvas, { clientX: 90, clientY: RULER_HEIGHT + 30 })

    expect(clipsOf()).toEqual(before)
  })

  /**
   * The cursor is the whole of the feedback a trim gets before it starts: nothing is dragged
   * yet, and the grips painted on the canvas say a clip has ends without saying they are live.
   */
  it('takes a resize cursor over a clip edge', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    const canvas = paint()

    fireEvent.pointerMove(canvas, { clientX: 1, clientY: RULER_HEIGHT + 30 })

    expect(canvas.style.cursor).toBe('ew-resize')
  })

  it('gives the cursor back over the body of a clip, which is dragged and not trimmed', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    const canvas = paint()

    fireEvent.pointerMove(canvas, { clientX: 1, clientY: RULER_HEIGHT + 30 })
    fireEvent.pointerMove(canvas, {
      clientX: Math.round(timeToX(500_000, viewOf())),
      clientY: RULER_HEIGHT + 30,
    })

    expect(canvas.style.cursor).toBe('')
  })

  it('drops the resize cursor when the pointer leaves, rather than carrying it off the canvas', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    const canvas = paint()

    fireEvent.pointerMove(canvas, { clientX: 1, clientY: RULER_HEIGHT + 30 })
    fireEvent.pointerLeave(canvas)

    expect(canvas.style.cursor).toBe('')
  })

  it('never asks under the hand, which moves the view whether or not it is over an edge', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    const canvas = paint('hand')

    fireEvent.pointerMove(canvas, { clientX: 1, clientY: RULER_HEIGHT + 30 })

    expect(canvas.style.cursor).toBe('')
    expect(canvas.className).toContain('cursor-grab')
  })

  // The blade cuts where it is pressed. A resize cursor there would promise a lengthening and
  // hand back a cut two frames from the end, plus a history entry to undo.
  it('never asks under the blade either, which cuts rather than trims', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))
    const canvas = paint('blade')

    fireEvent.pointerMove(canvas, { clientX: 1, clientY: RULER_HEIGHT + 30 })

    expect(canvas.style.cursor).toBe('')
  })

  /**
   * The gesture the whole lot exists for: lay an image down, pull its left end, decide how long
   * it stays on screen. The clip starts at two seconds so there is room to grow leftwards.
   */
  const pullLeftEdgeTo = (target: number): void => {
    const canvas = paint()
    const left = Math.round(timeToX(2_000_000, viewOf()))

    fireEvent.pointerDown(canvas, { clientX: left + 1, clientY: RULER_HEIGHT + 30 })
    fireEvent.pointerUp(canvas, {
      clientX: Math.round(timeToX(target, viewOf())),
      clientY: RULER_HEIGHT + 30,
    })
  }

  const layDown = (): void => {
    useSequences
      .getState()
      .runCommand('doc-1', addClip('V1', clipFixture('c', 2_000_000, 1_000_000, { assetId: 'a1' })))
  }

  it('lengthens a still by its left edge, which is how an image gets its time on screen', () => {
    useAssets.setState({ items: [asset({ id: 'a1', type: 'image', name: 'card.png' })] })
    layDown()

    pullLeftEdgeTo(1_000_000)

    expect(clipsOf()[0]).toMatchObject({ start: 1_000_000, duration: 2_000_000 })
  })

  // The strip takes every kind of asset, and a texture is as timeless as an image: reading the
  // type alone rather than `isTimeless` refused this pull on two of the three kinds of picture.
  it('lengthens a texture the same way, since a picture is a picture however it was made', () => {
    useAssets.setState({ items: [asset({ id: 'a1', type: 'texture', name: 'brick.png' })] })
    layDown()

    pullLeftEdgeTo(1_000_000)

    expect(clipsOf()[0]).toMatchObject({ start: 1_000_000, duration: 2_000_000 })
  })

  /**
   * `mediaDuration` answers null for a still AND for an asset nobody has probed yet, so without
   * telling them apart this pull would succeed here too — and the clip would then ask for more
   * source than the rush holds, freezing its tail on a frame with the sound gone.
   */
  it('refuses the same pull on a rush nobody has probed, whose source starts somewhere', () => {
    useAssets.setState({ items: [asset({ id: 'a1', type: 'video', name: 'rush.mp4' })] })
    layDown()

    pullLeftEdgeTo(1_000_000)

    expect(clipsOf()[0]).toMatchObject({ start: 2_000_000, duration: 1_000_000 })
  })

  it('undoes the last edit from the keyboard', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))

    fireEvent.keyDown(paint(), { code: 'KeyZ', metaKey: true })

    expect(clipsOf()).toHaveLength(0)
  })
})
