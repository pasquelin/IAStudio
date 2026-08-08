import type { CommandId } from '@shared/domain/command'
import { useCallback, useEffect, useRef, type DragEvent, type PointerEvent } from 'react'
import { mediaDuration, posterUrl } from '@shared/domain/asset'
import { addClip, removeClip, splitClip } from '@/engines/timeline/commands'
import {
  beginGesture,
  commandForGesture,
  viewportForGesture,
  type Gesture,
} from '@/engines/timeline/interactions'
import { clipForAsset } from '@/engines/timeline/insert'
import { paintTimeline, type PaintOptions } from '@/engines/timeline/painter'
import { hitTest, xToTime, type Point, type Viewport } from '@/engines/timeline/timeline-geometry'
import {
  clipUnderPlayhead,
  sequenceDuration,
  snapToFrame,
  type Clip,
  type SequenceState,
} from '@/engines/timeline/timeline-state'
import {
  clampViewport,
  fitToWidth,
  revealTime,
  scrollBy,
  zoomAt,
  ZOOM_STEP,
  type Size,
} from '@/engines/timeline/viewport'
import { assetIdFromDrag, carriesAsset } from '@/helpers/asset-drag'
import { cn } from '@/helpers/cn'
import { cachedImage } from '@/helpers/image-cache'
import { useShortcuts } from '@/hooks/useShortcuts'
import { assetsById, useAssets } from '@/stores/assets'
import { usePeaks } from '@/stores/peaks'
import { useSelection } from '@/stores/selection'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { useTimelineView, viewportOf } from '@/stores/timeline-view'
import type { VideoToolId } from './video-tools'

export type TimelineCanvasProps = { documentId: string; tool: VideoToolId }

export function TimelineCanvas({ documentId, tool }: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // The gesture and the state it started from: one history entry per gesture, not per pixel.
  const dragging = useRef<{ gesture: Gesture; base: SequenceState } | null>(null)

  const sequence = useSequences(state => sequenceOf(state, documentId))
  const viewport = useTimelineView(state => viewportOf(state, documentId))
  const byId = useAssets(assetsById)

  // Read by `paint`, which must stay stable: rebuilding the observer on every dragged pixel
  // would tear down and re-create it sixty times a second.
  const latest = useRef<{ sequence: SequenceState; viewport: Viewport; options: PaintOptions }>({
    sequence,
    viewport,
    options: {},
  })
  const size = useRef<Size>({ width: 0, height: 0 })

  const paint = useCallback((): void => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const ratio = window.devicePixelRatio
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    size.current = { width, height }

    // Backing store in device pixels, drawing in CSS pixels: without this the ruler is soft on
    // every retina display. Only when it actually changed — assigning `width` at all throws
    // away the GPU texture and reallocates several megabytes, even for the same value.
    const backing = { width: Math.round(width * ratio), height: Math.round(height * ratio) }
    if (canvas.width !== backing.width || canvas.height !== backing.height) {
      canvas.width = backing.width
      canvas.height = backing.height
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0)

    const current = latest.current
    paintTimeline(context, current.sequence, current.viewport, { width, height }, current.options)
  }, [])

  /**
   * A repaint, at most one per frame.
   *
   * Posters and waveforms both land one asset at a time, after the frame that asked for them,
   * and each of them only needs the strip drawn again. Opening a project answered every
   * arrival with its own repaint; coalescing them costs one frame of latency and nothing else.
   */
  const queued = useRef(0)
  const repaint = useCallback((): void => {
    if (queued.current) return
    queued.current = requestAnimationFrame(() => {
      queued.current = 0
      paint()
    })
  }, [paint])

  const nameOf = useCallback(
    (clip: Clip): string => byId.get(clip.assetId)?.name ?? clip.assetId,
    [byId],
  )

  const peaksOf = useCallback((clip: Clip): Float32Array | null => {
    // Read out of the store rather than subscribed to: the component has no use for the table,
    // only the canvas has, and subscribing to it re-rendered the strip once per sound of a
    // project as the waveforms came back.
    const peaks = usePeaks.getState()
    // Asked for while painting, answered on a later frame: the fetch is one round trip, and
    // the clip draws as a rectangle until it lands.
    peaks.request(clip.assetId)
    return peaks.byAsset[clip.assetId] ?? null
  }, [])

  // A trim stops where the media does, and only the catalogue knows how long that is.
  const mediaLengths = useCallback(
    (assetId: string) => mediaDuration(byId.get(assetId) ?? null),
    [byId],
  )

  const posterOf = useCallback(
    (clip: Clip): CanvasImageSource | null => {
      const asset = byId.get(clip.assetId)
      const url = asset ? posterUrl(asset) : null
      return url ? cachedImage(url, repaint) : null
    },
    [byId, repaint],
  )

  useEffect(() => {
    const stop = usePeaks.subscribe(repaint)
    return () => {
      stop()
      if (queued.current) cancelAnimationFrame(queued.current)
    }
  }, [repaint])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [paint])

  useEffect(() => {
    latest.current = { sequence, viewport, options: { labelOf: nameOf, peaksOf, posterOf } }
    paint()
  }, [sequence, viewport, nameOf, peaksOf, posterOf, paint])

  const setViewport = useCallback(
    (next: Viewport): void => {
      const clamped = clampViewport(next, latest.current.sequence, size.current)
      useTimelineView.getState().set(documentId, clamped)
    },
    [documentId],
  )

  // Native and non-passive: React delivers `wheel` passively, where `preventDefault` is a no-op
  // and the whole window scrolls behind the timeline instead.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const current = latest.current.viewport

      if (event.ctrlKey || event.metaKey) {
        const bounds = canvas.getBoundingClientRect()
        setViewport(
          zoomAt(
            current,
            event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP,
            event.clientX - bounds.left,
          ),
        )
        return
      }

      // Shift turns a vertical wheel horizontal, as every editor does for a single-axis mouse.
      const horizontal = event.shiftKey ? event.deltaY : event.deltaX
      const vertical = event.shiftKey ? 0 : event.deltaY
      setViewport(scrollBy(current, horizontal, vertical))
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [setViewport])

  const seek = useCallback(
    (time: number): void => {
      const store = useSequences.getState()
      const state = sequenceOf(store, documentId)
      const playhead = Math.max(0, Math.min(sequenceDuration(state), time))
      store.replace(documentId, { ...state, playhead })
      setViewport(revealTime(latest.current.viewport, playhead, size.current.width))
    },
    [documentId, setViewport],
  )

  const run = useCallback(
    (command: CommandId): void => {
      const store = useSequences.getState()
      const state = sequenceOf(store, documentId)
      const current = latest.current.viewport
      const middle = size.current.width / 2

      switch (command) {
        // `sequence.playPause` is deliberately absent: the programme monitor listens on the
        // same scope and drives the same transport, and both handling it played then paused.
        case 'sequence.split': {
          const target = clipUnderPlayhead(state)
          if (target) store.runCommand(documentId, splitClip(target.id, state.playhead))
          return
        }
        case 'sequence.delete':
          if (state.selectedId) store.runCommand(documentId, removeClip(state.selectedId))
          return
        case 'sequence.zoomIn':
          return setViewport(zoomAt(current, ZOOM_STEP, middle))
        case 'sequence.zoomOut':
          return setViewport(zoomAt(current, 1 / ZOOM_STEP, middle))
        case 'sequence.fit':
          return setViewport(fitToWidth(state, size.current.width))
        case 'sequence.start':
          return seek(0)
        case 'sequence.end':
          return seek(sequenceDuration(state))
        case 'sequence.undo':
          return store.undo(documentId)
        case 'sequence.redo':
          return store.redo(documentId)
        default:
          return
      }
    },
    [documentId, seek, setViewport],
  )

  // The strip is only mounted for the document in front, so it always listens while it is there.
  useShortcuts({ scope: 'sequence', enabled: true, onCommand: run })

  const pointAt = (
    event: PointerEvent<HTMLCanvasElement> | DragEvent<HTMLCanvasElement>,
  ): Point => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  const scrubTo = (base: SequenceState, point: Point): void => {
    const playhead = snapToFrame(xToTime(point.x, viewport), base.settings)
    // The playhead is not an edit: it goes through `replace`, which skips the history.
    useSequences.getState().replace(documentId, { ...base, playhead })
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>): void => {
    const point = pointAt(event)

    if (tool === 'blade') {
      const target = hitTest(sequence, viewport, point)
      const clipId = target && 'clipId' in target ? target.clipId : null
      if (clipId) {
        const at = xToTime(point.x, viewport)
        useSequences.getState().runCommand(documentId, splitClip(clipId, at))
      }
      return
    }

    const gesture = beginGesture(sequence, viewport, point, tool === 'hand')
    if (!gesture) {
      useSequences.getState().replace(documentId, { ...sequence, selectedId: null })
      useSelection.getState().clear()
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)

    // Neither moves the montage, so neither selects anything either.
    if (gesture.kind === 'scrub' || gesture.kind === 'pan') {
      dragging.current = { gesture, base: sequence }
      if (gesture.kind === 'scrub') scrubTo(sequence, point)
      return
    }

    // Selecting is not an edit either, and the clip must highlight before the drag moves it.
    const base: SequenceState = { ...sequence, selectedId: gesture.clipId }
    dragging.current = { gesture, base }
    useSequences.getState().replace(documentId, base)
    useSelection.getState().selectClip(documentId, gesture.clipId)
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    const current = dragging.current
    if (!current) return

    const point = pointAt(event)

    const view = viewportForGesture(current.gesture, point)
    if (view) return setViewport(view)

    if (current.gesture.kind === 'scrub') {
      scrubTo(current.base, point)
      return
    }

    const command = commandForGesture(current.gesture, current.base, viewport, point, mediaLengths)
    if (command) useSequences.getState().replace(documentId, command.apply(current.base))
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>): void => {
    const current = dragging.current
    dragging.current = null
    if (!current) return

    event.currentTarget.releasePointerCapture(event.pointerId)

    const command = commandForGesture(
      current.gesture,
      current.base,
      viewport,
      pointAt(event),
      mediaLengths,
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
    const target = hitTest(sequence, viewport, point)
    if (!target || target.kind === 'ruler') return

    const asset = byId.get(assetId) ?? null
    const start = xToTime(point.x, viewport)
    const clip = clipForAsset(assetId, asset, start, sequence.settings)

    useSequences.getState().runCommand(documentId, addClip(target.trackId, clip))
  }

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      className={cn(
        'block h-full w-full outline-none',
        tool === 'hand' && 'cursor-grab active:cursor-grabbing',
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      // Not `AssetDropTarget`: what this surface accepts is decided per track, and one outline
      // over the whole timeline would promise the ruler takes what it refuses. Only the half
      // that has nothing to do with tracks is shared — preventing a drag we do not carry is
      // what makes a surface swallow files dragged in from the desktop.
      onDragOver={event => {
        if (carriesAsset(event)) event.preventDefault()
      }}
      onDrop={onDrop}
    />
  )
}
