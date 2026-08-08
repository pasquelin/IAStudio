import { useTranslation } from 'react-i18next'
import { homeSectionLimit } from '@shared/domain/home'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { timeAgo } from '@/helpers/relative-time'
import { useActivity } from '@/stores/activity'
import { useSettings } from '@/stores/settings'
import { GLYPHS } from '@/app/ActivityList'
import { Section } from '../Section'

const TINTS = {
  info: 'text-muted',
  warn: 'text-warning',
  error: 'text-danger',
}

/**
 * The last things this project did, and the last things it failed to do.
 *
 * Read from the store the journal panel already fills, and drawn with the same glyphs: a
 * failure must not look like one thing on the home and another in the panel it leads to.
 */
export function Activity() {
  const { t, i18n } = useTranslation()
  const entries = useActivity(state => state.entries)
  const sections = useSettings(state => state.settings.home.sections)

  const shown = entries.slice(0, homeSectionLimit(sections, 'activity'))
  if (shown.length === 0) return null

  return (
    <Section title={t('home.sections.activity')}>
      <ul className="bg-surface m-0 flex list-none flex-col rounded-(--radius-sc-lg) p-2">
        {shown.map(entry => (
          <li key={entry.id} className="flex items-center gap-2 px-1 py-1">
            <UiIcon
              path={GLYPHS[entry.level]}
              size={14}
              className={cn('shrink-0', TINTS[entry.level])}
            />
            <span className="text-text min-w-0 flex-1 truncate text-[11px]">
              {t(entry.messageKey, entry.params)}
            </span>
            <span className="text-muted shrink-0 text-[11px]">
              {timeAgo(entry.at, i18n.language)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
