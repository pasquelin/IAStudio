import { mdiMusicNoteOutline, mdiPause, mdiPlay } from '@mdi/js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset, AssetType } from '@shared/domain/asset'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { EmptyState } from '@/design/EmptyState'
import { MonitorFrame } from '@/design/MonitorFrame'
import { TOOLBAR_LABEL } from '@/design/styles'
import { Toolbar } from '@/design/Toolbar'
import { durationOf, silentBounds } from '@/engines/audio/audio-data'
import type { RenderedAudio } from '@/engines/audio/audio-render'
import {
  chainOf,
  clampRegion,
  cropShape,
  EMPTY_TAKE_CHAIN,
  pushEdit,
  takeSliceOf,
  withChain,
  type AudioEdit,
  type Region,
} from '@/engines/audio/edits'
import { formatDuration } from '@/engines/timeline/timecode'
import { SECOND, trackOfClip, type Us } from '@/engines/timeline/timeline-state'
import { cn } from '@/helpers/cn'
import { getBridge } from '@/services/bridge'
import { assetsById, useAssets } from '@/stores/assets'
import { audioEditsOf, useAudioEdits } from '@/stores/audio-edits'
import {
  flattenTakeClip,
  sequenceOf,
  trimTakeClip,
  useSequences,
  writeTakeClip,
} from '@/stores/sequences'
import { AUDIO_TOOLS, isAudioTool, type AudioToolId } from './audio-tools'
import { decodeAsset } from '@/helpers/audio-decode'
import { loadTake } from './load-take'
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

  const sequence = useSequences(current => sequenceOf(current, documentId))
  const edits = useAudioEdits(current => audioEditsOf(current, documentId))
  const byId = useAssets(assetsById)

  /**
   * The block the montage has selected — the same derivation the Video workspace's source
   * monitor makes, and for the same reason: what one selected is what one is looking at.
   *
   * Sound blocks only. The tools below rebuild samples, and a picture clip has none to rebuild;
   * an Audio montage holds nothing else today, and this says so rather than relying on it.
   */
  const holder = sequence.selectedId ? trackOfClip(sequence, sequence.selectedId) : null
  const clip =
    holder?.kind === 'audio'
      ? (holder.clips.find(one => one.id === sequence.selectedId) ?? null)
      : null
  const clipId = clip?.id ?? null
  const chain = chainOf(edits, clipId)

  /**
   * What the chain is replayed over: the block's slice of its take, never the whole file.
   *
   * Memoised on the clip itself, which `find` hands back by reference out of the montage — so a
   * render is asked for again when the strip moves the block's edges, and not on every paint.
   */
  const slice = useMemo(() => (clip ? takeSliceOf(clip) : null), [clip])

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
  const assetId = clip?.assetId ?? null
  const asset = assetId ? (byId.get(assetId) ?? null) : null

  useEffect(() => {
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
    // "Apply" writes a NEW asset and repoints the block at it, so the id changing is what asks
    // for the fresh bytes — where it used to take a counter, the file having been replaced
    // under an id that never moved.
  }, [assetId, renderer])

  const settled = loaded?.assetId === assetId ? loaded : null
  const failed = settled?.ok === false

  // The chain is replayed in the worker, never here: five steps over a three-minute take is
  // 287 ms, and encoding the result another 206 ms — § 8.8 puts both off this thread.
  useEffect(() => {
    if (!renderer || !assetId || !slice || settled?.ok !== true) return

    const bypassed = chain.bypassed
    let live = true
    void renderer.render(bypassed ? [] : chain.edits, slice).then(audio => {
      // `live` is what tells the two nulls apart. A render overtaken by a newer one was
      // overtaken because these deps changed, which ran the cleanup below first; a null that
      // still arrives on a live effect is the worker having died, and it has to be said.
      if (live) setOutput({ assetId, bypassed, audio })
    })

    return () => {
      live = false
    }
  }, [renderer, settled, assetId, slice, chain.edits, chain.bypassed])

  const answered = output?.assetId === assetId ? output : null
  const rendered = answered?.audio ?? null

  /**
   * What ties the editor to the block it edits: the ramps and the level the chain came to,
   * written onto it. The bounds ride along untouched — the chain is replayed FROM them.
   *
   * Written only for a block the chain OWNS, and an entry in `chains` is exactly that: the tools
   * have touched this block at least once. What that guards is no longer a length, it is those
   * two fields. A block nobody has edited answers an empty chain, an empty chain projects no
   * ramp and no level, and writing that back would wipe a fade and a gain laid by hand on the
   * strip — on the mere opening of the document, before anyone has clicked anything. A count of
   * steps is the wrong question for the same reason a chain empties on purpose: "apply" empties
   * it to lay the block flat over a file that now holds everything it described.
   *
   * Bypass is that hazard reached from the other side, which is why it is read off the ANSWER's
   * own tag rather than off the current state. A bypassed render is asked for an empty chain,
   * and the press that comes back OFF bypass re-runs this before its own render has landed;
   * reading `chain.bypassed` here would write the answer of the press that went ON. One press,
   * and a listening aid would flatten the block on the strip.
   */
  const owned = clipId !== null && clipId in edits.chains

  useEffect(() => {
    if (!answered || answered.bypassed || !owned) return

    const shape = answered.audio?.shape
    if (clipId && shape) writeTakeClip(documentId, clipId, shape)
  }, [documentId, clipId, owned, answered])

  // Either half of the pipeline giving up leaves the same take unplayable, and says so the same
  // way — the decode, and the chain replayed over it.
  const unreadable = failed || answered?.audio === null

  const onRegionChange = useCallback(
    (region: Region | null) => {
      if (!clipId) return

      const store = useAudioEdits.getState()
      const current = audioEditsOf(store, documentId)
      // The region is where one is looking, not an edit: it goes through `replace`, which
      // skips the history.
      store.replace(documentId, withChain(current, clipId, { ...chainOf(current, clipId), region }))
    },
    [documentId, clipId],
  )

  const player = useWaveSurfer({
    container: surface,
    rendered,
    owner: `audio:${documentId}`,
    onRegionChange,
  })

  const run = (edit: AudioEdit): void => {
    if (!clipId) return
    useAudioEdits.getState().runCommand(documentId, pushEdit(clipId, edit))
  }

  /**
   * What "apply" leaves behind, once the block points at the flattened file: the chain is IN
   * those bytes, so the chain has to go. Replaying it over them would lay every fade and gain
   * down a second time — and the block below, which carries them too, a third.
   *
   * The history goes with it, and it is the DOCUMENT's: a step undone after "apply" would
   * describe a take the block no longer holds, and history cannot be unwound for one block only.
   * The other blocks keep their chains — only their undo goes. This is the one irreversible
   * button of the editor, and it says so.
   */
  const applied = (): void => {
    const store = useAudioEdits.getState()
    const current = audioEditsOf(store, documentId)
    const kept = clipId ? withChain(current, clipId, EMPTY_TAKE_CHAIN) : current
    store.drop(documentId)
    store.replace(documentId, kept)
  }

  /**
   * Both buttons write a DERIVED asset and neither touches the source, which is what "apply" now
   * differs on: it used to replace the file under its own id. A take is one asset behind however
   * many blocks — in this montage and in every other document open on the project — and rewriting
   * it moved every one of them at once, silently, to bytes only this block had asked for.
   *
   * "Apply" then repoints THIS block at what it just wrote, laid flat; "save as" leaves the
   * montage exactly as it was and only adds to the shelf.
   */
  const save = async (flatten: boolean): Promise<void> => {
    const bridge = getBridge()
    if (!bridge || !rendered || !asset) return

    const written = await bridge.assets.saveAudio({
      derivedFrom: asset.id,
      name: t('audio.copyName', { name: asset.name }),
      // Already encoded, by the worker that replayed the chain.
      wav: rendered.wav,
    })
    await useAssets.getState().refresh()
    if (!flatten || !clipId) return

    flattenTakeClip(documentId, clipId, written.id, durationOf(rendered.data))
    applied()
  }

  // What the tools will act on, and what the bar says they will: read through one clamp rather
  // than two, so a range the take no longer holds — a crop having shortened it under a selection
  // laid before — cannot be announced as one and ignored as another.
  const region = rendered && chain.region ? clampRegion(chain.region, rendered.data) : null

  /**
   * The two tools that CUT, which is a montage gesture wherever it is made from: they land on
   * the block's own bounds, through the sequence's history, and never on the chain. A step that
   * cut was replayed over the slice it had just produced, and ate into it again on every render.
   *
   * Both are expressed against `slice`, and that is what makes them exact: the region and the
   * silence are measured on the rendered take, which begins where the block begins.
   */
  const cutTo = (from: Us, to: Us): void => {
    if (clipId && slice) trimTakeClip(documentId, clipId, cropShape(slice, from, to))
  }

  const act = (id: AudioToolId): void => {
    switch (id) {
      case 'crop':
        // Only with a region: cropping to nothing would silently empty the take.
        if (region) cutTo(region.from, region.to)
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
      case 'trimSilence': {
        // Measured here rather than in the worker, where the chain itself runs: `edgeSilences`
        // walks in from each end and stops at the first sample it hears, so on anything but a
        // wholly silent take it reads a few frames, not eight million.
        if (!rendered) return

        const { head, tail } = silentBounds(rendered.data)
        if (tail > head) cutTo(head, tail)
        return
      }
      case 'compare': {
        if (!clipId) return

        const store = useAudioEdits.getState()
        const current = audioEditsOf(store, documentId)
        const heard = chainOf(current, clipId)
        return store.replace(
          documentId,
          withChain(current, clipId, { ...heard, bypassed: !heard.bypassed }),
        )
      }
      case 'apply':
        void save(true)
        return
      case 'saveAs':
        void save(false)
        return
    }
  }

  // This half takes a drop, empty or not: dropping a take onto the editor lays it on the montage
  // and selects it, which is what brings it here.
  const takeDrop = (dropped: Asset): void => loadTake(documentId, dropped)

  // A take that cannot be read lands here too, and it is why the drop target wraps both: an
  // editor that only says "undecodable" is a half with no way out — the gesture that would
  // replace the take is the very one it stopped accepting.
  if (!clip || unreadable) {
    return (
      <AssetDropTarget accepts={TAKES} onDrop={takeDrop} outlined={false} className="flex flex-1">
        <MonitorFrame role={t('audio.takeRole')} toolbar={null}>
          <EmptyState
            icon={mdiMusicNoteOutline}
            message={t(unreadable ? 'audio.unreadable' : 'audio.noClip')}
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
            activeTool={chain.bypassed ? 'compare' : undefined}
            onTool={id => (id === 'transport' ? player.toggle() : isAudioTool(id) && act(id))}
            extras={
              <>
                {/* On the bar rather than in the tooltips alone: an area nobody knows how to draw
                    is not explained by a sentence that appears once a pointer rests on a tool. */}
                <span className={TOOLBAR_LABEL}>
                  {region
                    ? t('audio.selection', {
                        from: formatDuration(region.from),
                        to: formatDuration(region.to),
                      })
                    : t('audio.noSelection')}
                </span>
                <span className={cn(TOOLBAR_LABEL, 'font-mono')}>
                  {formatDuration(player.currentTime)}
                  {rendered && ` / ${formatDuration(durationOf(rendered.data))}`}
                </span>
              </>
            }
          />
        }
      >
        {/* `sc-wave` is what paints the selection's edges in the accent, from `index.css`: they
            live in wavesurfer's shadow tree, where only `::part` reaches them. */}
        <div ref={setSurface} className="sc-wave absolute inset-0" />
        {!rendered && <EmptyState icon={mdiMusicNoteOutline} message={t('collection.loading')} />}
      </MonitorFrame>
    </AssetDropTarget>
  )
}
