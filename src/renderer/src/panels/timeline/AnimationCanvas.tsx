import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from 'react'
import { frameDuration, snapToFrame, type Us } from '@shared/domain/time'
import {
  editCameraShot,
  moveAnimationKey,
  removeCameraShot,
  unkeySubject,
} from '@/engines/scene/animationCommands'
import { activeShotAt, draggedShot } from '@/engines/scene/cameraShots'
import { multi, setModelClips } from '@/engines/scene/commands'
import type { Command } from '@/engines/core/history'
import type { SceneState } from '@/engines/scene/sceneState'
import { clampPlayhead } from '@/engines/scene/animationEval'
import { hitAnimation, type AnimationHit } from '@/engines/scene/animationHit'
import { paintAnimation, keyId, keyParts } from '@/engines/scene/animationPainter'
import { rowsHeight, maxOffsetFor, maxScrollTopFor } from '@/engines/timeline/band'
import { RULER_HEIGHT, xToTime, type Viewport } from '@/engines/timeline/timelineGeometry'
import { clampScale } from '@/engines/timeline/viewport'
import { useRepaintOnResize } from '@/hooks/useRepaintOnResize'
import { useTimelineWheel } from '@/hooks/useTimelineWheel'
import type { Size } from '@/engines/core/geometry'
import { paintOn } from '@/engines/core/canvas2d'
import { trackIdsOf, type AnimationRow } from '@/engines/scene/animationRows'
import { clamp } from '@shared/numeric'
import { animationViewOf, keySetOf, useAnimationViews } from '@/stores/animationView'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useSceneViews, sceneViewOf } from '@/stores/sceneViews'

export type AnimationCanvasProps = {
  documentId: string
  rows: readonly AnimationRow[]
}

/** What a press took hold of, so the move and the release know what they are continuing. */
type Grab =
  | { kind: 'scrub' }
  | { kind: 'key'; rowId: string; trackIds: readonly string[]; from: Us; at: Us }
  | { kind: 'block'; nodeId: string; clipId: string; grabbedAt: Us }
  | { kind: 'shot'; shotId: string; edge: 'start' | 'end' | null; grabbedAt: Us }

/** Slides one clip block along the band, keeping what it plays and leaving its neighbours put. */
function moveBlock(documentId: string, nodeId: string, clipId: string, start: Us): void {
  const store = useScenes.getState()
  const node = sceneOf(store, documentId).nodes.find(candidate => candidate.id === nodeId)
  if (node?.type !== 'model' || !node.model.clips) return

  const moved = node.model.clips.map(clip => (clip.id === clipId ? { ...clip, start } : clip))
  store.runCommand(documentId, setModelClips(nodeId, moved))
}

/**
 * The animation band: the ruler, the rows and the keys, painted.
 *
 * The same split the montage uses — this canvas draws, `AnimationHeaders` beside it holds the
 * controls. Reimplementing focus and accessible names inside a canvas would be rebuilding the
 * browser; drawing a thousand diamonds in the DOM would be a scroll that stutters.
 */
export function AnimationCanvas({ documentId, rows }: AnimationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const grabbed = useRef<Grab | null>(null)

  const timeline = useScenes(state => sceneOf(state, documentId).animation)
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const playhead = useSceneViews(state => sceneViewOf(state, documentId).playhead)
  const view = useAnimationViews(state => animationViewOf(state, documentId))

  // Keyed on the array, whose identity is stable: building the set in a selector would hand
  // zustand a new snapshot on every render and the subscription would never settle.
  const selected = useMemo(() => keySetOf(view.selected), [view.selected])

  // Everything the paint reads, gathered once: the ref and the effect below hand over the very
  // same object, so a field gained here is not a field to remember in two other places.
  const snapshot = {
    rows,
    viewport: view.viewport,
    timeline,
    playhead,
    selected,
    activeShotId: activeShotAt(timeline, nodes, playhead)?.id ?? null,
    selectedShotId: view.selectedShotId,
  }

  const latest = useRef(snapshot)
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
          activeShotId: current.activeShotId,
          selectedShotId: current.selectedShotId,
        },
        box,
      )
    })
  }, [])

  useEffect(() => {
    latest.current = snapshot
    paint()
  })

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
    if (current.selectedShotId) {
      event.preventDefault()
      useScenes.getState().runCommand(documentId, removeCameraShot(current.selectedShotId))
      useAnimationViews.getState().setSelectedShot(documentId, null)
      return
    }

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
    // Anywhere but a bar drops the picked shot: Delete would otherwise take away a shot the
    // pointer left behind three gestures ago.
    if (hit?.kind !== 'shot') useAnimationViews.getState().setSelectedShot(documentId, null)

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
      grabbed.current = {
        kind: 'block',
        nodeId: hit.nodeId,
        clipId: hit.clipId,
        grabbedAt: hit.grabbedAt,
      }
      // Opened here and closed on release: without it every pixel of the drag is its own entry
      // in the history, and `runCoalescing` only merges while a gesture is open.
      useScenes.getState().beginGesture(documentId)
      useAnimationViews.getState().setSelected(documentId, [])
      return
    }

    if (hit.kind === 'shot') {
      grabbed.current = {
        kind: 'shot',
        shotId: hit.shotId,
        edge: hit.edge,
        grabbedAt: hit.grabbedAt,
      }
      useScenes.getState().beginGesture(documentId)
      const views = useAnimationViews.getState()
      views.setSelected(documentId, [])
      views.setSelectedShot(documentId, hit.shotId)
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
    // What the pointer promises before it presses, as the montage does over a clip's edge: a
    // bar that can be trimmed and never says so is a bar nobody tries to trim.
    if (!grab) {
      const hit = hitAt(event)
      event.currentTarget.style.cursor = hit?.kind === 'shot' && hit.edge ? 'ew-resize' : ''
      return
    }

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
      moveBlock(documentId, grab.nodeId, grab.clipId, Math.max(0, at - grab.grabbedAt))
      return
    }

    if (grab.kind === 'shot') {
      const shot = current.timeline.shots.find(held => held.id === grab.shotId)
      const bounds = shot ? draggedShot(shot, grab, at, frameDuration(current.timeline.fps)) : null
      // Written straight through, like a block: the bar IS the preview, and the run collapses
      // into one entry because a gesture was opened on the press.
      if (bounds) useScenes.getState().runCommand(documentId, editCameraShot(grab.shotId, bounds))
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

    if (grab.kind === 'block' || grab.kind === 'shot') {
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
      // Or a pointer that leaves mid-hover writes the resize cursor on the element for good.
      onPointerLeave={event => (event.currentTarget.style.cursor = '')}
      onPointerUp={onPointerUp}
    />
  )
}
