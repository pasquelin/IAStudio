import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { meterFrom, peakOf, RESTING_METER, type MeterState } from '@/engines/audio/level'
import { paintMeter, readMeterPalette } from '@/engines/audio/meter-painter'
import { paintOn } from '@/engines/core/canvas-2d'
import type { AudioTap } from '@/engines/timeline/sound-schedule'
import { useRepaintOnResize } from '@/hooks/useRepaintOnResize'

export type OutputMeterProps = {
  /** Where to listen. Answers null until something has opened an output, which is most of the time. */
  tap: () => AudioTap | null
  playing: boolean
}

/**
 * What is going out of the window, right now.
 *
 * A canvas of its own rather than a corner of the monitor's: this repaints on every frame while a
 * montage plays, and redrawing the hundreds of columns of a programme wave sixty times a second
 * to animate one bar is the frame budget spent on nothing.
 *
 * The loop runs while the montage plays and not a frame longer. A meter left animating over a
 * stopped montage is a wake-up sixty times a second to draw the same picture.
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
    if (!playing) return

    // Pressing play rearms the overload lamp. A witness that outlived the pass it belonged to
    // would keep saying something about a montage nobody is listening to any more.
    meter.current = RESTING_METER

    let frame = requestAnimationFrame(function step(stamp: number) {
      const listening = tap()
      // Seconds, as every other clock in the sound half is: `meterFrom` falls in decibels per
      // second, and handing it milliseconds would empty the bar a thousand times too fast.
      const now = stamp / 1000
      meter.current = meterFrom(listening ? peakOf(listening.levels()) : 0, meter.current, now)
      paint()
      frame = requestAnimationFrame(step)
    })

    return () => cancelAnimationFrame(frame)
  }, [playing, tap, paint])

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
