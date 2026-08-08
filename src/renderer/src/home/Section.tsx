import type { HomeSectionId } from '@shared/domain/home'
import type { ReactNode } from 'react'
import { SectionMenu } from './SectionMenu'

export type SectionProps = {
  /** Which section this is, so its heading can carry the menu that reorders and sizes it. */
  id: HomeSectionId
  title: string
  children: ReactNode
}

/**
 * One band of the home: a quiet heading, then its content across the full width.
 *
 * The heading is deliberately smaller than a panel's — a home read top to bottom is a sequence
 * of shelves, and six headings shouting at the same volume as the artwork underneath turns it
 * into a table of contents.
 */
export function Section({ id, title, children }: SectionProps) {
  return (
    <section className="group/section flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <h2 className="text-text m-0 text-[13px] font-semibold">{title}</h2>

        {/* Revealed by hovering the band, and by focusing it: a settings glyph on every heading
            would turn a page of work into a page of controls. */}
        <span className="ml-auto opacity-0 transition-opacity group-hover/section:opacity-100 focus-within:opacity-100">
          <SectionMenu id={id} />
        </span>
      </header>

      {children}
    </section>
  )
}
