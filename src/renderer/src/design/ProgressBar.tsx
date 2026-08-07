import { cn } from '@/helpers/cn'

export type ProgressBarProps = {
  /** 0 to 1. Clamped, because a job that reports 1.02 must not overflow its track. */
  ratio: number
  /** Names the bar for a screen reader — a bare percentage says nothing about what is running. */
  label: string
  className?: string
}

/**
 * A determinate progress track. A native `<progress>` cannot be styled to the studio's tokens
 * across platforms, so the geometry is a div and the semantics are the ARIA role.
 */
export function ProgressBar({ ratio, label, className }: ProgressBarProps) {
  const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100)

  return (
    <div
      role="progressbar"
      aria-label={`${label} ${percent}%`}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('bg-surface h-1 overflow-hidden rounded-(--radius-sc-sm)', className)}
    >
      <div className="bg-accent h-full transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  )
}
