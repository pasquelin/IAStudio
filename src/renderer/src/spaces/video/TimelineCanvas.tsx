import type { CommandId } from '@shared/domain/command'
import { clamp } from '@shared/numeric'
import { mdiContentCut, mdiDeleteOutline, mdiLinkVariantOff } from '@mdi/js'
import { useCallback, useEffect, useRef, type DragEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { isTimeless, mediaDuration, posterUrl } from '@shared/domain/asset'
import type { Command } from '@/engines/core/history'
import {
  addClips,
  addClipsOnNewTracks,
  removeClip,
  splitClip,
  unlinkClip,
  type MediaExtent,
} from '@/engines/timeline/commands'
import {
  beginGesture,
  commandForGesture,
  viewportForGesture,
  type Gesture,
} from '@/engines/timeline/interactions'
import { newTracksForAsset, opensTrackFor, placementsForAsset } from '@/engines/timeline/insert'
import { paintTimeline, type PaintOptions } from '@/engines/timeline/painter'
import { cursorAt, hitTest, xToTime, type Viewport } from '@/engines/timeline/timelineGeometry'
import type { Point, Size } from '@/engines/core/geometry'
import { paintOn } from '@/engines/core/canvas2d'
import {
  clipById,
  clipEnd,
  clipUnderPlayhead,
  sequenceDuration,
  snapToFrame,
  type Clip,
  type SequenceState,
} from '@/engines/timeline/timelineState'
import {
  clampViewport,
  fitToWidth,
  revealTime,
  zoomAt,
  ZOOM_STEP,
} from '@/engines/timeline/viewport'
import { assetIdFromDrag, carriesAsset, draggedAssetType, droppedAsset } from '@/helpers/asset-drag'
import { cn } from '@/helpers/cn'
import { showContextMenu } from '@/helpers/context-menu'
import { cachedImage } from '@/helpers/image-cache'
import { carriesScene, droppedSceneId } from '@/helpers/scene-drag'
import { useRepaintOnResize } from '@/hooks/useRepaintOnResize'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useTimelineWheel } from '@/hooks/useTimelineWheel'
import { assetsById, useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { usePeaks } from '@/stores/peaks'
import { loadSceneSource, montageSceneOf } from '@/stores/scene-sources'
import { useSelection } from '@/stores/selection'
import { addSceneToSequence, sequenceOf, useSequences } from '@/stores/sequences'
import { useTimelineView, viewportOf } from '@/stores/timeline-view'
import { exportSequence } from './sequence-export'
import type { VideoToolId } from './video-tools'

export type TimelineCanvasProps = {
  documentId: string
  tool: VideoToolId
  /**
   * Whether ⌘Z and ⌘⇧Z belong to this strip.
   *
   * The host decides, and only for those two: a sound montage sits under a take that already
   * answers ⌘Z on its own scope, and two listeners undoing at once is one press taking a step
   * off BOTH halves of the document — the studio's oldest trap. Everything else the strip binds
   * — the blade, Delete, the zoom, the ends — stays live, or the one timeline this lot exists to
   * make consistent would be the only one with a dead keyboard.
   */
  history?: boolean
}

export function TimelineCanvas({ documentId, tool, history = true }: TimelineCanvasProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // The gesture and the state it started from: one history entry per gesture, not per pixel.
  const dragging = useRef<{ gesture: Gesture; base: SequenceState } | null>(null)

  const sequence = useSequences(state => sequenceOf(state, documentId))
  const viewport = useTimelineView(state => viewportOf(state, documentId))
  const byId = useAssets(assetsById)
  const stored = useDocuments(state => state.stored)

  // Read by `paint`, which must stay stable: rebuilding the observer on every dragged pixel
  // would tear down and re-create it sixty times a second.
  const latest = useRef<{ sequence: SequenceState; viewport: Viewport; options: PaintOptions }>({
    sequence,
    viewport,
    options: {},
  })
  const size = useRef<Size>({ width: 0, height: 0 })

  const paint = useCallback((): void => {
    paintOn(canvasRef.current, (context, box) => {
      size.current = box

      const current = latest.current
      paintTimeline(context, current.sequence, current.viewport, box, current.options)
    })
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

  // A scene clip has no catalogue row to be named after: it is the document's title that has to
  // show on the strip, or the block reads as empty.
  const nameOf = useCallback(
    (clip: Clip): string =>
      clip.sceneId
        ? (stored.find(document => document.id === clip.sceneId)?.title ?? clip.sceneId)
        : (byId.get(clip.assetId)?.name ?? clip.assetId),
    [byId, stored],
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

  // A trim stops where the media does, and only the catalogue knows how far that is.
  const mediaExtents = useCallback(
    (assetId: string): MediaExtent => {
      const asset = byId.get(assetId) ?? null
      const length = mediaDuration(asset)
      if (length !== null) return length
      // Null covers a picture and an asset nobody has probed; only the first has no source.
      return isTimeless(asset) ? 'still' : 'unknown'
    },
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

  useRepaintOnResize(canvasRef, paint)

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

  // The strip follows the playhead out of the frame — zoomed in, playing ran off the right edge
  // within seconds and the montage stayed on a moment nobody was watching any more.
  //
  // On the PLAYHEAD alone, and the viewport read out of the ref rather than depended on: woken
  // by the view as well, this pulled the strip back onto the playhead the instant the hand tool
  // dragged it away, and chased its own clamped write when there was nowhere left to scroll.
  useEffect(() => {
    // A strip that has not been laid out yet says nothing about what is on screen, and every
    // instant reads as off-frame against a width of zero.
    if (size.current.width === 0) return

    const current = latest.current.viewport
    // Identity, which `revealTime` guarantees while the playhead is inside the frame: a montage
    // that fits on screen must not scroll at all.
    const revealed = revealTime(current, sequence.playhead, size.current.width)
    if (revealed !== current) setViewport(revealed)
  }, [sequence.playhead, setViewport])

  // Native and non-passive: React delivers `wheel` passively, where `preventDefault` is a no-op
  // and the whole window scrolls behind the timeline instead.
  useTimelineWheel(canvasRef, () => latest.current.viewport, setViewport)

  const seek = useCallback(
    (time: number): void => {
      const store = useSequences.getState()
      const state = sequenceOf(store, documentId)
      const playhead = clamp(time, 0, sequenceDuration(state))
      // The strip follows on its own, from wherever the playhead lands — see the effect above.
      store.replace(documentId, { ...state, playhead })
    },
    [documentId],
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
        case 'sequence.export':
          void exportSequence({
            sequence: state,
            title: useDocuments.getState().documents[documentId]?.title ?? documentId,
          })
          return
        case 'sequence.unlink': {
          // Asked here rather than left to the command: every command run lands on the undo
          // stack, so a ⌘L on a clip that is tied to nothing would mark the document modified
          // and leave a ⌘Z that visibly does nothing.
          const linked = state.selectedId ? clipById(state, state.selectedId) : null
          if (linked?.linkId) store.runCommand(documentId, unlinkClip(linked.id))
          return
        }
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
        // Left alone where the host owns the history — see `history`. Not the same as being
        // absent: the key is still swallowed by this scope, and it is the host that answers it.
        case 'sequence.undo':
          return history ? store.undo(documentId) : undefined
        case 'sequence.redo':
          return history ? store.redo(documentId) : undefined
        default:
          return
      }
    },
    [documentId, history, seek, setViewport],
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
    // A right press raises the menu and must not start anything else. It arrives here first —
    // `pointerdown` precedes `contextmenu` — so the clip was picked up: it followed the pointer
    // while the menu was open, and the drag's own pointer-up then rewound the montage to where
    // the press began, over whatever the menu had just done. Delete looked like it moved the
    // clip and deleted nothing.
    //
    // `ctrlKey` with it: on macOS a control-click IS the context menu, and it reports button 0.
    if (event.button !== 0 || event.ctrlKey) return

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
    if (!current) {
      // Written straight to the node, the way `CanvasEngine` does it: this component keeps
      // everything that moves with the pointer out of React, and a hover is no exception.
      // Always written, empty included — skipping the write would leave a stale `ew-resize`
      // on the node after a tool change, where it would beat the hand's own class.
      // Only Selection trims: the hand moves the view and the blade cuts where it is pressed,
      // so promising either a trim would be a cursor the press then refuses.
      event.currentTarget.style.cursor =
        tool === 'select' ? cursorAt(sequence, viewport, pointAt(event)) : ''
      return
    }

    const point = pointAt(event)

    const view = viewportForGesture(current.gesture, point)
    if (view) return setViewport(view)

    if (current.gesture.kind === 'scrub') {
      scrubTo(current.base, point)
      return
    }

    const command = commandForGesture(current.gesture, current.base, viewport, point, mediaExtents)
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
      mediaExtents,
    )
    if (!command) return

    const store = useSequences.getState()
    // Rewind the preview first: the command has to apply to the state the gesture started from,
    // or undo would step back to a half-dragged clip.
    store.replace(documentId, current.base)
    store.runCommand(documentId, command)
  }

  /**
   * What can be done to the clip under the pointer, as the system's own menu.
   *
   * Everything here is also a shortcut, and that is the point: the keys were the ONLY way to
   * reach them, so a montage offered nothing to a right-click and nothing at all to whoever had
   * not learnt them. The labels are the commands' own, so a row and its key never drift apart.
   */
  const onContextMenu = (event: PointerEvent<HTMLCanvasElement>): void => {
    event.preventDefault()

    const store = useSequences.getState()
    const state = sequenceOf(store, documentId)
    const target = hitTest(state, viewport, pointAt(event))
    if (!target || !('clipId' in target)) return

    const clip = clipById(state, target.clipId)
    if (!clip) return

    // Selected first: the menu acts on this clip, and a menu whose rows edit something other
    // than what is highlighted is a menu nobody trusts.
    store.replace(documentId, { ...state, selectedId: clip.id })

    const run = (command: Command<SequenceState>) => (): void =>
      useSequences.getState().runCommand(documentId, command)

    void showContextMenu([
      {
        label: t('commands.sequenceSplit.title'),
        icon: mdiContentCut,
        tooltip: t('commands.sequenceSplit.help'),
        // At the playhead, exactly as the key does — the blade tool is what cuts at the pointer.
        disabled: state.playhead <= clip.start || state.playhead >= clipEnd(clip),
        onSelect: run(splitClip(clip.id, state.playhead)),
      },
      {
        label: t('commands.sequenceUnlink.title'),
        icon: mdiLinkVariantOff,
        tooltip: t('commands.sequenceUnlink.help'),
        // Greyed rather than dropped: a menu whose length follows the clip cannot be learnt.
        disabled: !clip.linkId,
        onSelect: run(unlinkClip(clip.id)),
      },
      {
        label: t('commands.sequenceDelete.title'),
        icon: mdiDeleteOutline,
        tooltip: t('commands.sequenceDelete.help'),
        onSelect: run(removeClip(clip.id)),
      },
    ])
  }

  const onDrop = (event: DragEvent<HTMLCanvasElement>): void => {
    event.preventDefault()

    const sceneId = droppedSceneId(event)
    if (sceneId) {
      const dropped = pointAt(event)
      const onto = hitTest(sequence, viewport, dropped)
      // The ruler scrubs; it lays nothing down, exactly as it refuses an asset.
      if (onto?.kind === 'ruler') return

      event.stopPropagation()
      addSceneToSequence(
        documentId,
        sceneId,
        // The scene's own animation is how long the shot lasts — read from whichever copy the
        // studio already holds, and left to the five-second default while its file is on its way.
        montageSceneOf(sceneId)?.animation.duration ?? null,
        xToTime(dropped.x, viewport),
        onto?.trackId,
      )
      // Asked for now so the clip has something to draw: without a tab holding it, nothing else
      // would ever read this document off disk.
      loadSceneSource(sceneId)
      return
    }

    const assetId = assetIdFromDrag(event)
    if (!assetId) return

    // Where it landed is read HERE and carried into the promise: both the pointer position and
    // `dataTransfer` are gone once this handler returns, so a library asset fetched first would
    // otherwise land wherever the cursor happened to be a download later.
    const point = pointAt(event)
    const target = hitTest(sequence, viewport, point)
    // Left to bubble on purpose: the ruler takes no clip, and a drop this surface does not use
    // is one the shell should still answer by opening the asset. Below the last row the same
    // holds for a kind no track would be opened for — a rush over a sound montage.
    if (target?.kind === 'ruler') return
    if (!target && !opensTrackFor(sequence, draggedAssetType(event))) return

    // Taken from here on — see `AssetDropTarget`, which consumes for the same reason.
    event.stopPropagation()

    const start = xToTime(point.x, viewport)
    const trackId = target?.trackId

    void droppedAsset(event).then(asset => {
      // Nothing to lay down: a library asset whose fetch was refused has no row, and a clip
      // pointing at one that was never written reads as missing media for good.
      if (!asset) return

      // `asset.id`, never the id the drag carried: a library drag carries the CLOUD id, and what
      // the import wrote is a catalogue row under an id of its own. A clip built on the first
      // names a row the project does not hold.
      //
      // Read out of the store rather than from the render's own `sequence`: a library asset is
      // fetched first, and the montage may have been edited while it came down.
      const store = useSequences.getState()
      const current = sequenceOf(store, documentId)

      // Landed below the last row: the drop opens the rows it needs rather than refusing — a
      // picture row, and the sound row beside it for a take that carries one.
      if (!trackId) {
        if (newTracksForAsset(current, asset).length > 0) {
          store.runCommand(documentId, addClipsOnNewTracks(asset, asset.id, start))
        }
        return
      }

      const placements = placementsForAsset(current, asset, asset.id, start, trackId)
      if (placements.length > 0) store.runCommand(documentId, addClips(placements))
    })
  }

  return (
    <canvas
      ref={canvasRef}
      tabIndex={0}
      className={cn(
        'block h-full w-full outline-none',
        tool === 'hand' && 'cursor-grab active:cursor-grabbing',
      )}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      // A pointer that leaves mid-hover would otherwise leave the resize cursor written on the
      // node, and the surface would wear it until another move cleared it.
      onPointerLeave={event => (event.currentTarget.style.cursor = '')}
      // Not `AssetDropTarget`: what this surface accepts is decided per track, and one outline
      // over the whole timeline would promise the ruler takes what it refuses. Only the half
      // that has nothing to do with tracks is shared — preventing a drag we do not carry is
      // what makes a surface swallow files dragged in from the desktop.
      onDragOver={event => {
        if (carriesAsset(event) || carriesScene(event)) event.preventDefault()
      }}
      onDrop={onDrop}
    />
  )
}
