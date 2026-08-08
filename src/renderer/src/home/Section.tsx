import { mdiChevronRight } from '@mdi/js'
import type { ReactNode } from 'react'
import { UiIcon } from '@/design/UiIcon'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'

export type SectionProps = {
  title: string
  /** The way to the whole of what the shelf samples. Absent when there is no fuller view. */
  action?: { label: string; onClick: () => void }
  children: ReactNode
}

/**
 * One band of the home: a quiet heading, then its content across the full width.
 *
 * The heading is deliberately smaller than a panel's — a home read top to bottom is a sequence
 * of shelves, and six headings shouting at the same volume as the artwork underneath turns it
 * into a table of contents.
 */
export function Section({ title, action, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline gap-3">
        <h2 className="text-text m-0 text-[13px] font-semibold">{title}</h2>

        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className={cn(
              'text-muted hover:text-text ml-auto flex cursor-pointer items-center gap-0.5',
              'rounded-(--radius-sc-sm) border-none bg-transparent p-0 text-[11px]',
              FOCUS_RING,
            )}
          >
            {action.label}
            <UiIcon path={mdiChevronRight} size={13} />
          </button>
        )}
      </header>

      {children}
    </section>
  )
}
