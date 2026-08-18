import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type DragEvent,
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
import { draggedShot } from '@/engines/scene/cameraShots'
import { bundledClip, clipKeyOf, embeddedClip, type ClipRef } from '@shared/domain/scene'
import { newId } from '@/helpers/ids'
import { ANIMATION_DRAG_TYPE, draggedAnimationOf } from '@/panels/animations/dragged'
import { multi, setModelLanes } from '@/engines/scene/commands'
import { clipsMoved, clipsTrimmed, lanesWith } from '@/engines/scene/clipBlend'
import { useModelClips } from '@/stores/modelClips'
import type { Command } from '@/engines/core/history'
import type { SceneState } from '@/engines/scene/sceneState'
import { clampPlayhead } from '@/engines/scene/animationEval'
import {
  animationCursorAt,
  hitAnimation,
  type AnimationHit,
  type HitContext,
} from '@/engines/scene/animationHit'
import type { Point } from '@/engines/core/geometry'
import { paintAnimation, keyId, keyParts } from '@/engines/scene/animationPainter'
import { rowsHeight, maxOffsetFor, maxScrollTopFor } from '@/engines/timeline/band'
import {
  RULER_HEIGHT,
  xToTime,
  type ClipEdge,
  type Viewport,
} from '@/engines/timeline/timelineGeometry'
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

/** Which block of which lane a gesture is editing. */
type BlockRef = { nodeId: string; laneId: string; clipId: string }

function blockRefOf(hit: { nodeId: string; laneId: string; clipId: string }): BlockRef {
  return { nodeId: hit.nodeId, laneId: hit.laneId, clipId: hit.clipId }
}

/** What a press took hold of, so the move and the release know what they are continuing. */
type Grab =
  | { kind: 'scrub' }
  | { kind: 'key'; rowId: string; trackIds: readonly string[]; from: Us; at: Us }
  | ({ kind: 'block'; grabbedAt: Us } & BlockRef)
  | ({ kind: 'blockEdge'; edge: ClipEdge } & BlockRef)
  | { kind: 'shot'; shotId: string; edge: 'start' | 'end' | null; grabbedAt: Us }

/**
 * Rewrites one lane of one model, and banks nothing when the edit is refused: `runCommand` takes
 * whatever it is handed, so a drag that changes nothing would still cost an entry in the history.
 */
function editLane(
  documentId: string,
  where: BlockRef,
  change: (clips: readonly ClipRef[]) => readonly ClipRef[] | null,
): void {
  const store = useScenes.getState()
  const node = sceneOf(store, documentId).nodes.find(candidate => candidate.id === where.nodeId)
  if (node?.type !== 'model' || !node.model.lanes) return

  const lanes = lanesWith(node.model.lanes, where.laneId, change)
  if (lanes) store.runCommand(documentId, setModelLanes(where.nodeId, lanes))
}

/** How long the clip a block plays runs in the file, which is what a trim is measured against. */
function clipLengthOf(documentId: string, where: BlockRef): number | null {
  const node = sceneOf(useScenes.getState(), documentId).nodes.find(
    candidate => candidate.id === where.nodeId,
  )
  if (node?.type !== 'model') return null

  const clip = node.model.lanes
    ?.find(lane => lane.id === where.laneId)
    ?.clips.find(candidate => candidate.id === where.clipId)

  return clip
    ? (useModelClips.getState().lengths[documentId]?.[where.nodeId]?.[clipKeyOf(clip.source)] ??
        null)
    : null
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
    picked: view.pickedBlock,
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
          picked: current.picked,
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
    // A shot answers to its own id in the same set the keys use, so what is picked is read once.
    const shot = current.timeline.shots.find(held => current.selected.has(held.id))
    if (shot) {
      event.preventDefault()
      useScenes.getState().runCommand(documentId, removeCameraShot(shot.id))
      useAnimationViews.getState().setSelected(documentId, [])
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

  const hitContext = (): HitContext => {
    const current = latest.current
    return { rows: current.rows, viewport: current.viewport, fps: current.timeline.fps }
  }

  const pointIn = (event: { currentTarget: Element; clientX: number; clientY: number }): Point => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }

  const hitAt = (event: PointerEvent<HTMLCanvasElement>): AnimationHit | null =>
    hitAnimation(hitContext(), pointIn(event))

  const seek = (time: Us): void => {
    const { timeline: held } = latest.current
    useSceneViews
      .getState()
      .setPlayhead(documentId, clampPlayhead(snapToFrame(time, held.fps), held.duration))
  }

  /**
   * Drops an animation onto the lane under the pointer, where it was let go. Only a lane accepts
   * one: a channel holds keys, and a subject line is the object itself.
   */
  const onDrop = (event: DragEvent<HTMLCanvasElement>): void => {
    const written = event.dataTransfer.getData(ANIMATION_DRAG_TYPE)
    if (!written) return

    event.preventDefault()
    const hit = hitAnimation(hitContext(), pointIn(event))
    if (!hit || hit.kind === 'ruler') return

    const row = latest.current.rows.find(candidate => candidate.id === hit.rowId)
    if (row?.kind !== 'lane') return

    const dropped = draggedAnimationOf(JSON.parse(written))
    if (!dropped) return

    const current = latest.current
    const at = clampPlayhead(
      snapToFrame(xToTime(pointIn(event).x, current.viewport), current.timeline.fps),
      current.timeline.duration,
    )

    // A shipped animation is laid down at once and read afterwards: the engine sees a block
    // naming a clip it has not got, loads it, retargets it, and the block starts playing.
    const start = Math.max(0, at)
    const laid =
      dropped.kind === 'embedded'
        ? embeddedClip(newId(), dropped.clip, { start })
        : bundledClip(newId(), dropped.name, { start })
    editLane(documentId, { ...row, clipId: laid.id }, clips => [...clips, laid])
    // Dropped is chosen: the inspector then describes what one has just laid down.
    useAnimationViews.getState().setPickedBlock(documentId, laid.id)
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

    if (hit.kind === 'block' || hit.kind === 'blockEdge') {
      grabbed.current =
        hit.kind === 'block'
          ? { kind: 'block', ...blockRefOf(hit), grabbedAt: hit.grabbedAt }
          : { kind: 'blockEdge', ...blockRefOf(hit), edge: hit.edge }
      // Opened here and closed on release: without it every pixel of the drag is its own entry
      // in the history, and `runCoalescing` only merges while a gesture is open.
      useScenes.getState().beginGesture(documentId)
      useAnimationViews.getState().setPickedBlock(documentId, hit.clipId)
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
      useAnimationViews.getState().setSelected(documentId, [hit.shotId])
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
      event.currentTarget.style.cursor = animationCursorAt(hitContext(), pointIn(event))
      return
    }

    // A pointerup lost off the window would otherwise leave the gesture open, and every later
    // edit of the same node would coalesce into it — one ⌘Z undoing two.
    if (event.buttons === 0) return closeGesture(event)

    const bounds = event.currentTarget.getBoundingClientRect()
    const current = latest.current
    // Held inside the band the way the head is: dragged past the end, a block would sit where the
    // head never goes and show a pose nothing can reach.
    const at = clampPlayhead(
      snapToFrame(xToTime(event.clientX - bounds.left, current.viewport), current.timeline.fps),
      current.timeline.duration,
    )

    if (grab.kind === 'scrub') return seek(at)

    // Written straight through rather than previewed: the block IS the preview, and the whole run
    // collapses into one entry because a gesture was opened on the press.
    if (grab.kind === 'block') {
      editLane(documentId, grab, clips =>
        clipsMoved(clips, grab.clipId, Math.max(0, at - grab.grabbedAt)),
      )
      return
    }

    if (grab.kind === 'blockEdge') {
      editLane(documentId, grab, clips =>
        clipsTrimmed(clips, grab.clipId, grab.edge, at, clipLengthOf(documentId, grab)),
      )
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

  /**
   * Closes whatever was open. Called from the release AND from a cancel — a gesture left open
   * makes the next edit of the same node coalesce into it.
   */
  const closeGesture = (event: PointerEvent<HTMLCanvasElement>): void => {
    const grab = grabbed.current
    grabbed.current = null
    if (!grab) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (grab.kind === 'block' || grab.kind === 'blockEdge' || grab.kind === 'shot') {
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
      // Without the `preventDefault` on drag-over the drop never fires at all.
      onDragOver={event => {
        if (!event.dataTransfer.types.includes(ANIMATION_DRAG_TYPE)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={onDrop}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      // Or a pointer that leaves mid-hover writes the resize cursor on the element for good.
      onPointerLeave={event => (event.currentTarget.style.cursor = '')}
      onPointerUp={closeGesture}
      onPointerCancel={closeGesture}
      onLostPointerCapture={closeGesture}
    />
  )
}
