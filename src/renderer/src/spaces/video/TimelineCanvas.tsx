import { useEffect, useRef } from 'react'
import { paintTimeline } from '@/engines/timeline/painter'
import type { Viewport } from '@/engines/timeline/timeline-geometry'
import { sequenceOf, useSequences } from '@/stores/sequences'

export type TimelineCanvasProps = { documentId: string }

/** 100 px per second — the zoom this branch opens on. */
export const DEFAULT_VIEWPORT: Viewport = { scale: 100 / 1_000_000, offset: 0, scrollTop: 0 }

export function TimelineCanvas({ documentId }: TimelineCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sequence = useSequences(state => sequenceOf(state, documentId))

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const paint = (): void => {
      const ratio = window.devicePixelRatio
      const width = canvas.clientWidth
      const height = canvas.clientHeight

      // Backing store in device pixels, drawing in CSS pixels: without this the ruler is soft
      // on every retina display.
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)

      paintTimeline(context, sequence, DEFAULT_VIEWPORT, { width, height })
    }

    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [sequence])

  return <canvas ref={canvasRef} className="block h-full w-full" />
}
