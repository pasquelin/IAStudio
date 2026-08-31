import { mdiCloseCircleOutline } from '@mdi/js'
import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { ProgressBar } from './ProgressBar'
import { TONE_TEXT, type StatusTone } from './styles'
import { ToolButton } from './ToolButton'
import { TIP_LEFT } from '@/helpers/tooltip'

export type ProgressRowProps = {
  /** What the row is about — a job's label, an asset's name. Truncated, never wrapped. */
  label: string
  /** 0 to 1. Absent draws no bar: a stage with nothing to measure must not show an empty one. */
  ratio?: number
  /** Short status text, at the right of the bar. */
  status: string
  tone?: StatusTone
  /**
   * Both or neither: a labelless button is unreachable, a labelled one that does nothing lies.
   *
   * `refusedBecause` is the third case, and it is not a fourth state of the same button: some
   * services do not stop a task they have started, and a button that reported one as cancelled
   * would have somebody believe they stopped a spend that is still running. The row keeps the
   * button, says why in its tooltip, and does nothing when it is pressed.
   */
  cancel?: { label: string; onClick: () => void; refusedBecause?: string }
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

        <span className={cn('text-tiny shrink-0', TONE_TEXT[tone])}>{status}</span>

        {cancel && (
          <ToolButton
            icon={mdiCloseCircleOutline}
            label={cancel.label}
            // The reason REPLACES the label in the tooltip: the name is already what the button
            // answers to, and repeating it would leave the refusal unsaid.
            description={cancel.refusedBecause}
            tooltip={TIP_LEFT}
            variant="header"
            // `aria-disabled` rather than `disabled`: a disabled button dispatches no pointer
            // event in Chromium, so the tooltip carrying the reason would never be drawn — and
            // the reason is the whole point of keeping the button on the row.
            aria-disabled={cancel.refusedBecause === undefined ? undefined : true}
            className={cancel.refusedBecause === undefined ? undefined : 'cursor-not-allowed'}
            onClick={cancel.refusedBecause === undefined ? cancel.onClick : undefined}
          />
        )}
      </div>

      {detail}
    </li>
  )
}
