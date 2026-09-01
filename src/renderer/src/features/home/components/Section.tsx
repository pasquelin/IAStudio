import type { HomeSectionId } from '@shared/domain/home'
import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { HideSection } from './HideSection'

export type SectionProps = {
  /** Which section this is, so its heading can offer to take it off the page. */
  id: HomeSectionId
  title: string
  /**
   * Controls belonging to the band, laid out on the heading line rather than under it. A row of
   * tabs above the content would spend a second line on what the heading has room for.
   */
  actions?: ReactNode
  /**
   * Keeps the heading against the top of the page while the band scrolls past it. `top-0` holds
   * only because the page's scroller starts where the sections do.
   */
  sticky?: boolean
  children: ReactNode
}

/**
 * One band of the home: a quiet heading, then its content across the full width.
 *
 * The heading is deliberately smaller than a panel's — a home read top to bottom is a sequence
 * of shelves, and six headings shouting at the same volume as the artwork underneath turns it
 * into a table of contents.
 */
export function Section({ id, title, actions, sticky = false, children }: SectionProps) {
  return (
    <section className="group/section flex flex-col gap-3">
      <header
        className={cn(
          'flex items-center gap-3',
          // Opaque, or the content reads through the heading it is scrolling under.
          sticky && 'bg-panel sticky top-0 z-10 py-2',
        )}
      >
        <h2 className="text-text text-body m-0 font-semibold">{title}</h2>

        <div className="ml-auto flex items-center gap-3">
          {actions}

          {/* Revealed by hovering the band, and by focusing it: a control on every heading would
              turn a page of work into a page of controls. */}
          <span className="opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
            <HideSection id={id} />
          </span>
        </div>
      </header>

      {children}
    </section>
  )
}
