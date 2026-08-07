import {
  useCallback,
  useEffect,
  useRef,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { addClip, removeClip, splitClip } from '@/engines/timeline/commands'
import { beginGesture, commandForGesture, type Gesture } from '@/engines/timeline/interactions'
import { paintTimeline } from '@/engines/timeline/painter'
import { hitTest, xToTime, type Point, type Viewport } from '@/engines/timeline/timeline-geometry'
import {
  newClipId,
  snapToFrame,
  wholeFrames,
  type Clip,
  type SequenceState,
} from '@/engines/timeline/timeline-state'
import { assetIdFromDrag } from '@/helpers/asset-drag'
import { useAssets } from '@/stores/assets'
import { sequenceOf, useSequences } from '@/stores/sequences'
import type { VideoToolId } from './video-tools'

export type TimelineCanvasProps = { documentId: string; tool: VideoToolId }

/** 100 px per second — the zoom this branch opens on. */
export const DEFAULT_VIEWPORT: Viewport = { scale: 100 / 1_000_000, offset: 0, scrollTop: 0 }

/** What an asset still being probed is worth on the timeline, until its real duration lands. */
export const UNPROBED_DURATION = 5_000_000

export function TimelineCanvas({ documentId, tool }: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // The gesture and the state it started from: one history entry per gesture, not per pixel.
  const dragging = useRef<{ gesture: Gesture; base: SequenceState } | null>(null)
  const sequence = useSequences(state => sequenceOf(state, documentId))

  // Read by `paint`, which must stay stable: rebuilding the observer on every dragged pixel
  // would tear down and re-create it sixty times a second.
  const latest = useRef(sequence)

  const paint = useCallback((): void => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const ratio = window.devicePixelRatio
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // Backing store in device pixels, drawing in CSS pixels: without this the ruler is soft on
    // every retina display.
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)

    paintTimeline(context, latest.current, DEFAULT_VIEWPORT, { width, height })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [paint])

  useEffect(() => {
    latest.current = sequence
    paint()
  }, [sequence, paint])

  const pointAt = (
    event: PointerEvent<HTMLCanvasElement> | DragEvent<HTMLCanvasElement>,
  ): Point => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  const scrubTo = (base: SequenceState, point: Point): void => {
    const playhead = snapToFrame(xToTime(point.x, DEFAULT_VIEWPORT), base.settings)
    // The playhead is not an edit: it goes through `replace`, which skips the history.
    useSequences.getState().replace(documentId, { ...base, playhead })
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>): void => {
    const point = pointAt(event)

    if (tool === 'blade') {
      const target = hitTest(sequence, DEFAULT_VIEWPORT, point)
      const clipId = target && 'clipId' in target ? target.clipId : null
      if (clipId) {
        const at = xToTime(point.x, DEFAULT_VIEWPORT)
        useSequences.getState().runCommand(documentId, splitClip(clipId, at))
      }
      return
    }

    const gesture = beginGesture(sequence, DEFAULT_VIEWPORT, point)
    if (!gesture) {
      useSequences.getState().replace(documentId, { ...sequence, selectedId: null })
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)

    if (gesture.kind === 'scrub') {
      dragging.current = { gesture, base: sequence }
      scrubTo(sequence, point)
      return
    }

    // Selecting is not an edit either, and the clip must highlight before the drag moves it.
    const base: SequenceState = { ...sequence, selectedId: gesture.clipId }
    dragging.current = { gesture, base }
    useSequences.getState().replace(documentId, base)
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    const current = dragging.current
    if (!current) return

    const point = pointAt(event)
    if (current.gesture.kind === 'scrub') {
      scrubTo(current.base, point)
      return
    }

    const command = commandForGesture(current.gesture, current.base, DEFAULT_VIEWPORT, point)
    if (command) useSequences.getState().replace(documentId, command.apply(current.base))
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>): void => {
    const current = dragging.current
    dragging.current = null
    if (!current) return

    event.currentTarget.releasePointerCapture(event.pointerId)
    if (current.gesture.kind === 'scrub') return

    const command = commandForGesture(
      current.gesture,
      current.base,
      DEFAULT_VIEWPORT,
      pointAt(event),
    )
    if (!command) return

    const store = useSequences.getState()
    // Rewind the preview first: the command has to apply to the state the gesture started from,
    // or undo would step back to a half-dragged clip.
    store.replace(documentId, current.base)
    store.runCommand(documentId, command)
  }

  const onDrop = (event: DragEvent<HTMLCanvasElement>): void => {
    event.preventDefault()

    const assetId = assetIdFromDrag(event)
    if (!assetId) return

    const point = pointAt(event)
    const target = hitTest(sequence, DEFAULT_VIEWPORT, point)
    if (!target || target.kind === 'ruler') return

    const asset = useAssets.getState().items.find(candidate => candidate.id === assetId)
    const clip: Clip = {
      id: newClipId(),
      assetId,
      start: snapToFrame(xToTime(point.x, DEFAULT_VIEWPORT), sequence.settings),
      // A whole number of frames, so the clip's tail stays snappable — see `wholeFrames`.
      duration: wholeFrames(asset?.probe?.duration ?? UNPROBED_DURATION, sequence.settings),
      inPoint: 0,
      speed: 1,
    }

    useSequences.getState().runCommand(documentId, addClip(target.trackId, clip))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>): void => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return
    if (!sequence.selectedId) return
    event.preventDefault()
    useSequences.getState().runCommand(documentId, removeClip(sequence.selectedId))
  }

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      className="block h-full w-full outline-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
      onDragOver={event => event.preventDefault()}
      onDrop={onDrop}
    />
  )
}
