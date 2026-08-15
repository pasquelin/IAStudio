import { mdiPause, mdiPlay, mdiSkipPrevious } from '@mdi/js'
import { useCallback, useEffect, useRef, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { clamp } from '@shared/numeric'
import { MonitorFrame } from '@/design/MonitorFrame'
import { TOOLBAR_LABEL } from '@/design/styles'
import { Timecode } from '@/design/Timecode'
import { Toolbar } from '@/design/Toolbar'
import { paintOn } from '@/engines/core/canvas-2d'
import { rootColour } from '@/engines/core/palette'
import { paintProgram, programViewport } from '@/engines/timeline/program-wave'
import { readRulerStyle } from '@/engines/timeline/ruler'
import { xToTime } from '@/engines/timeline/timeline-geometry'
import {
  sequenceDuration,
  type Clip,
  type SequenceState,
  type Us,
} from '@/engines/timeline/timeline-state'
import { useRepaintOnResize } from '@/hooks/useRepaintOnResize'
import { usePeaks } from '@/stores/peaks'
import type { SoundTransport } from './useSoundTransport'

export type ProgramMonitorProps = {
  sequence: SequenceState
  transport: SoundTransport
  /** Where a click on the wave puts the head. Scrubbing a montage is not an edit. */
  onSeek: (time: Us) => void
}

/**
 * The montage, end to end, and where the head stands in it.
 *
 * The programme half of the pair, and the answer to "what am I making": the strip below lays the
 * same clips out in time, this shows what they add up to. It draws from the same peaks the strip
 * draws from, so the two can never disagree about what is there — and the whole montage always
 * fits the width, this being the view one reads rather than one one scrolls.
 */
export function ProgramMonitor({ sequence, transport, onSeek }: ProgramMonitorProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Read on paint rather than subscribed to: a waveform arriving is a repaint, never a render.
  const latest = useRef(sequence)

  const peaksOf = useCallback((clip: Clip): Float32Array | null => {
    const peaks = usePeaks.getState()
    peaks.request(clip.assetId)
    return peaks.byAsset[clip.assetId] ?? null
  }, [])

  const paint = useCallback((): void => {
    paintOn(canvasRef.current, (context, box) => {
      paintProgram(context, latest.current, peaksOf, box, {
        background: rootColour('--color-chassis'),
        // The ink a clip draws its own waveform in, not the green it is filled with: green on the
        // chassis is the one pairing this token was never balanced against, and a wave is a glyph
        // that informs — 3:1, by 1.4.11. Read this way, both halves of the pair draw alike.
        wave: rootColour('--color-muted'),
        playhead: rootColour('--color-accent'),
        // The strip's own ruler, not one of this monitor's making: the pair reads as one grid.
        ruler: readRulerStyle(),
      })
    })
  }, [peaksOf])

  useEffect(() => {
    latest.current = sequence
    paint()
  }, [sequence, paint])

  // One waveform lands at a time, each after the frame that asked for it.
  useEffect(() => usePeaks.subscribe(paint), [paint])

  useRepaintOnResize(canvasRef, paint)

  const seek = (event: PointerEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current
    if (!canvas) return

    const bounds = canvas.getBoundingClientRect()
    const at = xToTime(event.clientX - bounds.left, programViewport(latest.current, bounds.width))
    onSeek(clamp(at, 0, sequenceDuration(latest.current)))
  }

  return (
    <MonitorFrame
      role={t('transport.programRole')}
      toolbar={
        <Toolbar
          orientation="horizontal"
          tools={[
            { id: 'rewind', labelKey: 'transport.rewind', icon: mdiSkipPrevious },
            {
              id: 'play',
              labelKey: transport.playing ? 'transport.pause' : 'transport.play',
              icon: transport.playing ? mdiPause : mdiPlay,
              shortcut: t('keys.Space'),
            },
          ]}
          activeTool={transport.playing ? 'play' : undefined}
          onTool={id => (id === 'rewind' ? transport.rewind() : transport.toggle())}
          extras={
            <>
              <span className={TOOLBAR_LABEL}>{t('transport.program')}</span>
              <Timecode time={sequence.playhead} fps={sequence.settings.fps} />
            </>
          }
        />
      }
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" onPointerDown={seek} />
    </MonitorFrame>
  )
}
