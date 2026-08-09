import { useTranslation } from 'react-i18next'
import { homeSectionLimit } from '@shared/domain/home'
import { timeAgo } from '@/helpers/relative-time'
import { useActivity } from '@/stores/activity'
import { useSettings } from '@/stores/settings'
import { ActivityRow } from '@/app/ActivityList'
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
          <ActivityRow
            key={entry.id}
            entry={entry}
            time={timeAgo(entry.at, i18n.language)}
            className="px-1 py-1"
          />
        ))}
      </ul>
    </Section>
  )
}
