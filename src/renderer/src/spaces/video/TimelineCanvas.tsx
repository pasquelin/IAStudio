import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
} from 'react'
import { posterUrl } from '@shared/domain/asset'
import type { CommandId } from '@shared/domain/shortcut'
import { addClip, removeClip, splitClip } from '@/engines/timeline/commands'
import { beginGesture, commandForGesture, type Gesture } from '@/engines/timeline/interactions'
import { programOwner, transports } from '@/engines/timeline/playback'
import { clipForAsset } from '@/engines/timeline/insert'
import { paintTimeline } from '@/engines/timeline/painter'
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
import { assetIdFromDrag } from '@/helpers/asset-drag'
import { cachedImage } from '@/helpers/image-cache'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useAssets } from '@/stores/assets'
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
  const assets = useAssets(state => state.items)

  const byId = useMemo(() => new Map(assets.map(asset => [asset.id, asset])), [assets])
  const nameOf = useCallback(
    (clip: Clip): string => byId.get(clip.assetId)?.name ?? clip.assetId,
    [byId],
  )

  const peaksByAsset = usePeaks(state => state.byAsset)

  const peaksOf = useCallback(
    (clip: Clip): Float32Array | null => {
      // Asked for while painting, answered on a later frame: the fetch is one round trip, and
      // the clip draws as a rectangle until it lands.
      usePeaks.getState().request(clip.assetId)
      return peaksByAsset[clip.assetId] ?? null
    },
    [peaksByAsset],
  )

  // A poster decodes after the frame that asked for it, so it needs one more frame to appear.
  // Counted rather than pushed through a ref, which a hook may not write to.
  const [decoded, setDecoded] = useState(0)
  const onDecoded = useCallback(() => setDecoded(count => count + 1), [])

  const posterOf = useCallback(
    (clip: Clip): CanvasImageSource | null => {
      const asset = byId.get(clip.assetId)
      const url = asset ? posterUrl(asset) : null
      return url ? cachedImage(url, onDecoded) : null
    },
    [byId, onDecoded],
  )

  // Read by `paint`, which must stay stable: rebuilding the observer on every dragged pixel
  // would tear down and re-create it sixty times a second.
  const latest = useRef({ sequence, viewport, nameOf, peaksOf, posterOf })
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
    // every retina display.
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)

    const current = latest.current
    paintTimeline(
      context,
      current.sequence,
      current.viewport,
      { width, height },
      { labelOf: current.nameOf, peaksOf: current.peaksOf, posterOf: current.posterOf },
    )
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [paint])

  useEffect(() => {
    latest.current = { sequence, viewport, nameOf, peaksOf, posterOf }
    paint()
    // `decoded` is not read here: it is what a poster arriving late repaints for.
  }, [sequence, viewport, nameOf, peaksOf, posterOf, decoded, paint])

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
        case 'timeline.playPause':
          return transports.toggle(programOwner(documentId))
        case 'timeline.split': {
          const target = clipUnderPlayhead(state)
          if (target) store.runCommand(documentId, splitClip(target.id, state.playhead))
          return
        }
        case 'timeline.delete':
          if (state.selectedId) store.runCommand(documentId, removeClip(state.selectedId))
          return
        case 'timeline.zoomIn':
          return setViewport(zoomAt(current, ZOOM_STEP, middle))
        case 'timeline.zoomOut':
          return setViewport(zoomAt(current, 1 / ZOOM_STEP, middle))
        case 'timeline.fit':
          return setViewport(fitToWidth(state, size.current.width))
        case 'timeline.start':
          return seek(0)
        case 'timeline.end':
          return seek(sequenceDuration(state))
        case 'timeline.undo':
          return store.undo(documentId)
        case 'timeline.redo':
          return store.redo(documentId)
        default:
          return
      }
    },
    [documentId, seek, setViewport],
  )

  // The strip is only mounted for the document in front, so it always listens while it is there.
  useShortcuts({ scope: 'timeline', enabled: true, onCommand: run })

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

    const gesture = beginGesture(sequence, viewport, point)
    if (!gesture) {
      useSequences.getState().replace(documentId, { ...sequence, selectedId: null })
      useSelection.getState().clear()
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
    useSelection.getState().selectClip()
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    const current = dragging.current
    if (!current) return

    const point = pointAt(event)
    if (current.gesture.kind === 'scrub') {
      scrubTo(current.base, point)
      return
    }

    const command = commandForGesture(current.gesture, current.base, viewport, point)
    if (command) useSequences.getState().replace(documentId, command.apply(current.base))
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>): void => {
    const current = dragging.current
    dragging.current = null
    if (!current) return

    event.currentTarget.releasePointerCapture(event.pointerId)
    if (current.gesture.kind === 'scrub') return

    const command = commandForGesture(current.gesture, current.base, viewport, pointAt(event))
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

    const asset = useAssets.getState().items.find(candidate => candidate.id === assetId) ?? null
    const start = xToTime(point.x, viewport)
    const clip = clipForAsset(assetId, asset, start, sequence.settings)

    useSequences.getState().runCommand(documentId, addClip(target.trackId, clip))
  }

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      className="block h-full w-full outline-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDragOver={event => event.preventDefault()}
      onDrop={onDrop}
    />
  )
}
