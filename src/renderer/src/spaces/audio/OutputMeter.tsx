import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  meterFrom,
  peakOf,
  RESTING_METER,
  restedFrom,
  type MeterState,
} from '@/engines/audio/level'
import { paintMeter, readMeterPalette } from '@/engines/audio/meterPainter'
import { paintOn } from '@/engines/core/canvas2d'
import type { AudioTap } from '@/engines/timeline/soundSchedule'
import { useFrameLoop } from '@/hooks/useFrameLoop'
import { useRepaintOnResize } from '@/hooks/useRepaintOnResize'

export type OutputMeterProps = {
  tap: () => AudioTap | null
  playing: boolean
}

/**
 * What is going out of the window, right now.
 *
 * A canvas of its own rather than a corner of the monitor's: what it draws changes on every frame
 * where the wave beside it only moves its playhead, and one surface would tie the two together —
 * a resize of the wave repainting the bar, a frame of the bar re-clipping the wave.
 */
export function OutputMeter({ tap, playing }: OutputMeterProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Held in a ref and never in state: sixty renders a second of a component whose only output is
  // a canvas would be sixty renders that change no markup.
  const meter = useRef<MeterState>(RESTING_METER)

  const paint = useCallback((): void => {
    paintOn(canvasRef.current, (context, box) => {
      paintMeter(context, box, meter.current, readMeterPalette())
    })
  }, [])

  useEffect(() => {
    // Pressing play rearms the lamp. A witness that outlived the pass it belonged to would keep
    // saying something about a montage nobody is listening to any more — and stopping drops the
    // bar with the sound while the lamp stays, which is what `restedFrom` carries.
    meter.current = playing ? RESTING_METER : restedFrom(meter.current)
    paint()
  }, [playing, paint])

  useFrameLoop(
    playing,
    useCallback(
      (seconds: number) => {
        const listening = tap()
        meter.current = meterFrom(
          listening ? peakOf(listening.levels()) : 0,
          meter.current,
          seconds,
        )
        paint()
      },
      [tap, paint],
    ),
  )

  useRepaintOnResize(canvasRef, paint)

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={t('transport.outputLevel')}
      className="h-full w-(--sc-meter) shrink-0"
    />
  )
}
