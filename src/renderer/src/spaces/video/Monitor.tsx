import { mdiPause, mdiPlay, mdiSkipPrevious } from '@mdi/js'
import { ALL_FORMATS, BlobSource, Input, VideoSampleSink } from 'mediabunny'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { assetUrl } from '@shared/domain/asset'
import { ToolButton } from '@/design/ToolButton'
import type { SinkLike } from '@/engines/timeline/decoder-pool'
import { TimelineEngine } from '@/engines/timeline/TimelineEngine'
import { formatTimecode } from '@/engines/timeline/timecode'
import type { SequenceState, Us } from '@/engines/timeline/timeline-state'
import { TIP_TOP } from '@/helpers/tooltip'

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
  const { t } = useTranslation()
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

  const toggle = useCallback(() => {
    const current = engine.current
    if (!current) return
    if (current.playing()) current.pause()
    else current.play()
  }, [])

  const rewind = useCallback(() => {
    engine.current?.pause()
    onTime(0)
  }, [onTime])

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="text-muted flex h-6 shrink-0 items-center px-2 text-[11px]">
        {title}
      </header>

      <div className="bg-chassis relative min-h-0 flex-1">
        <div ref={hostRef} className="absolute inset-0" />
        {placeholder}
      </div>

      <footer className="border-border flex h-8 shrink-0 items-center justify-center gap-1 border-t">
        <ToolButton
          icon={mdiSkipPrevious}
          label={t('transport.rewind')}
          tooltip={TIP_TOP}
          onClick={rewind}
        />
        <ToolButton
          icon={playing ? mdiPause : mdiPlay}
          label={playing ? t('transport.pause') : t('transport.play')}
          tooltip={TIP_TOP}
          shortcut="Space"
          onClick={toggle}
        />
        <span className="text-muted ml-2 font-mono text-[11px] tabular-nums">
          {formatTimecode(sequence.playhead, sequence.settings)}
        </span>
      </footer>
    </section>
  )
}
