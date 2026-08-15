import { mdiTelevisionPlay } from '@mdi/js'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { openAssetSink } from '@/engines/timeline/sink-port'
import { TimelineEngine } from '@/engines/timeline/TimelineEngine'
import { EMPTY_SEQUENCE, type SequenceState } from '@/engines/timeline/timeline-state'
import { mirrorMessageOf, openMirrorChannel } from './mirror-channel'
import { silentSound } from './silent-sound'

/**
 * The video return: the program monitor, alone in a window of its own, for a second screen.
 *
 * It holds an engine of its own rather than a picture copied from the studio — a WebGL context
 * cannot be shared between windows, which is the same reason a detached panel rebuilds its
 * engine. So the sequence is replayed here, from the state the studio publishes.
 *
 * MUTE, and that is not a detail: the studio is already playing the sound of this very edit, and
 * a second output would double every take a few milliseconds apart. What one watches on the
 * second screen is the picture; what one hears stays where the work is.
 */
export function MirrorWindow() {
  const { t } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const engine = useRef<TimelineEngine | null>(null)
  const [showing, setShowing] = useState(false)

  useEffect(() => {
    const element = hostRef.current
    if (!element) return

    const sound = silentSound()
    const created = new TimelineEngine({
      openSink: openAssetSink,
      sound,
      audioTime: sound.now,
      maxDecoders: 2,
      maxPictures: 4,
      owner: 'mirror',
      // The playhead is the studio's to move: this end never reports one back, and nothing here
      // would listen if it did.
      onTime: () => undefined,
    })

    engine.current = created
    void created.mount(element)

    return () => {
      created.dispose()
      engine.current = null
    }
  }, [])

  useEffect(() => {
    const channel = openMirrorChannel()
    // Held so a `time` arriving before the first `edit` is not seeked against an empty sequence.
    let sequence: SequenceState = EMPTY_SEQUENCE

    channel.onmessage = event => {
      const message = mirrorMessageOf(event.data)
      if (!message) return

      if (message.kind === 'gone') {
        setShowing(false)
        engine.current?.apply(EMPTY_SEQUENCE)
        return
      }
      if (message.kind === 'edit') {
        sequence = message.sequence
        setShowing(true)
        engine.current?.apply(sequence)
        return
      }
      if (message.kind === 'time') {
        engine.current?.apply({ ...sequence, playhead: message.playhead })
        return
      }
      // The studio answers its own question; nothing to do with what comes back here.
      if (message.kind === 'ask') return

      // Its own transport from here: a message per frame would put this window one hop behind
      // the picture it mirrors, and drift on top of that.
      engine.current?.apply({ ...sequence, playhead: message.playhead })
      if (message.playing) engine.current?.play()
      else engine.current?.pause()
    }

    // The window opens long after the studio published, and a channel replays nothing: without
    // this the return waits on its empty state until the next edit — measured, on the first run.
    channel.postMessage({ kind: 'ask' })

    return () => channel.close()
  }, [])

  return (
    <div className="bg-monitor relative h-full w-full">
      <div ref={hostRef} className="absolute inset-0" />
      {!showing && (
        <div className="pointer-events-none absolute inset-0">
          <EmptyState icon={mdiTelevisionPlay} message={t('mirror.waiting')} />
        </div>
      )}
    </div>
  )
}
