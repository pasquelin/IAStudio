import { useTranslation } from 'react-i18next'
import { cn } from '@/helpers/cn'
import { formatPercent } from '@/helpers/format'
import { clamp } from '@shared/numeric'

export type ProgressBarProps = {
  /** 0 to 1. Clamped, because a job that reports 1.02 must not overflow its track. */
  ratio: number
  /** Names the bar for a screen reader — a bare percentage says nothing about what is running. */
  label: string
  className?: string
}

/** A native `<progress>` cannot be themed to the studio's tokens across platforms, hence a div. */
export function ProgressBar({ ratio, label, className }: ProgressBarProps) {
  const { i18n } = useTranslation()
  const held = clamp(ratio, 0, 1)
  const percent = Math.round(held * 100)

  return (
    <div
      role="progressbar"
      aria-label={`${label} ${formatPercent(held, i18n.language)}`}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('bg-surface h-1 overflow-hidden rounded-(--radius-sc-sm)', className)}
    >
      <div className="bg-accent h-full transition-[width]" style={{ width: `${percent}%` }} />
    </div>
  )
}
