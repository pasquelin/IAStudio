import { mdiCloseCircleOutline } from '@mdi/js'
import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { ProgressBar } from './ProgressBar'
import { ToolButton } from './ToolButton'

/** How a status reads. The caller names the meaning; the colour stays in the design system. */
export type StatusTone = 'muted' | 'accent' | 'success' | 'danger'

const TONE_CLASS: Record<StatusTone, string> = {
  muted: 'text-muted',
  accent: 'text-accent',
  success: 'text-success',
  danger: 'text-danger',
}

export type ProgressRowProps = {
  /** What the row is about — a job's label, an asset's name. Truncated, never wrapped. */
  label: string
  /** 0 to 1. Absent draws no bar: a stage with nothing to measure must not show an empty one. */
  ratio?: number
  /** Short status text, at the right of the bar. */
  status: string
  tone?: StatusTone
  /** Both or neither: a labelless button is unreachable, a labelled one that does nothing lies. */
  cancel?: { label: string; onClick: () => void }
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
  tone = 'muted',
  cancel,
  detail,
}: ProgressRowProps) {
  return (
    <li className="flex flex-col gap-0.5 px-2 py-1 text-xs">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{label}</span>

        {ratio !== undefined && <ProgressBar ratio={ratio} label={label} className="w-24" />}

        <span className={cn('shrink-0 text-[11px]', TONE_CLASS[tone])}>{status}</span>

        {cancel && (
          <ToolButton
            icon={mdiCloseCircleOutline}
            label={cancel.label}
            variant="header"
            onClick={cancel.onClick}
          />
        )}
      </div>

      {detail}
    </li>
  )
}
