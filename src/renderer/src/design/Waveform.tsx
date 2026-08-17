import { useCallback, useEffect, useRef } from 'react'
import { paintOn } from '@/engines/core/canvas2d'
import { rootColour } from '@/engines/core/palette'
import { paintWaveform } from '@/engines/timeline/painter'
import { tileColumns } from '@/engines/timeline/waveform'
import { cn } from '@/helpers/cn'
import { useRepaintOnResize } from '@/hooks/useRepaintOnResize'

export type WaveformProps = {
  /** The take end to end, as the pairs the ingest wrote. Null draws nothing at all. */
  peaks: Float32Array | null
  className?: string
}

/**
 * A take drawn as its own shape, filling whatever box it is given.
 *
 * Painted rather than laid out in the tree: a three-minute take holds nine thousand pairs, and
 * an element per column is a shelf of two hundred tiles turning into two million nodes.
 *
 * The ink is `muted` — a glyph that informs, so 3:1 by WCAG 1.4.11, and the same token the strip
 * and the programme monitor draw their waves in. Nothing is painted under it: the tile's own
 * surface shows through, which is what keeps the shelf one flat plane.
 */
export function Waveform({ peaks, className }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Read on paint rather than depended on: a waveform arriving is a repaint, never a render.
  const latest = useRef(peaks)

  const paint = useCallback((): void => {
    paintOn(canvasRef.current, (context, { width, height }) => {
      context.clearRect(0, 0, width, height)

      const held = latest.current
      if (!held) return
      paintWaveform(context, tileColumns(held, width), 0, height, rootColour('--color-muted'))
    })
  }, [])

  useEffect(() => {
    latest.current = peaks
    paint()
  }, [peaks, paint])

  useRepaintOnResize(canvasRef, paint)

  return <canvas ref={canvasRef} className={cn('block size-full', className)} />
}
