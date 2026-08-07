import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { removeClip, splitClip } from '@/engines/timeline/commands'
import { beginGesture, commandForGesture, type Gesture } from '@/engines/timeline/interactions'
import { paintTimeline } from '@/engines/timeline/painter'
import { hitTest, xToTime, type Point, type Viewport } from '@/engines/timeline/timeline-geometry'
import { snapToFrame, type SequenceState } from '@/engines/timeline/timeline-state'
import { sequenceOf, useSequences } from '@/stores/sequences'

export type TimelineCanvasProps = { documentId: string; tool: string }

/** 100 px per second — the zoom this branch opens on. */
export const DEFAULT_VIEWPORT: Viewport = { scale: 100 / 1_000_000, offset: 0, scrollTop: 0 }

export function TimelineCanvas({ documentId, tool }: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // The gesture and the state it started from: one history entry per gesture, not per pixel.
  const dragging = useRef<{ gesture: Gesture; base: SequenceState } | null>(null)
  const sequence = useSequences(state => sequenceOf(state, documentId))

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const paint = (): void => {
      const ratio = window.devicePixelRatio
      const width = canvas.clientWidth
      const height = canvas.clientHeight

      // Backing store in device pixels, drawing in CSS pixels: without this the ruler is soft
      // on every retina display.
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)

      paintTimeline(context, sequence, DEFAULT_VIEWPORT, { width, height })
    }

    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [sequence])

  const pointAt = (event: PointerEvent<HTMLCanvasElement>): Point => {
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
    />
  )
}
