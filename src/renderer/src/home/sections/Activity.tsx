import { useTranslation } from 'react-i18next'
import { homeSectionLimit } from '@shared/domain/home'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { timeAgo } from '@/helpers/relative-time'
import { useActivity } from '@/stores/activity'
import { useSettings } from '@/stores/settings'
import { ActivityMessage, GLYPHS, TINTS } from '@/app/ActivityList'
import { SHELF_BLOCK } from '../styles'
import { Section } from '../Section'

/**
 * The last things this project did, and the last things it failed to do.
 *
 * Drawn with the journal panel's own glyphs, tints and message — a failure must not look like
 * one thing on the home and another in the panel it leads to, and the detail under a failed
 * line is what someone asked "what went wrong" actually reads.
 */
export function Activity() {
  const { t, i18n } = useTranslation()
  const entries = useActivity(state => state.entries)
  const sections = useSettings(state => state.settings.home.sections)

  const shown = entries.slice(0, homeSectionLimit(sections, 'activity'))
  if (shown.length === 0) return null

  return (
    <Section id="activity" title={t('home.sections.activity')}>
      <ul className={SHELF_BLOCK}>
        {shown.map(entry => (
          <li key={entry.id} className="flex items-start gap-2 px-1 py-1">
            <UiIcon
              path={GLYPHS[entry.level]}
              size={14}
              className={cn('mt-px shrink-0', TINTS[entry.level])}
            />
            <ActivityMessage entry={entry} />
            <span className="text-muted shrink-0 text-[11px]">
              {timeAgo(entry.at, i18n.language)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
