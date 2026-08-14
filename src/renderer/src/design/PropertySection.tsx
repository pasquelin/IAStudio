import { mdiChevronDown, mdiChevronRight } from '@mdi/js'
import { useState, type ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { FOCUS_RING, PROPERTY_BODY } from './styles'
import { UiIcon } from './UiIcon'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useTranslation } from 'react-i18next'

export type PropertySectionProps = {
  title: string
  children: ReactNode
  /** Sections a node rarely needs open on sight can start folded. */
  defaultOpen?: boolean
}

/** One group of properties under a heading that folds. What is open is session state. */
export function PropertySection({ title, children, defaultOpen = true }: PropertySectionProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="border-border border-b last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        {...HINT_LEFT(t(open ? 'inspector.sectionFoldHint' : 'inspector.sectionUnfoldHint'))}
        onClick={() => setOpen(current => !current)}
        className={cn(
          'text-text flex h-(--sc-control) w-full cursor-pointer items-center gap-2',
          'text-tiny border-none bg-transparent px-2 text-left font-medium tracking-wide uppercase',
          FOCUS_RING,
        )}
      >
        <UiIcon path={open ? mdiChevronDown : mdiChevronRight} size={14} />
        {title}
      </button>

      {/* Unmounted rather than hidden: a folded section keeps no field mounted, and a scene with
          six sections folded costs nothing to render. */}
      {open && <div className={PROPERTY_BODY}>{children}</div>}
    </section>
  )
}
