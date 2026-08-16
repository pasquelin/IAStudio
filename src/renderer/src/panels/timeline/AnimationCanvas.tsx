import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from 'react'
import { snapToFrame, type Us } from '@shared/domain/time'
import { moveAnimationKey, unkeySubject } from '@/engines/scene/animation-commands'
import { multi, setModelAnimation } from '@/engines/scene/commands'
import type { Command } from '@/engines/core/history'
import type { SceneState } from '@/engines/scene/scene-state'
import { clampPlayhead } from '@/engines/scene/animation-eval'
import { hitAnimation, type AnimationHit } from '@/engines/scene/animation-hit'
import { paintAnimation, keyId, keyParts } from '@/engines/scene/animation-painter'
import { rowsHeight, maxOffsetFor, maxScrollTopFor } from '@/engines/timeline/band'
import { RULER_HEIGHT, xToTime, type Viewport } from '@/engines/timeline/timeline-geometry'
import { clampScale } from '@/engines/timeline/viewport'
import { useRepaintOnResize } from '@/hooks/useRepaintOnResize'
import { useTimelineWheel } from '@/hooks/useTimelineWheel'
import type { Size } from '@/engines/core/geometry'
import { paintOn } from '@/engines/core/canvas-2d'
import { trackIdsOf, type AnimationRow } from '@/engines/scene/animation-rows'
import { clamp } from '@shared/numeric'
import { animationViewOf, keySetOf, useAnimationViews } from '@/stores/animation-view'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useSceneViews, sceneViewOf } from '@/stores/scene-views'

export type AnimationCanvasProps = {
  documentId: string
  rows: readonly AnimationRow[]
}

/** What a press took hold of, so the move and the release know what they are continuing. */
type Grab =
  | { kind: 'scrub' }
  | { kind: 'key'; rowId: string; trackIds: readonly string[]; from: Us; at: Us }
  | { kind: 'block'; nodeId: string; grabbedAt: Us }

/**
 * The animation band: the ruler, the rows and the keys, painted.
 *
 * The same split the montage uses — this canvas draws, `AnimationHeaders` beside it holds the
 * controls. Reimplementing focus and accessible names inside a canvas would be rebuilding the
 * browser; drawing a thousand diamonds in the DOM would be a scroll that stutters.
 */
/** Slides a clip block along the band, keeping what it plays. */
function moveBlock(documentId: string, nodeId: string, start: Us): void {
  const store = useScenes.getState()
  const node = sceneOf(store, documentId).nodes.find(candidate => candidate.id === nodeId)
  if (node?.type !== 'model' || !node.model.animation) return

  store.runCommand(documentId, setModelAnimation(nodeId, { ...node.model.animation, start }))
}

export function AnimationCanvas({ documentId, rows }: AnimationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const grabbed = useRef<Grab | null>(null)

  const timeline = useScenes(state => sceneOf(state, documentId).animation)
  const playhead = useSceneViews(state => sceneViewOf(state, documentId).playhead)
  const view = useAnimationViews(state => animationViewOf(state, documentId))

  // Keyed on the array, whose identity is stable: building the set in a selector would hand
  // zustand a new snapshot on every render and the subscription would never settle.
  const selected = useMemo(() => keySetOf(view.selected), [view.selected])

  const latest = useRef({ rows, viewport: view.viewport, timeline, playhead, selected })
  const size = useRef<Size>({ width: 0, height: 0 })

  const paint = useCallback((): void => {
    paintOn(canvasRef.current, (context, box) => {
      size.current = box

      const current = latest.current
      paintAnimation(
        context,
        {
          rows: current.rows,
          viewport: current.viewport,
          fps: current.timeline.fps,
          duration: current.timeline.duration,
          playhead: current.playhead,
          selected: current.selected,
        },
        box,
      )
    })
  }, [])

  useEffect(() => {
    latest.current = { rows, viewport: view.viewport, timeline, playhead, selected }
    paint()
  }, [rows, view.viewport, timeline, playhead, selected, paint])

  useRepaintOnResize(canvasRef, paint)

  const setViewport = useCallback(
    (next: Viewport): void => {
      const current = latest.current
      const scale = clampScale(next.scale)
      const offset = clamp(
        Math.round(next.offset),
        0,
        maxOffsetFor(current.timeline.duration, scale, size.current.width),
      )
      const scrollTop = clamp(
        Math.round(next.scrollTop),
        0,
        maxScrollTopFor(rowsHeight(current.rows), size.current.height, RULER_HEIGHT),
      )
      useAnimationViews.getState().setViewport(documentId, { scale, offset, scrollTop })
    },
    [documentId],
  )

  useTimelineWheel(canvasRef, () => latest.current.viewport, setViewport)

  /**
   * Removes what is picked. Bound on the canvas rather than on a global scope: the band is one
   * surface among several that answer to Delete, and a key must not vanish because a viewport
   * happened to have focus.
   */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLCanvasElement>): void => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return

    const current = latest.current
    const picked = [...current.selected]
    if (picked.length === 0) return

    event.preventDefault()
    const store = useScenes.getState()
    const drops: Command<SceneState>[] = []

    for (const id of picked) {
      const key = keyParts(id)
      if (!key) continue

      const row = current.rows.find(candidate => candidate.id === key.rowId)
      if (!row) continue

      const command = unkeySubject(sceneOf(store, documentId), trackIdsOf(row), key.time)
      if (command) drops.push(command)
    }

    if (drops.length === 0) return
    store.runCommand(
      documentId,
      drops.length === 1 && drops[0] ? drops[0] : multi('key:drop', drops),
    )
    useAnimationViews.getState().setSelected(documentId, [])
  }

  const hitAt = (event: PointerEvent<HTMLCanvasElement>): AnimationHit | null => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const current = latest.current
    return hitAnimation(
      { rows: current.rows, viewport: current.viewport, fps: current.timeline.fps },
      { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
    )
  }

  const seek = (time: Us): void => {
    const { timeline: held } = latest.current
    useSceneViews
      .getState()
      .setPlayhead(documentId, clampPlayhead(snapToFrame(time, held.fps), held.duration))
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>): void => {
    const hit = hitAt(event)
    if (!hit) {
      useAnimationViews.getState().setSelected(documentId, [])
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)

    if (hit.kind === 'ruler') {
      grabbed.current = { kind: 'scrub' }
      seek(hit.time)
      return
    }

    if (hit.kind === 'row') {
      useAnimationViews.getState().setSelected(documentId, [])
      seek(hit.time)
      return
    }

    if (hit.kind === 'block') {
      grabbed.current = { kind: 'block', nodeId: hit.nodeId, grabbedAt: hit.grabbedAt }
      // Opened here and closed on release: without it every pixel of the drag is its own entry
      // in the history, and `runCoalescing` only merges while a gesture is open.
      useScenes.getState().beginGesture(documentId)
      useAnimationViews.getState().setSelected(documentId, [])
      return
    }

    const row = latest.current.rows.find(candidate => candidate.id === hit.rowId)
    if (!row) return

    // Every channel of a folded subject moves together: the diamond it shows stands for all of
    // them, and moving only one of the three would silently tear a pose apart.
    const trackIds = trackIdsOf(row)
    if (trackIds.length === 0) return

    grabbed.current = { kind: 'key', rowId: hit.rowId, trackIds, from: hit.time, at: hit.time }
    useAnimationViews.getState().setSelected(documentId, [keyId(hit.rowId, hit.time)])
  }

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    const grab = grabbed.current
    if (!grab) return

    const bounds = event.currentTarget.getBoundingClientRect()
    const current = latest.current
    const at = snapToFrame(
      xToTime(event.clientX - bounds.left, current.viewport),
      current.timeline.fps,
    )

    if (grab.kind === 'scrub') return seek(at)

    if (grab.kind === 'block') {
      // Written straight through rather than previewed: the block IS the preview, and the whole
      // run collapses into one entry because a gesture was opened on the press.
      moveBlock(documentId, grab.nodeId, Math.max(0, at - grab.grabbedAt))
      return
    }

    // The preview follows the pointer; the command is written once, on release — a drag must
    // cost one entry in the history, not one per pixel.
    grabbed.current = { ...grab, at: clampPlayhead(at, current.timeline.duration) }
    useAnimationViews.getState().setSelected(documentId, [keyId(grab.rowId, grab.at)])
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>): void => {
    const grab = grabbed.current
    grabbed.current = null
    if (!grab) return

    event.currentTarget.releasePointerCapture(event.pointerId)

    if (grab.kind === 'block') {
      useScenes.getState().endGesture(documentId)
      return
    }

    if (grab.kind !== 'key' || grab.at === grab.from) return

    // One entry however many channels moved, as `keySubject` does for the same reason: a drag
    // that cost three ⌘Z would put the pose back a third at a time.
    const moves = grab.trackIds.map(trackId => moveAnimationKey(trackId, grab.from, grab.at))
    const command = moves.length === 1 && moves[0] ? moves[0] : multi('key:drag', moves)

    useScenes.getState().runCommand(documentId, command)
    useAnimationViews.getState().setSelected(documentId, [keyId(grab.rowId, grab.at)])
  }

  return (
    <canvas
      ref={canvasRef}
      data-testid="animation-canvas"
      className="block h-full w-full outline-none"
      // Focusable, or the canvas would never receive a key at all.
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  )
}
