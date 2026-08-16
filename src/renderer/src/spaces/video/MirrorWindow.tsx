import { mdiTelevisionPlay } from '@mdi/js'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { createStudioSink } from '@/engines/timeline/sink-port'
import { TimelineEngine } from '@/engines/timeline/TimelineEngine'
import { EMPTY_SEQUENCE, type SequenceState } from '@/engines/timeline/timeline-state'
import { assetsById, useAssets } from '@/stores/assets'
import { loadSceneSource, montageSceneOf, montageViewOf } from '@/stores/scene-sources'
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
  // What the 3D is drawn at here: the sequence the studio publishes, never this window's size.
  const frameSize = useRef({
    width: EMPTY_SEQUENCE.settings.width,
    height: EMPTY_SEQUENCE.settings.height,
  })
  const [showing, setShowing] = useState(false)

  useEffect(() => {
    const element = hostRef.current
    if (!element) return

    const sound = silentSound()
    const created = new TimelineEngine({
      // The same router the studio's own monitors use, or the return would show black where
      // the edit shows a scene — and a return that disagrees with the programme is worse than
      // no return. It renders 3D of its own: a WebGL context cannot cross a window.
      openSink: createStudioSink({
        sceneOf: montageSceneOf,
        wantScene: loadSceneSource,
        // Answers null in this window: the stores are its own, and the 3D tab lives in the
        // studio. A return therefore frames the contents itself — see `montageViewOf`.
        viewOf: montageViewOf,
        assetOf: assetId => assetsById(useAssets.getState()).get(assetId) ?? null,
        size: () => frameSize.current,
      }),
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
        frameSize.current = { width: sequence.settings.width, height: sequence.settings.height }
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
