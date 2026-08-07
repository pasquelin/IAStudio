import { mdiPause, mdiPlay, mdiSkipPrevious } from '@mdi/js'
import { ALL_FORMATS, BlobSource, Input, VideoSampleSink } from 'mediabunny'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { assetUrl } from '@shared/domain/asset'
import { Timecode } from '@/design/Timecode'
import { Toolbar, type ToolbarItem } from '@/design/Toolbar'
import type { SinkLike } from '@/engines/timeline/decoder-pool'
import { transports } from '@/engines/timeline/playback'
import { TimelineEngine } from '@/engines/timeline/TimelineEngine'
import type { SequenceState, Us } from '@/engines/timeline/timeline-state'

/** A consumer GPU offers two to four hardware decoders; two per monitor leaves room to spare. */
const MAX_DECODERS = 2

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

export type MonitorProps = {
  /** Identifies this player to the single playback token. */
  owner: string
  title: string
  sequence: SequenceState
  /** Called on every played frame and on every rewind. */
  onTime: (time: Us) => void
  /** Shown in place of the picture when there is nothing to play. */
  placeholder?: ReactNode
}

/**
 * One viewer: a picture, a transport and a timecode. Both monitors of the Video workspace are
 * this component — source on the left, program on the right, as Premiere and DaVinci have it.
 */
export function Monitor({ owner, title, sequence, onTime, placeholder }: MonitorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const engine = useRef<TimelineEngine | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const element = hostRef.current
    if (!element) return

    const created = new TimelineEngine({
      openSink,
      maxDecoders: MAX_DECODERS,
      owner,
      onTime,
      onPlayingChange: setPlaying,
    })

    engine.current = created
    void created.mount(element)

    return () => {
      created.dispose()
      engine.current = null
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

  const rewind = useCallback(() => {
    engine.current?.pause()
    onTime(0)
  }, [onTime])

  const transport: ToolbarItem[] = [
    { id: 'rewind', labelKey: 'transport.rewind', icon: mdiSkipPrevious },
    {
      id: 'play',
      labelKey: playing ? 'transport.pause' : 'transport.play',
      icon: playing ? mdiPause : mdiPlay,
      shortcut: 'Space',
    },
  ]

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-2 p-2">
      <div className="bg-chassis relative min-h-0 w-full flex-1">
        <div ref={hostRef} className="absolute inset-0" />
        {placeholder}
      </div>

      <Toolbar
        orientation="horizontal"
        tools={transport}
        activeTool={playing ? 'play' : undefined}
        onTool={id => (id === 'rewind' ? rewind() : toggle())}
        extras={
          <>
            <span className="text-muted px-1 text-[11px]">{title}</span>
            <Timecode time={sequence.playhead} settings={sequence.settings} />
          </>
        }
      />
    </section>
  )
}
