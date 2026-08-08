import { mdiChevronRight } from '@mdi/js'
import type { HomeSectionId } from '@shared/domain/home'
import type { ReactNode } from 'react'
import { UiIcon } from '@/design/UiIcon'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { SectionMenu } from './SectionMenu'

export type SectionProps = {
  /** Which section this is, so its heading can carry the menu that reorders and sizes it. */
  id: HomeSectionId
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
export function Section({ id, title, action, children }: SectionProps) {
  return (
    <section className="group/section flex flex-col gap-3">
      <header className="flex items-center gap-3">
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

        {/* Revealed by hovering the band, and by focusing it: a settings glyph on every heading
            would turn a page of work into a page of controls. */}
        <span
          className={cn(
            'opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100',
            action ? '' : 'ml-auto',
          )}
        >
          <SectionMenu id={id} />
        </span>
      </header>

      {children}
    </section>
  )
}
