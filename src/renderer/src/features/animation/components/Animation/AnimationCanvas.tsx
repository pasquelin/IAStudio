import { mdiContentCut, mdiContentDuplicate, mdiDeleteOutline, mdiPlaylistRemove } from '@mdi/js'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { showContextMenu } from '@/helpers/contextMenu'
import { frameDuration, snapToFrame, type Us } from '@shared/domain/time'
import {
  editCameraShot,
  moveAnimationKey,
  takeOffAnimationSheet,
  unkeySubject,
} from '@/engines/scene/animationCommands'
import { removePickedShot } from '@/features/scene/components/sceneCommands'
import { draggedShot } from '@/engines/scene/cameraShots'
import { assetClip, bundledClip, clipKeyOf, embeddedClip, type ClipRef } from '@shared/domain/scene'
import { draggedAssetType, droppedAsset } from '@/helpers/assetDrag'
import { newId } from '@/helpers/ids'
import { ANIMATION_DRAG_TYPE, draggedAnimationOf } from '@/features/animation/components/dragged'
import { sceneNodeDrag } from '@/features/scene/components/dragged'
import { multi, removeModelClip, setModelLanes } from '@/engines/scene/commands'
import {
  clipsDuplicated,
  clipsMoved,
  clipsSplit,
  clipsTrimmed,
  laneHolding,
  lanesWith,
} from '@/engines/scene/clipBlend'
import { useModelFiles } from '@/stores/modelFiles'
import type { Command } from '@/engines/core/history'
import type { SceneState } from '@/engines/scene/sceneState'
import { clampPlayhead } from '@/engines/scene/animationEval'
import {
  animationCursorAt,
  hitAnimation,
  type AnimationHit,
  type HitContext,
} from '@/engines/timeline/bandHit'
import type { Point } from '@/engines/core/geometry'
import { paintAnimation, keyId, keyParts } from '@/engines/timeline/bandPainter'
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
import { createFrameCoalesce } from '@/engines/core/frameCoalesce'
import { trackIdsOf } from '@/engines/scene/animationRows'
import { type AnimationRow } from '@/engines/timeline/bandRows'
import { clamp } from '@shared/numeric'
import { animationViewOf, keySetOf, useAnimationViews } from '@/stores/animationView'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useScenePlayhead, useSceneViews } from '@/stores/sceneViews'

export type AnimationCanvasProps = {
  documentId: string
  rows: readonly AnimationRow[]
}

/** Which block of which lane a gesture is editing. */
type BlockRef = { nodeId: string; laneId: string; clipId: string }

/**
 * Whether what is flying holds motion this band could play.
 *
 * A model as well as an animation: a `.glb` carries either, and which one it is cannot be known
 * before the drop — `getData` answers nothing until then. What lands is read for its CLIPS and
 * its mesh never enters the scene, so taking a character here costs a file read and nothing else.
 */
function carriesMotion(event: { dataTransfer: DataTransfer | null }): boolean {
  const kind = draggedAssetType(event)
  return kind === 'mesh' || kind === 'animation'
}

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

/** Which model and lane hold a block, since the band remembers the chosen one by its id alone. */
function blockOf(documentId: string, clipId: string): BlockRef | null {
  for (const node of sceneOf(useScenes.getState(), documentId).nodes) {
    if (node.type !== 'model') continue

    const lane = laneHolding(node.model.lanes ?? [], clipId)
    if (lane) return { nodeId: node.id, laneId: lane.id, clipId }
  }

  return null
}

/** The blocks of the lane a reference names, or nothing once the model or the lane has gone. */
function laneClipsOf(documentId: string, where: BlockRef): readonly ClipRef[] | null {
  const node = sceneOf(useScenes.getState(), documentId).nodes.find(
    candidate => candidate.id === where.nodeId,
  )
  if (node?.type !== 'model') return null

  return node.model.lanes?.find(lane => lane.id === where.laneId)?.clips ?? null
}

/** How long the clip a block plays runs in the file, which is what a trim is measured against. */
function clipLengthOf(documentId: string, where: BlockRef): number | null {
  const clip = laneClipsOf(documentId, where)?.find(candidate => candidate.id === where.clipId)

  return clip
    ? (useModelFiles.getState().lengths[documentId]?.[where.nodeId]?.[clipKeyOf(clip.source)] ??
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
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const grabbed = useRef<Grab | null>(null)
  const scrubCoalesce = useRef(createFrameCoalesce())

  const timeline = useScenes(state => sceneOf(state, documentId).animation)
  const playhead = useScenePlayhead(documentId)
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

  // A gesture cut short by an unmount must not drop the head it ended on.
  useEffect(() => {
    const coalesce = scrubCoalesce.current
    return () => coalesce.flush()
  }, [])

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

  const dropBlock = (where: BlockRef): void => {
    useScenes.getState().runCommand(documentId, removeModelClip(where.nodeId, where.clipId))
    useAnimationViews.getState().setPickedBlock(documentId, null)
  }

  const duplicateBlock = (where: BlockRef): void =>
    editLane(documentId, where, clips =>
      clipsDuplicated(clips, where.clipId, newId(), clipLengthOf(documentId, where)),
    )

  /** Cut where the head stands, which is the montage's own gesture and the only mark on screen. */
  const splitAt = (clips: readonly ClipRef[], where: BlockRef): readonly ClipRef[] | null =>
    clipsSplit(
      clips,
      where.clipId,
      latest.current.playhead,
      newId(),
      clipLengthOf(documentId, where),
    )

  const splitBlock = (where: BlockRef): void =>
    editLane(documentId, where, clips => splitAt(clips, where))

  /** The three gestures a block answers to, or `false` when the key meant something else. */
  const blockKey = (event: ReactKeyboardEvent<HTMLCanvasElement>, where: BlockRef): boolean => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      dropBlock(where)
      return true
    }
    if (event.code === 'KeyD' && (event.metaKey || event.ctrlKey)) {
      duplicateBlock(where)
      return true
    }
    if (event.code === 'KeyS' && !event.metaKey && !event.ctrlKey) {
      splitBlock(where)
      return true
    }

    return false
  }

  /**
   * Removes what is picked. Bound on the canvas rather than on a global scope: the band is one
   * surface among several that answer to Delete, and a key must not vanish because a viewport
   * happened to have focus.
   */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLCanvasElement>): void => {
    // A block and a key are never both picked — `setPickedBlock` empties the other — so Delete
    // has one answer, and the block is asked first because it is the one that carries more keys.
    const block = latest.current.picked ? blockOf(documentId, latest.current.picked) : null
    if (block && blockKey(event, block)) return event.preventDefault()

    if (event.key !== 'Delete' && event.key !== 'Backspace') return

    // The door the native Édition menu already takes, rather than a second reading of the same
    // pick: `Delete` is an accelerator and never reaches here, so only `Backspace` ever does —
    // and a shot taken away by one key and not the other would be nobody's intent.
    if (removePickedShot(documentId)) return event.preventDefault()

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
   * Whether a cut at the head would give two halves. Asked of the arithmetic that will do it
   * rather than repeated here — the answer must not drift from what the gesture then refuses.
   */
  const cuttable = (where: BlockRef): boolean => {
    const clips = laneClipsOf(documentId, where)
    return clips !== null && splitAt(clips, where) !== null
  }

  /** The three block gestures, where a key alone would leave them undiscoverable. */
  const onContextMenu = (event: ReactMouseEvent<HTMLCanvasElement>): void => {
    const hit = hitAnimation(hitContext(), pointIn(event))

    // A subject line: the one thing to do with it is to take it off the band. `takeOff` answers
    // nothing for a line the sheet does not name — a bone, or an object here because it holds a
    // track — and no menu opens, which is the honest answer rather than a row that does nothing.
    // `key` and `shot` as well as `row`: `hitAnimation` answers those the moment the pointer is
    // within reach of a key or over a camera's bar, so a densely keyed line — the one most likely
    // to be taken off — could not be right-clicked at all.
    if (hit && hit.kind !== 'block' && hit.kind !== 'blockEdge' && hit.kind !== 'ruler') {
      const row = latest.current.rows.find(candidate => candidate.id === hit.rowId)
      // A channel and a lane belong to the object above them: neither is a line one takes off.
      if (row?.kind !== 'subject') return
      const command = takeOffAnimationSheet(sceneOf(useScenes.getState(), documentId), [hit.rowId])
      // A camera holding a shot keeps its line whatever the sheet says — `animationRows` pushes
      // it on its own — so taking it off would bank an undo and change nothing on screen.
      if (!command || row.bars) return

      event.preventDefault()
      void showContextMenu([
        {
          label: t('animation.removeFromSheet', { name: row.name }),
          icon: mdiPlaylistRemove,
          tooltip: t('animation.removeFromSheetHint'),
          onSelect: () => useScenes.getState().runCommand(documentId, command),
        },
      ])
      return
    }

    if (hit?.kind !== 'block') return

    event.preventDefault()
    // Chosen first: a menu acting on something other than what the band shows as chosen is a
    // menu nobody trusts.
    const where = blockRefOf(hit)
    useAnimationViews.getState().setPickedBlock(documentId, where.clipId)

    void showContextMenu([
      {
        label: t('animations.duplicateBlock'),
        icon: mdiContentDuplicate,
        tooltip: t('animations.duplicateBlockHint'),
        onSelect: () => duplicateBlock(where),
      },
      {
        label: t('animations.splitBlock'),
        icon: mdiContentCut,
        tooltip: t('animations.splitBlockHint'),
        // Greyed rather than dropped, as the montage's own cut is: a menu whose length follows
        // the playhead cannot be learnt.
        disabled: !cuttable(where),
        onSelect: () => splitBlock(where),
      },
      {
        label: t('animations.removeBlock'),
        icon: mdiDeleteOutline,
        tooltip: t('animations.removeBlockHint'),
        onSelect: () => dropBlock(where),
      },
    ])
  }

  /**
   * Drops an animation onto the lane under the pointer, where it was let go. Only a lane accepts
   * one: a channel holds keys, and a subject line is the object itself.
   */
  const onDrop = (event: DragEvent<HTMLCanvasElement>): void => {
    // Objects from the outliner are NOT read here: the panel takes them, because an empty band
    // draws no canvas and that is exactly when a first object is dropped. Left alone, they bubble.
    if (sceneNodeDrag.carries(event)) return

    const written = event.dataTransfer.getData(ANIMATION_DRAG_TYPE)
    // Started before anything else is worked out: a `DragEvent` is recycled once the handler
    // returns, so `droppedAsset` has to read it now even though it answers later.
    const flying = written || !carriesMotion(event) ? null : droppedAsset(event)
    if (!written && !flying) return

    event.preventDefault()
    const hit = hitAnimation(hitContext(), pointIn(event))
    if (!hit || hit.kind === 'ruler') return

    const row = latest.current.rows.find(candidate => candidate.id === hit.rowId)
    if (row?.kind !== 'lane') return

    const current = latest.current
    const at = clampPlayhead(
      snapToFrame(xToTime(pointIn(event).x, current.viewport), current.timeline.fps),
      current.timeline.duration,
    )
    const start = Math.max(0, at)

    // A block is laid down at once and read afterwards: the engine sees one naming a clip it has
    // not got, loads it, retargets it, and the block starts playing.
    const lay = (laid: ClipRef): void => {
      editLane(documentId, { ...row, clipId: laid.id }, clips => [...clips, laid])
      // Dropped is chosen: the inspector then describes what one has just laid down.
      useAnimationViews.getState().setPickedBlock(documentId, laid.id)
    }

    if (flying) {
      // The mesh the file also holds never enters the scene — what was asked for is the motion.
      void flying.then(asset => asset && lay(assetClip(newId(), asset.id, asset.name, { start })))
      return
    }

    const dropped = draggedAnimationOf(JSON.parse(written))
    if (!dropped) return

    lay(
      dropped.kind === 'embedded'
        ? embeddedClip(newId(), dropped.clip, { start })
        : bundledClip(newId(), dropped.name, { start }),
    )
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

    // One head per frame: a pointermove is faster than a paint, and every subject row beside the
    // band reads the head — the montage's own strip coalesces its scrub for the same reason.
    if (grab.kind === 'scrub') return scrubCoalesce.current.schedule(at, seek)

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

    // The frame owed by the last pointermove, paid HERE: left pending, it lands after the press
    // that follows and overwrites the head that press had just set.
    if (grab.kind === 'scrub') scrubCoalesce.current.flush()

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
        const carried =
          event.dataTransfer.types.includes(ANIMATION_DRAG_TYPE) ||
          sceneNodeDrag.carries(event) ||
          carriesMotion(event)
        if (!carried) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
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
