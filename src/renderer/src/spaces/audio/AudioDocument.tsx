import { mdiMusicNoteOutline, mdiPause, mdiPlay } from '@mdi/js'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset, AssetType } from '@shared/domain/asset'
import type { CommandId } from '@shared/domain/command'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { EmptyState } from '@/design/EmptyState'
import { Toolbar } from '@/design/Toolbar'
import { durationOf } from '@/engines/audio/audio-data'
import type { RenderedAudio } from '@/engines/audio/audio-render'
import { clampRegion, pushEdit, type AudioEdit, type Region } from '@/engines/audio/edits'
import { formatDuration } from '@/engines/timeline/timecode'
import { SECOND, type Us } from '@/engines/timeline/timeline-state'
import { useShortcuts } from '@/hooks/useShortcuts'
import { getBridge } from '@/services/bridge'
import { assetsById, useAssets } from '@/stores/assets'
import { audioEditsOf, audioHistoryOf, useAudioEdits } from '@/stores/audio-edits'
import { useSequences } from '@/stores/sequences'
import { canRedo, canUndo } from '@/engines/core/history'
import { useDocuments } from '@/stores/documents'
import { AUDIO_TOOLS, isAudioTool, type AudioToolId } from './audio-tools'
import { decodeAsset } from './decode'
import { loadTake } from './load-take'
import { useAudioRenderer } from './useAudioRenderer'
import { useWaveSurfer } from './useWaveSurfer'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'

export type AudioDocumentProps = { documentId: string }

/** What a fade tool lays down when no region says otherwise. */
const DEFAULT_FADE: Us = SECOND

const TAKES: readonly AssetType[] = ['audio']

/**
 * One take, edited.
 *
 * Nothing is written to disk until "apply" or "save as": every tool appends a step to the
 * chain, and what is heard is the chain replayed over the decoded source. That is what makes
 * undo free and A/B a boolean rather than a second copy of the audio.
 */
export function AudioDocument({ documentId }: AudioDocumentProps) {
  const { t } = useTranslation()
  // State rather than a ref, because the surface below is mounted only once a take is loaded:
  // a ref read on the first render is null and never announces its own arrival, which left the
  // waveform blank on every path that loads a take AFTER the editor is on screen.
  const [surface, setSurface] = useState<HTMLDivElement | null>(null)

  const state = useAudioEdits(current => audioEditsOf(current, documentId))
  const byId = useAssets(assetsById)
  const active = useDocuments(current => current.activeId === documentId)

  const renderer = useAudioRenderer()

  // Both tagged with the asset they belong to rather than reset when that changes: clearing
  // them would mean writing state from inside an effect, and would show the previous take for
  // one frame.
  const [loaded, setLoaded] = useState<{ assetId: string; ok: boolean } | null>(null)
  // The audio is nullable and that is the point: a render that answers nothing is how a dead
  // worker shows up here, and holding no entry at all for it would leave "loading" on screen
  // for as long as the tab lives.
  const [output, setOutput] = useState<{ assetId: string; audio: RenderedAudio | null } | null>(
    null,
  )

  const asset = state.assetId ? (byId.get(state.assetId) ?? null) : null

  useRestoredDocument(documentId)

  useEffect(() => {
    const assetId = state.assetId
    if (!assetId || !renderer) return

    let live = true
    decodeAsset(assetId)
      .then(source => {
        if (!live) return
        // The samples move into the worker here: nothing on this side reads them again.
        renderer.load(source)
        setLoaded({ assetId, ok: true })
      })
      .catch(() => {
        if (live) setLoaded({ assetId, ok: false })
      })

    // A tab closed mid-decode must not write into a component that is gone.
    return () => {
      live = false
    }
  }, [state.assetId, renderer])

  const settled = loaded?.assetId === state.assetId ? loaded : null
  const failed = settled?.ok === false

  // The chain is replayed in the worker, never here: five steps over a three-minute take is
  // 287 ms, and encoding the result another 206 ms — § 8.8 puts both off this thread.
  useEffect(() => {
    const assetId = state.assetId
    if (!renderer || !assetId || settled?.ok !== true) return

    let live = true
    void renderer.render(state.bypassed ? [] : state.edits).then(audio => {
      // `live` is what tells the two nulls apart. A render overtaken by a newer one was
      // overtaken because these deps changed, which ran the cleanup below first; a null that
      // still arrives on a live effect is the worker having died, and it has to be said.
      if (live) setOutput({ assetId, audio })
    })

    return () => {
      live = false
    }
  }, [renderer, settled, state.assetId, state.edits, state.bypassed])

  const answered = output?.assetId === state.assetId ? output : null
  const rendered = answered?.audio ?? null
  // Either half of the pipeline giving up leaves the same take unplayable, and says so the same
  // way — the decode, and the chain replayed over it.
  const unreadable = failed || answered?.audio === null

  const onRegionChange = useCallback(
    (region: Region | null) => {
      const store = useAudioEdits.getState()
      // The region is where one is looking, not an edit: it goes through `replace`, which
      // skips the history.
      store.replace(documentId, { ...audioEditsOf(store, documentId), region })
    },
    [documentId],
  )

  const player = useWaveSurfer({
    container: surface,
    rendered,
    owner: `audio:${documentId}`,
    onRegionChange,
  })

  const run = (edit: AudioEdit): void =>
    useAudioEdits.getState().runCommand(documentId, pushEdit(edit))

  const save = async (replaces: string | undefined): Promise<void> => {
    const bridge = getBridge()
    if (!bridge || !rendered || !asset) return

    await bridge.assets.saveAudio({
      ...(replaces ? { replaces } : { derivedFrom: asset.id }),
      name: replaces ? asset.name : t('audio.copyName', { name: asset.name }),
      // Already encoded, by the worker that replayed the chain.
      wav: rendered.wav,
    })
    await useAssets.getState().refresh()
  }

  const act = (id: AudioToolId): void => {
    const region = rendered && state.region ? clampRegion(state.region, rendered.data) : null

    switch (id) {
      case 'crop':
        // Only with a region: cropping to nothing would silently empty the take.
        if (region) run({ kind: 'crop', from: region.from, to: region.to })
        return
      case 'fadeIn':
        return run({
          kind: 'fade',
          edge: 'in',
          length: region ? region.to - region.from : DEFAULT_FADE,
        })
      case 'fadeOut':
        return run({
          kind: 'fade',
          edge: 'out',
          length: region ? region.to - region.from : DEFAULT_FADE,
        })
      case 'normalize':
        return run({ kind: 'normalize', targetLufs: -14 })
      case 'trimSilence':
        return run({ kind: 'trimSilence' })
      case 'compare': {
        const store = useAudioEdits.getState()
        const current = audioEditsOf(store, documentId)
        return store.replace(documentId, { ...current, bypassed: !current.bypassed })
      }
      case 'apply':
        void save(asset?.id)
        return
      case 'saveAs':
        void save(undefined)
        return
    }
  }

  /**
   * ⌘Z, for a document holding TWO stories: the chain over the take, and the sound montage under
   * it. One key, one document, so it has to choose — and it chooses the chain whenever the chain
   * has anything to give back, the montage otherwise.
   *
   * The montage cannot answer for itself: its own scope is `sequence`, and a second listener on
   * that scope would undo BOTH halves on one press — the studio's "two diverging undo stacks",
   * which is why `SoundPanel` mounts the strip with its shortcuts off.
   */
  const onCommand = useCallback(
    (command: CommandId) => {
      const takes = useAudioEdits.getState()
      const montage = useSequences.getState()

      if (command === 'audio.undo') {
        return canUndo(audioHistoryOf(takes, documentId))
          ? takes.undo(documentId)
          : montage.undo(documentId)
      }
      if (command === 'audio.redo') {
        return canRedo(audioHistoryOf(takes, documentId))
          ? takes.redo(documentId)
          : montage.redo(documentId)
      }
    },
    [documentId],
  )

  // Both the keyboard and the Edit menu land here. `enabled` for the same reason the scene
  // gives: Dockview keeps hidden tabs mounted, and a background take would eat ⌘Z.
  useShortcuts({ scope: 'audio', enabled: active, onCommand })

  // The whole space takes a drop, empty or not: dropping a take onto the editor is how one
  // replaces what is loaded, and the empty state is where the first one lands.
  const takeDrop = (dropped: Asset): void => loadTake(documentId, dropped)

  // A take that cannot be read lands here too, and it is why the drop target wraps both: an
  // editor that only says "undecodable" is a tab with no way out — the gesture that would
  // replace the take is the very one it stopped accepting.
  if (!state.assetId || unreadable) {
    return (
      <AssetDropTarget accepts={TAKES} onDrop={takeDrop} outlined={false} className="h-full">
        <EmptyState
          icon={mdiMusicNoteOutline}
          message={t(unreadable ? 'audio.unreadable' : 'audio.noAsset')}
        />
      </AssetDropTarget>
    )
  }

  return (
    <AssetDropTarget
      accepts={TAKES}
      onDrop={takeDrop}
      // No frame: see `ImageDocument`.
      outlined={false}
      className="flex h-full min-h-0 flex-col gap-2 p-2"
    >
      <div className="bg-chassis relative min-h-0 w-full flex-1">
        <div ref={setSurface} className="absolute inset-0" />
        {!rendered && <EmptyState icon={mdiMusicNoteOutline} message={t('collection.loading')} />}
      </div>

      <Toolbar
        orientation="horizontal"
        tools={[
          {
            id: 'transport',
            labelKey: player.playing ? 'transport.pause' : 'transport.play',
            icon: player.playing ? mdiPause : mdiPlay,
            shortcut: t('keys.Space'),
          },
          ...AUDIO_TOOLS,
        ]}
        activeTool={state.bypassed ? 'compare' : undefined}
        onTool={id => (id === 'transport' ? player.toggle() : isAudioTool(id) && act(id))}
        extras={
          <span className="text-muted text-tiny px-1 font-mono">
            {formatDuration(player.currentTime)}
            {rendered && ` / ${formatDuration(durationOf(rendered.data))}`}
          </span>
        }
      />
    </AssetDropTarget>
  )
}
