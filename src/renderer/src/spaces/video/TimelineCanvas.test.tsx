import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { addClip } from '@/engines/timeline/commands'
import { RULER_HEIGHT, xToTime, type Viewport } from '@/engines/timeline/timeline-geometry'
import { clipFixture } from '@/engines/timeline/timeline-fixtures'
import type { Clip } from '@/engines/timeline/timeline-state'
import { EMPTY_SEQUENCE, snapToFrame } from '@/engines/timeline/timeline-state'
import { startAssetDrag } from '@/helpers/asset-drag'
import { dragTransfer } from '@/helpers/drag-fixtures'
import { useAssets } from '@/stores/assets'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { useTimelineView, viewportOf } from '@/stores/timeline-view'
import { TIMELESS_DURATION } from '@/engines/timeline/insert'
import { TimelineCanvas } from './TimelineCanvas'
import type { VideoToolId } from './video-tools'

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

describe('TimelineCanvas', () => {
  beforeEach(() => {
    useSequences.setState({ states: {}, histories: {} })
    useTimelineView.setState({ viewports: {} })
    useAssets.setState({ items: [asset()] })
  })

  it('turns a dropped asset into a clip on the track it landed on', () => {
    fireEvent.drop(paint(), {
      clientX: 200,
      clientY: RULER_HEIGHT + 10,
      dataTransfer: dataTransfer('asset-1'),
    })

    expect(clipsOf()).toHaveLength(1)
    expect(clipsOf()[0]).toMatchObject({ assetId: 'asset-1', start: 2_000_000 })
  })

  it('gives a clip the probed duration of its asset', () => {
    useAssets.setState({ items: [asset({ probe: { duration: 8_000_000, codec: 'avc1' } })] })

    fireEvent.drop(paint(), {
      clientX: 0,
      clientY: RULER_HEIGHT + 10,
      dataTransfer: dataTransfer('asset-1'),
    })

    expect(clipsOf()[0]?.duration).toBe(8_000_000)
  })

  it('falls back to a default length for an asset that has not been probed yet', () => {
    fireEvent.drop(paint(), {
      clientX: 0,
      clientY: RULER_HEIGHT + 10,
      dataTransfer: dataTransfer('asset-1'),
    })

    expect(clipsOf()[0]?.duration).toBe(TIMELESS_DURATION)
  })

  it('refuses a drop on the ruler, which holds no track', () => {
    fireEvent.drop(paint(), { clientX: 200, clientY: 4, dataTransfer: dataTransfer('asset-1') })
    expect(clipsOf()).toHaveLength(0)
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

  it('undoes the last edit from the keyboard', () => {
    useSequences.getState().runCommand('doc-1', addClip('V1', clip))

    fireEvent.keyDown(paint(), { code: 'KeyZ', metaKey: true })

    expect(clipsOf()).toHaveLength(0)
  })
})
