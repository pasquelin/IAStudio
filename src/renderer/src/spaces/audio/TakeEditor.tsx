import { mdiMusicNoteOutline, mdiPause, mdiPlay } from '@mdi/js'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset, AssetType } from '@shared/domain/asset'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { EmptyState } from '@/design/EmptyState'
import { Toolbar } from '@/design/Toolbar'
import { durationOf } from '@/engines/audio/audio-data'
import type { RenderedAudio } from '@/engines/audio/audio-render'
import {
  clampRegion,
  EMPTY_AUDIO_EDIT,
  pushEdit,
  type AudioEdit,
  type Region,
} from '@/engines/audio/edits'
import { formatDuration } from '@/engines/timeline/timecode'
import { SECOND, type Us } from '@/engines/timeline/timeline-state'
import { getBridge } from '@/services/bridge'
import { assetsById, useAssets } from '@/stores/assets'
import { audioEditsOf, useAudioEdits } from '@/stores/audio-edits'
import { writeTakeClip } from '@/stores/sequences'
import { AUDIO_TOOLS, isAudioTool, type AudioToolId } from './audio-tools'
import { decodeAsset } from '@/helpers/audio-decode'
import { loadTake } from './load-take'
import { MonitorFrame } from './MonitorFrame'
import { useAudioRenderer } from './useAudioRenderer'
import { useWaveSurfer } from './useWaveSurfer'

export type TakeEditorProps = { documentId: string }

/** What a fade tool lays down when no region says otherwise. */
const DEFAULT_FADE: Us = SECOND

const TAKES: readonly AssetType[] = ['audio']

/**
 * One take, edited — the source half of the pair.
 *
 * Nothing is written to disk until "apply" or "save as": every tool appends a step to the
 * chain, and what is heard is the chain replayed over the decoded source. That is what makes
 * undo free and A/B a boolean rather than a second copy of the audio.
 */
export function TakeEditor({ documentId }: TakeEditorProps) {
  const { t } = useTranslation()
  // State rather than a ref, because the surface below is mounted only once a take is loaded:
  // a ref read on the first render is null and never announces its own arrival, which left the
  // waveform blank on every path that loads a take AFTER the editor is on screen.
  const [surface, setSurface] = useState<HTMLDivElement | null>(null)

  const state = useAudioEdits(current => audioEditsOf(current, documentId))
  const byId = useAssets(assetsById)

  const renderer = useAudioRenderer()

  // Both tagged with the asset they belong to rather than reset when that changes: clearing
  // them would mean writing state from inside an effect, and would show the previous take for
  // one frame.
  const [loaded, setLoaded] = useState<{ assetId: string; ok: boolean } | null>(null)
  // Tagged with the SIDE of A/B it was asked for as well as with its asset: a bypassed render is
  // asked for an empty chain, so its shape is the whole untouched take. Read without that tag,
  // the press that comes back OFF bypass writes the answer of the press that went on.
  const [output, setOutput] = useState<{
    assetId: string
    bypassed: boolean
    audio: RenderedAudio | null
  } | null>(null)
  // Bumped by "apply", which rewrites the take under its own id: nothing else would tell the
  // decode below that the bytes it read are no longer the ones on disk.
  const [reread, setReread] = useState(0)

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
  }, [state.assetId, renderer, reread])

  const settled = loaded?.assetId === state.assetId ? loaded : null
  const failed = settled?.ok === false

  // The chain is replayed in the worker, never here: five steps over a three-minute take is
  // 287 ms, and encoding the result another 206 ms — § 8.8 puts both off this thread.
  useEffect(() => {
    const assetId = state.assetId
    if (!renderer || !assetId || settled?.ok !== true) return

    const bypassed = state.bypassed
    let live = true
    void renderer.render(bypassed ? [] : state.edits).then(audio => {
      // `live` is what tells the two nulls apart. A render overtaken by a newer one was
      // overtaken because these deps changed, which ran the cleanup below first; a null that
      // still arrives on a live effect is the worker having died, and it has to be said.
      if (live) setOutput({ assetId, bypassed, audio })
    })

    return () => {
      live = false
    }
  }, [renderer, settled, state.assetId, state.edits, state.bypassed])

  const answered = output?.assetId === state.assetId ? output : null
  const rendered = answered?.audio ?? null

  /**
   * What ties the two halves of this document: the clip on the strip below is this very take,
   * and every edit above has to reach it.
   *
   * Read off the ANSWER's own tag rather than off the current state, and that is not a detail. A
   * bypassed render is asked for an empty chain, so its shape is the whole untouched take; the
   * press that comes back off bypass re-runs this before its own render has landed, and reading
   * `state.bypassed` here would write the answer of the press that went ON. One press would
   * stretch the clip back to the source, turning a listening aid into an edit of the montage.
   */
  useEffect(() => {
    if (!answered || answered.bypassed) return

    const shape = answered.audio?.shape
    if (state.takeClipId && shape) writeTakeClip(documentId, state.takeClipId, shape)
  }, [documentId, state.takeClipId, answered])

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

  /**
   * What "apply" leaves behind: the file on disk now HOLDS the chain, so the chain has to go.
   *
   * Replaying it over the new bytes would lay every fade and gain down a second time — and the
   * montage clip below, which carries them too, would then play them a third. The take is read
   * again for the same reason: the samples in the worker are the file as it was.
   *
   * The history goes with it, exactly as it does when another take is loaded: a step undone
   * after "apply" would describe a length the file no longer has. This is the one destructive
   * button of the editor, and it says so.
   */
  const applied = (): void => {
    const store = useAudioEdits.getState()
    const { assetId, takeClipId } = audioEditsOf(store, documentId)
    store.drop(documentId)
    store.replace(documentId, { ...EMPTY_AUDIO_EDIT, assetId, takeClipId })
    setReread(count => count + 1)
  }

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
    if (replaces) applied()
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

  // This half takes a drop, empty or not: dropping a take onto the editor is how one replaces
  // what is loaded, and the empty state is where the first one lands.
  const takeDrop = (dropped: Asset): void => loadTake(documentId, dropped)

  // A take that cannot be read lands here too, and it is why the drop target wraps both: an
  // editor that only says "undecodable" is a half with no way out — the gesture that would
  // replace the take is the very one it stopped accepting.
  if (!state.assetId || unreadable) {
    return (
      <AssetDropTarget accepts={TAKES} onDrop={takeDrop} outlined={false} className="flex flex-1">
        <MonitorFrame role={t('audio.takeRole')} toolbar={null}>
          <EmptyState
            icon={mdiMusicNoteOutline}
            message={t(unreadable ? 'audio.unreadable' : 'audio.noAsset')}
          />
        </MonitorFrame>
      </AssetDropTarget>
    )
  }

  return (
    <AssetDropTarget
      accepts={TAKES}
      onDrop={takeDrop}
      // No frame: see `ImageDocument`.
      outlined={false}
      className="flex min-h-0 flex-1"
    >
      <MonitorFrame
        role={t('audio.takeRole')}
        toolbar={
          <Toolbar
            orientation="horizontal"
            tools={[
              {
                id: 'transport',
                labelKey: player.playing ? 'transport.pause' : 'transport.play',
                icon: player.playing ? mdiPause : mdiPlay,
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
        }
      >
        <div ref={setSurface} className="absolute inset-0" />
        {!rendered && <EmptyState icon={mdiMusicNoteOutline} message={t('collection.loading')} />}
      </MonitorFrame>
    </AssetDropTarget>
  )
}
