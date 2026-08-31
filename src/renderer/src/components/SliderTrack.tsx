import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { SLIDER_TRACK, type GestureProps } from './styles'

export type SliderTrackProps = GestureProps & {
  children: ReactNode
  className?: string
}

/**
 * The box a slider gesture is opened and closed on — never a handle, whose focus and blur do not
 * bracket a drag. A handle covers this box entirely, so the press reaches here either way, and a
 * range stacks TWO handles on one of these: only the track sees the whole gesture.
 */
export function SliderTrack({
  children,
  className,
  onGestureStart,
  onGestureEnd,
}: SliderTrackProps) {
  return (
    <div
      className={cn(SLIDER_TRACK, className)}
      onPointerDown={() => onGestureStart?.()}
      onPointerUp={() => onGestureEnd?.()}
    >
      {children}
    </div>
  )
}
