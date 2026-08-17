import { useTranslation } from 'react-i18next'
import { sectionEntry } from '@shared/domain/settings-registry'
import { hitId, sectionsOf, type SearchHit } from '@shared/domain/settings-search'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { WINDOW_CAPTION } from '@/design/window-styles'
import { SettingList } from '../SettingList'
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
    return <p className={WINDOW_CAPTION}>{t('settings.noResult')}</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {sectionsOf(found).map(section => (
        <section key={section}>
          <button
            type="button"
            {...HINT_RIGHT(t('settings.searchSectionHint'))}
            onClick={() => onGo(section)}
            className="text-base-content/70 hover:text-base-content text-tiny mb-1 tracking-wide uppercase"
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
