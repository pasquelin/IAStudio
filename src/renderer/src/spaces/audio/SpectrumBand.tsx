import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { paintSpectrum, readSpectrumInk } from '@/engines/audio/spectrum-painter'
import { spectrumBands, type SpectrumBand as Band } from '@/engines/audio/spectrum'
import { paintOn } from '@/engines/core/canvas-2d'
import type { AudioTap } from '@/engines/timeline/sound-schedule'
import { useRepaintOnResize } from '@/hooks/useRepaintOnResize'

export type SpectrumBandProps = {
  /** Where to listen. Answers null until something has opened an output. */
  tap: () => AudioTap | null
  playing: boolean
}

/**
 * How many bars the band is cut into. Enough to tell one register from the next, few enough that
 * each is still a bar rather than a hair — the count every desk analyser settles around.
 */
const BAR_COUNT = 32

/**
 * What the montage is made of, register by register.
 *
 * The third reading of one panel, and the one that only lives while a montage plays: an analyser
 * has nothing to say about a stopped sequence. Its frame loop follows the transport for the same
 * reason the meter's does.
 */
export function SpectrumBand({ tap, playing }: SpectrumBandProps) {
  const { t, i18n } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const bands = useRef<Band[]>([])

  const marks = useMemo(
    () => ({
      hertz: t('transport.hertz'),
      kilohertz: t('transport.kilohertz'),
      language: i18n.language,
    }),
    [t, i18n.language],
  )

  const paint = useCallback((): void => {
    paintOn(canvasRef.current, (context, box) => {
      paintSpectrum(context, box, bands.current, readSpectrumInk(), marks)
    })
  }, [marks])

  useEffect(() => {
    if (!playing) {
      // Cleared rather than frozen: a spectrum standing still describes an instant that has
      // passed, where an empty band says plainly that nothing is playing.
      bands.current = []
      paint()
      return
    }

    let frame = requestAnimationFrame(function step() {
      const listening = tap()
      bands.current = listening
        ? spectrumBands(listening.frequencies(), listening.sampleRate, BAR_COUNT)
        : []
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
      aria-label={t('transport.spectrum')}
      className="h-(--sc-spectrum) w-full shrink-0"
    />
  )
}
