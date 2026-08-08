import { mdiMusicNoteOutline, mdiPause, mdiPlay } from '@mdi/js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset, AssetType } from '@shared/domain/asset'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { EmptyState } from '@/design/EmptyState'
import { Toolbar } from '@/design/Toolbar'
import { durationOf } from '@/engines/audio/audio-data'
import type { RenderedAudio } from '@/engines/audio/audio-render'
import { clampRegion, pushEdit, type AudioEdit, type Region } from '@/engines/audio/edits'
import { canRedo, canUndo } from '@/engines/core/history'
import { formatDuration } from '@/engines/timeline/timecode'
import { SECOND, type Us } from '@/engines/timeline/timeline-state'
import { getBridge } from '@/services/bridge'
import { assetsById, useAssets } from '@/stores/assets'
import { audioEditsOf, audioHistoryOf, useAudioEdits } from '@/stores/audio-edits'
import { AUDIO_TOOLS, isAudioTool, type AudioToolId } from './audio-tools'
import { decodeAsset } from './decode'
import { loadTake } from './load-take'
import { useAudioRenderer } from './useAudioRenderer'
import { useWaveSurfer } from './useWaveSurfer'

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
  const waveform = useRef<HTMLDivElement>(null)

  const state = useAudioEdits(current => audioEditsOf(current, documentId))
  const history = useAudioEdits(current => audioHistoryOf(current, documentId))
  const byId = useAssets(assetsById)

  const renderer = useAudioRenderer()

  // Both tagged with the asset they belong to rather than reset when that changes: clearing
  // them would mean writing state from inside an effect, and would show the previous take for
  // one frame.
  const [loaded, setLoaded] = useState<{ assetId: string; ok: boolean } | null>(null)
  const [output, setOutput] = useState<{ assetId: string; audio: RenderedAudio } | null>(null)

  const asset = state.assetId ? (byId.get(state.assetId) ?? null) : null

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
      // Null means a newer render overtook this one, and its answer is the one worth showing.
      if (live && audio) setOutput({ assetId, audio })
    })

    return () => {
      live = false
    }
  }, [renderer, settled, state.assetId, state.edits, state.bypassed])

  const rendered = output?.assetId === state.assetId ? output.audio : null

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
    container: waveform,
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

  // The whole space takes a drop, empty or not: dropping a take onto the editor is how one
  // replaces what is loaded, and the empty state is where the first one lands.
  const takeDrop = (dropped: Asset): void => loadTake(documentId, dropped)

  if (!state.assetId) {
    return (
      <AssetDropTarget accepts={TAKES} onDrop={takeDrop} className="h-full">
        <EmptyState icon={mdiMusicNoteOutline} message={t('audio.noAsset')} />
      </AssetDropTarget>
    )
  }
  if (failed) return <EmptyState icon={mdiMusicNoteOutline} message={t('audio.unreadable')} />

  return (
    <AssetDropTarget
      accepts={TAKES}
      onDrop={takeDrop}
      className="flex h-full min-h-0 flex-col gap-2 p-2"
    >
      <div className="bg-chassis relative min-h-0 w-full flex-1">
        <div ref={waveform} className="absolute inset-0" />
        {!rendered && <EmptyState icon={mdiMusicNoteOutline} message={t('collection.loading')} />}
      </div>

      <Toolbar
        orientation="horizontal"
        tools={[
          {
            id: 'transport',
            labelKey: player.playing ? 'transport.pause' : 'transport.play',
            icon: player.playing ? mdiPause : mdiPlay,
            shortcut: 'Space',
          },
          ...AUDIO_TOOLS,
        ]}
        activeTool={state.bypassed ? 'compare' : undefined}
        onTool={id => (id === 'transport' ? player.toggle() : isAudioTool(id) && act(id))}
        onUndo={() => useAudioEdits.getState().undo(documentId)}
        onRedo={() => useAudioEdits.getState().redo(documentId)}
        canUndo={canUndo(history)}
        canRedo={canRedo(history)}
        extras={
          <span className="text-muted px-1 font-mono text-[11px]">
            {formatDuration(player.currentTime)}
            {rendered && ` / ${formatDuration(durationOf(rendered.data))}`}
          </span>
        }
      />
    </AssetDropTarget>
  )
}
