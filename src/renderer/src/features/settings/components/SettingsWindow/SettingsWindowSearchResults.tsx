import { useTranslation } from 'react-i18next'
import { WindowNote } from '@/components/WindowNote'
import { sectionEntry } from '@shared/domain/settingsRegistry'
import { hitId, sectionsOf, type SearchHit } from '@shared/domain/settingsSearch'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { WINDOW_GROUP_LABEL } from '@/components/windowStyles'
import { cn } from '@/helpers/cn'
import { SettingList } from '../Setting/SettingList'
import { SettingsWindowResultRow } from './SettingsWindowResultRow'

/**
 * What was found, grouped by the screen it lives on and labelled so a hit can be acted upon
 * without first working out what kind of thing it is.
 *
 * A command is not editable here: it is shown with its key, and the section it belongs to says
 * where to go. Rendering a capture button in a result list would give two places to remap from.
 */
export function SettingsWindowSearchResults({
  found,
  onGo,
}: {
  found: readonly SearchHit[]
  onGo: (id: string) => void
}) {
  const { t } = useTranslation()

  if (found.length === 0) {
    return <WindowNote>{t('settings.noResult')}</WindowNote>
  }

  return (
    <div className="flex flex-col gap-4">
      {sectionsOf(found).map(section => (
        <section key={section}>
          <button
            type="button"
            {...HINT_RIGHT(t('settings.searchSectionHint'))}
            onClick={() => onGo(section)}
            className={cn(WINDOW_GROUP_LABEL, 'hover:text-base-content')}
          >
            {t(sectionEntry(section)?.labelKey ?? '')}
          </button>

          <SettingList
            descriptors={found.flatMap(hit =>
              hit.section === section && hit.kind === 'setting' ? [hit.descriptor] : [],
            )}
          />

          {found
            .filter(hit => hit.section === section && hit.kind !== 'setting')
            .map(hit => (
              <SettingsWindowResultRow key={hitId(hit)} hit={hit} onGo={() => onGo(section)} />
            ))}
        </section>
      ))}
    </div>
  )
}
