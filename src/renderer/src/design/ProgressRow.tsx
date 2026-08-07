import { mdiCloseCircleOutline } from '@mdi/js'
import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { ToolButton } from './ToolButton'

export type ProgressRowProps = {
  /** What the row is about — a job's label, an asset's name. Truncated, never wrapped. */
  label: string
  /** 0 to 1. Absent draws no bar: a stage with nothing to measure must not show an empty one. */
  ratio?: number
  /** Short status text, at the right of the bar. */
  status: string
  /** Colour class of the status — the caller owns the meaning, this owns the layout. */
  statusClassName?: string
  cancelLabel?: string
  onCancel?: () => void
  /** Rendered under the row, for a failure worth a sentence. */
  detail?: ReactNode
}

/**
 * One line of "something is happening, here is how far". Shared by the jobs bar and the media
 * import, which had grown two copies of it — and they had already drifted apart.
 */
export function ProgressRow({
  label,
  ratio,
  status,
  statusClassName,
  cancelLabel,
  onCancel,
  detail,
}: ProgressRowProps) {
  const percent = ratio === undefined ? null : Math.round(ratio * 100)

  return (
    <li className="flex flex-col gap-0.5 px-2 py-1 text-xs">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{label}</span>

        {percent !== null && (
          <progress
            className="progress w-24"
            value={percent}
            max={100}
            aria-label={`${label} ${percent}%`}
          />
        )}

        <span className={cn('shrink-0 text-[11px]', statusClassName)}>{status}</span>

        {onCancel && cancelLabel && (
          <ToolButton
            icon={mdiCloseCircleOutline}
            label={cancelLabel}
            variant="header"
            onClick={onCancel}
          />
        )}
      </div>

      {detail}
    </li>
  )
}
