import { useCallback, useEffect, useRef, useState } from 'react'
import { transports } from '@/engines/timeline/playback'
import { openAssetSink } from '@/engines/timeline/sink-port'
import { createSoundPort } from '@/engines/timeline/sound-port'
import { TimelineEngine } from '@/engines/timeline/TimelineEngine'
import type { SequenceState, Us } from '@/engines/timeline/timeline-state'
import { sequenceOf, sequenceStore, useSequences } from '@/stores/sequences'

/**
 * A sound montage needs one decoder for the take being scrubbed over — the schedule reads its
 * samples ahead, and a pool of none would answer every ask with nothing.
 */
const MAX_DECODERS = 1

/** No picture is ever shown here, so the ceiling that bounds their memory is zero. */
const MAX_PICTURES = 0

export type SoundTransport = {
  playing: boolean
  toggle: () => void
  rewind: () => void
}

/**
 * Plays a sound montage, with no monitor under it.
 *
 * `TimelineEngine` is the studio's single player and it is used whole — the same schedule, the
 * same output, the same playback token, so a montage and a monitor can never be heard at once.
 * It is simply never `mount`ed: mounting is what gives it a Pixi stage, and every one of its
 * drawing steps returns early without one. The sound half owes nothing to the picture half.
 *
 * The head is written back into the document exactly as the program monitor does it — through
 * `replace`, outside the history: playing is not an edit.
 */
export function useSoundTransport(documentId: string, sequence: SequenceState): SoundTransport {
  const engine = useRef<TimelineEngine | null>(null)
  const [playing, setPlaying] = useState(false)

  const setTime = useCallback(
    (playhead: Us): void => {
      const store = useSequences.getState()
      // Closing a tab drops the document BEFORE React unmounts this hook, and `dispose` pauses
      // — which reports one last time. Writing then would build a montage back for a document
      // that is gone, out of the store's default: a picture track, in the Audio workspace.
      if (!sequenceStore.hasState(store, documentId)) return

      store.replace(documentId, { ...sequenceOf(store, documentId), playhead })
    },
    [documentId],
  )

  useEffect(() => {
    const sound = createSoundPort()
    const created = new TimelineEngine({
      openSink: openAssetSink,
      sound,
      // The output is the master clock whenever it runs: driving sound from the frame loop
      // drifts against it audibly in under a minute.
      audioTime: sound.now,
      maxDecoders: MAX_DECODERS,
      maxPictures: MAX_PICTURES,
      owner: documentId,
      onTime: setTime,
      onPlayingChange: setPlaying,
    })

    engine.current = created
    return () => {
      created.dispose()
      engine.current = null
    }
  }, [documentId, setTime])

  // The engine holds the schedule, never the montage: every change is pushed in.
  useEffect(() => {
    engine.current?.apply(sequence)
  }, [sequence])

  // Published by name for the same reason the monitor is: the space bar is pressed on a surface
  // that does not contain this one.
  useEffect(
    () =>
      transports.register(documentId, {
        play: () => engine.current?.play(),
        pause: () => engine.current?.pause(),
        playing: () => engine.current?.playing() ?? false,
      }),
    [documentId],
  )

  return {
    playing,
    toggle: useCallback(() => transports.toggle(documentId), [documentId]),
    rewind: useCallback(() => {
      engine.current?.pause()
      setTime(0)
    }, [setTime]),
  }
}
