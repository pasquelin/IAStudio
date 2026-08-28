import { useTranslation } from 'react-i18next'
import type { Memory } from '@shared/domain/assistantMemory'
import { neighboursOf, type MemoryTie } from '@shared/domain/memoryGraph'
import { WINDOW_CAPTION, WINDOW_GROUP_LABEL } from '@/design/windowStyles'
import { cn } from '@/helpers/cn'
import { MemoryRelationsRow } from './MemoryRelationsRow'

/**
 * One hop around the chosen memory: what it is about, what it points to, what it replaced.
 *
 * 🛑 Sections rather than a tree, and the titles are whole SENTENCES — « Elle parle de », not
 * « désigne ». The tree named the edge of a graph on every row, so its second level inherited the
 * first one's word and read backwards; a title carries the relation once, and a row is then free
 * to be nothing but the thing it names.
 */

const TIE_KEYS: Readonly<Record<MemoryTie, string>> = {
  about: 'settings.memoryRefs',
  links: 'settings.memoryLinks',
  replaces: 'settings.memoryReplaces',
}

export function MemoryRelations({
  memory,
  among,
  onOpen,
}: {
  memory: Memory
  among: readonly Memory[]
  /** Opens the memory a row stands for. Rows standing for a reference open nothing. */
  onOpen: (memoryId: string) => void
}) {
  const { t } = useTranslation()
  const sections = neighboursOf(memory, among)

  // Nothing to say rather than a heading over emptiness: a memory that touches nothing is the
  // ordinary case, and a title with no rows sends the reader looking for what is missing.
  if (sections.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h3 className={WINDOW_GROUP_LABEL}>{t('settings.memoryRelations')}</h3>

      {sections.map(section => (
        <div key={section.tie} className="flex flex-col gap-1.5">
          <p className={cn(WINDOW_CAPTION, 'm-0')}>{t(TIE_KEYS[section.tie])}</p>

          <ul className="m-0 flex list-none flex-col gap-1.5 pl-3">
            {section.rows.map(row => (
              <li key={row.label} className="flex flex-col gap-1.5">
                <MemoryRelationsRow row={row} onOpen={onOpen} />

                {row.alsoAbout.length > 0 && (
                  <ul className="m-0 flex list-none flex-col gap-1.5 pl-4">
                    {row.alsoAbout.map(one => (
                      <li key={one.memoryId ?? one.label} className="flex items-baseline gap-1.5">
                        <MemoryRelationsRow row={one} onOpen={onOpen} />
                        <span className={WINDOW_CAPTION}>{t('settings.memoryAlsoAbout')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
