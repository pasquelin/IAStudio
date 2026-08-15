import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'

export type SettingLineProps = {
  title: ReactNode
  /** The control, and whatever sits beside it — a restore button, a conflict warning. */
  children: ReactNode
  /** Under the line, in the settings' dimmed help voice. */
  help?: ReactNode
  /** Changed but not yet applied. Off on lines that have nothing to stage. */
  staged?: boolean
  stagedLabel?: string
  /** `htmlFor`, when the title labels a control. Without it the title is a plain span. */
  labelFor?: string
  /** Greyed and inert — a setting whose requirement is not met. */
  disabled?: boolean
}

/**
 * One line of the settings windows: a title on the left, a control on the right, help beneath.
 *
 * Written once because it was written three times — `SettingRow`, `SettingActions` and the
 * shortcut rows carried the same two class strings to the character, and had already drifted:
 * only the first shows the dot that marks a value changed and not yet applied.
 *
 * The right-hand side is `children` rather than a prop per case: a setting hands over a control
 * and a restore button, an action a single button, a shortcut a chord and a conflict warning.
 */
export function SettingLine({
  title,
  children,
  help,
  staged = false,
  stagedLabel,
  labelFor,
  disabled = false,
}: SettingLineProps) {
  const heading = (
    <>
      <span
        aria-hidden={!staged}
        {...(staged && stagedLabel !== undefined && { title: stagedLabel })}
        className={cn('bg-primary size-1.5 shrink-0 rounded-full', !staged && 'invisible')}
      />
      {title}
    </>
  )

  return (
    <div
      className={cn(
        'border-base-300 flex flex-col gap-2 border-b py-3 last:border-b-0',
        disabled && 'pointer-events-none opacity-50',
      )}
    >
      <div className="flex items-center justify-between gap-4">
        {labelFor === undefined ? (
          <span className="flex items-center gap-1.5 text-xs font-medium">{heading}</span>
        ) : (
          <label htmlFor={labelFor} className="flex items-center gap-1.5 text-xs font-medium">
            {heading}
          </label>
        )}

        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>

      {help}
    </div>
  )
}
