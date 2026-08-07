import { mdiMusicNoteOutline, mdiPause, mdiPlay } from '@mdi/js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { Toolbar } from '@/design/Toolbar'
import { durationOf, type AudioData } from '@/engines/audio/audio-data'
import {
  clampRegion,
  pushEdit,
  renderEdits,
  type AudioEdit,
  type Region,
} from '@/engines/audio/edits'
import { encodeWav } from '@/engines/audio/wav'
import { canRedo, canUndo } from '@/engines/core/history'
import { formatDuration } from '@/engines/timeline/timecode'
import { SECOND, type Us } from '@/engines/timeline/timeline-state'
import { getBridge } from '@/services/bridge'
import { useAssets } from '@/stores/assets'
import { audioEditsOf, audioHistoryOf, useAudioEdits } from '@/stores/audio-edits'
import { AUDIO_TOOLS, isAudioTool, type AudioToolId } from './audio-tools'
import { decodeAsset } from './decode'
import { useWaveSurfer } from './useWaveSurfer'

export type AudioDocumentProps = { documentId: string }

/** What a fade tool lays down when no region says otherwise. */
const DEFAULT_FADE: Us = SECOND

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
  const assets = useAssets(current => current.items)

  // Tagged with the asset it belongs to rather than reset when that changes: clearing it would
  // mean writing state from inside an effect, and would show the previous take for one frame.
  const [decoded, setDecoded] = useState<{ assetId: string; data: AudioData | null } | null>(null)

  const asset = assets.find(candidate => candidate.id === state.assetId) ?? null

  useEffect(() => {
    const assetId = state.assetId
    if (!assetId) return

    let live = true
    decodeAsset(assetId)
      .then(data => {
        if (live) setDecoded({ assetId, data })
      })
      .catch(() => {
        if (live) setDecoded({ assetId, data: null })
      })

    // A tab closed mid-decode must not write into a component that is gone.
    return () => {
      live = false
    }
  }, [state.assetId])

  const current = decoded?.assetId === state.assetId ? decoded : null
  const source = current?.data ?? null
  const failed = current !== null && current.data === null

  // Only what `audibleData` actually reads. Keyed on the whole state it would replay the chain
  // on every pointer move of a region drag — seventy megabytes, on the UI thread.
  const rendered = useMemo(
    () => (source ? renderEdits(source, state.bypassed ? [] : state.edits) : null),
    [source, state.edits, state.bypassed],
  )

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
    data: rendered,
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
      wav: encodeWav(rendered),
    })
    await useAssets.getState().refresh()
  }

  const act = (id: AudioToolId): void => {
    const region = rendered && state.region ? clampRegion(state.region, rendered) : null

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

  if (!state.assetId) {
    return <EmptyState icon={mdiMusicNoteOutline} message={t('audio.noAsset')} />
  }
  if (failed) return <EmptyState icon={mdiMusicNoteOutline} message={t('audio.unreadable')} />

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 p-2">
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
            {rendered && ` / ${formatDuration(durationOf(rendered))}`}
          </span>
        }
      />
    </section>
  )
}
