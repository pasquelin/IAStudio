import { type CommandId } from '@shared/domain/command'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import {
  mdiAlertCircleOutline,
  mdiPause,
  mdiPlay,
  mdiSkipPrevious,
  mdiTelevisionPlay,
} from '@mdi/js'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { Timecode } from '@/design/Timecode'
import { Toolbar, type ToolbarItem } from '@/design/Toolbar'
import { openAssetSink } from '@/engines/timeline/sink-port'
import { createSoundPort } from '@/engines/timeline/sound-port'
import { transports } from '@/engines/timeline/playback'
import { TimelineEngine } from '@/engines/timeline/TimelineEngine'
import type { SequenceState, Us } from '@/engines/timeline/timeline-state'
import { useShortcuts } from '@/hooks/useShortcuts'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useBinding } from '@/stores/bindings'
import { playbackOf, usePlayback } from '@/stores/playback'

/** A consumer GPU offers two to four hardware decoders; two per monitor leaves room to spare. */
const MAX_DECODERS = 2

/**
 * Pictures answer to memory rather than to silicon. Four per monitor, and a sequence mounts two —
 * so eight 4K bitmaps at worst, against the 96 MB `image-cache` holds for the rest of the window.
 * A reasoned number, not a measured one: measuring it wants the application running.
 */
const MAX_PICTURES = 4

export type MonitorProps = {
  /** Identifies this player to the single playback token. */
  owner: string
  title: string
  /** One line under the transport saying what this monitor SHOWS — see `SequenceDocument`. */
  role: string
  sequence: SequenceState
  /** Called on every played frame and on every rewind. */
  onTime: (time: Us) => void
  /** Shown in place of the picture when there is nothing to play. */
  placeholder?: ReactNode
  /** The monitor the space bar drives. One per tab: two would fight over the playback token. */
  keyboard?: boolean
  /**
   * Whether this monitor shows the EDIT, which is what the video return mirrors. Its own prop
   * rather than read off `keyboard`: that one says who hears the space bar, and a return offered
   * on the take being trimmed would be the source monitor copied onto the second screen.
   */
  program?: boolean
}

/**
 * One viewer: a picture, a transport and a timecode. Both monitors of the Video workspace are
 * this component — source on the left, program on the right, as Premiere and DaVinci have it.
 */
export function Monitor({
  owner,
  title,
  role,
  sequence,
  onTime,
  placeholder,
  keyboard = false,
  program = false,
}: MonitorProps) {
  const { t } = useTranslation()
  const pictureRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const engine = useRef<TimelineEngine | null>(null)
  // Published rather than held: the timeline's own bar draws the same transport, and neither of
  // the two trees contains the other — see `stores/playback`.
  const playing = usePlayback(state => playbackOf(state, owner))
  const [unreadable, setUnreadable] = useState(false)

  useEffect(() => {
    const element = hostRef.current
    if (!element) return

    const sound = createSoundPort()
    const created = new TimelineEngine({
      openSink: openAssetSink,
      sound,
      // The output is the master clock whenever it runs: driving sound from the frame loop
      // drifts against it audibly in under a minute, and both media then tell a different time.
      audioTime: sound.now,
      maxDecoders: MAX_DECODERS,
      maxPictures: MAX_PICTURES,
      owner,
      onTime,
      onPlayingChange: running => usePlayback.getState().setRunning(owner, running),
      onUnreadable: setUnreadable,
    })

    engine.current = created
    void created.mount(element)

    return () => {
      created.dispose()
      engine.current = null
      usePlayback.getState().forget(owner)
    }
  }, [owner, onTime])

  // The engine holds decoders and textures, never the stack: every state change is pushed in.
  useEffect(() => {
    engine.current?.apply(sequence)
  }, [sequence])

  // Published by name so the timeline strip can drive it: the space bar is pressed on a tool
  // window, and neither tree contains the other.
  useEffect(
    () =>
      transports.register(owner, {
        play: () => engine.current?.play(),
        pause: () => engine.current?.pause(),
        playing: () => engine.current?.playing() ?? false,
      }),
    [owner],
  )

  const toggle = useCallback(() => transports.toggle(owner), [owner])

  /**
   * A WINDOW rather than this element blown up, and it took a measurement to land there: asked on
   * the picture, `requestFullscreen()` neither resolved nor rejected — Chromium hands the request
   * to Electron and, in this window, nothing ever comes back. There was no refusal to report, and
   * a button that stays pressed with nothing on screen is the worst of both.
   *
   * A window is also the better answer to what it is for: it goes on the SECOND screen, beside
   * the studio rather than over it, and one keeps editing while it plays.
   */
  const showReturn = useCallback(() => {
    void getBridge()
      ?.mirror.open()
      .catch(error => reportFailure('sequence.mirror', title, error))
  }, [title])

  const rewind = useCallback(() => {
    engine.current?.pause()
    onTime(0)
  }, [onTime])

  const playPause = useBinding('sequence.playPause')
  const label = useShortcutLabel()

  const mirror = useBinding('sequence.mirror')

  const run = useCallback(
    (command: CommandId) => {
      if (command === 'sequence.playPause') toggle()
      if (command === 'sequence.mirror') showReturn()
    },
    [toggle, showReturn],
  )

  useShortcuts({ scope: 'sequence', enabled: keyboard, onCommand: run })

  const transport: ToolbarItem[] = [
    { id: 'rewind', labelKey: 'transport.rewind', icon: mdiSkipPrevious },
    {
      id: 'play',
      labelKey: playing ? 'transport.pause' : 'transport.play',
      icon: playing ? mdiPause : mdiPlay,
      // Advertised only where it is armed: a tooltip promising a key nothing listens to lies.
      shortcut: keyboard ? label(playPause) : undefined,
    },
    ...(program
      ? [
          {
            id: 'mirror',
            labelKey: 'transport.mirror',
            descriptionKey: 'transport.mirrorHint',
            icon: mdiTelevisionPlay,
            shortcut: label(mirror),
            separatorBefore: true,
          },
        ]
      : []),
  ]

  return (
    // No padding of its own: what separates the two monitors is the row's gutter and the handle
    // between them, exactly as two panels are separated. A padding here would add itself to both
    // sides of that gutter and read as a gap three times too wide.
    <section className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-2">
      {/* The element that goes full screen — see `showLarge`, and `index.css` for the black it
          takes there, which is the monitor's own token and not the panel's chassis. */}
      <div ref={pictureRef} className="bg-chassis relative min-h-0 w-full flex-1">
        <div ref={hostRef} className="absolute inset-0" />
        {/* Positioned, like `TextureDocument` does over its own viewport: the canvas host is
            absolute, so anything left in normal flow is painted under the opaque backdrop. */}
        <div className="pointer-events-none absolute inset-0">
          {/* Ahead of the host's own placeholder: a clip that is there and shows nothing is the
              more precise thing to say about a black picture. */}
          {unreadable ? (
            <EmptyState icon={mdiAlertCircleOutline} message={t('transport.unreadable')} />
          ) : (
            placeholder
          )}
        </div>
      </div>

      <Toolbar
        orientation="horizontal"
        tools={transport}
        activeTool={playing ? 'play' : undefined}
        onTool={id => {
          if (id === 'rewind') return rewind()
          if (id === 'mirror') return showReturn()
          return toggle()
        }}
        extras={
          <>
            <span className="text-muted text-tiny px-1">{title}</span>
            <Timecode time={sequence.playhead} fps={sequence.settings.fps} />
          </>
        }
      />

      {/* Under the transport rather than over the picture: two monitors showing the same black
          rectangle is the one thing this space cannot explain by itself, and the answer has to
          still be there once both are showing something. */}
      <p className="text-muted text-tiny m-0 text-center">{role}</p>
    </section>
  )
}
