import { ALL_FORMATS, BlobSource, Input, VideoSampleSink } from 'mediabunny'
import { useEffect, useRef } from 'react'
import { assetUrl } from '@shared/domain/asset'
import type { SinkLike } from '@/engines/timeline/decoder-pool'
import { TimelineEngine } from '@/engines/timeline/TimelineEngine'
import { sequenceOf, useSequences } from '@/stores/sequences'

export type ProgramMonitorProps = {
  documentId: string
  /** Hands the engine to the document, which owns the transport. Null on unmount. */
  onEngine?: (engine: TimelineEngine | null) => void
  /** Follows the transport, including a pause the playback token forced on us. */
  onPlayingChange?: (playing: boolean) => void
}

/** A consumer GPU offers two to four hardware decoders; three leaves one for everything else. */
const MAX_DECODERS = 3

/**
 * The renderer never handles a file path: the asset comes through the `scenario://` scheme,
 * which the main process resolves against the catalogue.
 */
async function openSink(assetId: string): Promise<SinkLike> {
  const response = await fetch(assetUrl(assetId))
  if (!response.ok) throw new Error(`asset ${assetId} could not be read`)

  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(await response.blob()) })
  const track = await input.getPrimaryVideoTrack()
  if (!track) {
    input.dispose()
    throw new Error(`asset ${assetId} carries no video track`)
  }

  const sink = new VideoSampleSink(track)
  return { getSample: seconds => sink.getSample(seconds), close: () => input.dispose() }
}

export function ProgramMonitor({ documentId, onEngine, onPlayingChange }: ProgramMonitorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const engine = useRef<TimelineEngine | null>(null)
  const sequence = useSequences(state => sequenceOf(state, documentId))

  useEffect(() => {
    const element = hostRef.current
    if (!element) return

    const created = new TimelineEngine({
      openSink,
      maxDecoders: MAX_DECODERS,
      owner: documentId,
      // Playback is not an edit: the playhead goes through `replace`, which skips the history.
      onTime: time => {
        const store = useSequences.getState()
        store.replace(documentId, { ...sequenceOf(store, documentId), playhead: time })
      },
      onPlayingChange,
    })

    engine.current = created
    onEngine?.(created)
    void created.mount(element)

    return () => {
      created.dispose()
      engine.current = null
      onEngine?.(null)
    }
  }, [documentId, onEngine, onPlayingChange])

  // The engine holds decoders and textures, never the stack: every state change is pushed in.
  useEffect(() => {
    engine.current?.apply(sequence)
  }, [sequence])

  return <div ref={hostRef} className="absolute inset-0" />
}
