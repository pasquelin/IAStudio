import { useTranslation } from 'react-i18next'
import type { SettingPath } from '@shared/domain/settingsPath'
import { SETTING_REGISTRY } from '@shared/domain/settingsRegistry'
import { WindowNavItem } from '@/components/WindowNav/WindowNavItem'
import { useSettingsDraft } from '@/stores/settingsDraft'
import { SettingStagedDot } from '../SettingStagedDot'
import type { SettingsSection } from '../sections'

/** Whether anything under a section is staged — its own settings, or a sub-section's. */
function sectionIsStaged(touched: ReadonlySet<SettingPath>, section: SettingsSection): boolean {
  const ids = [section.id, ...section.children.map(child => child.id)]
  return SETTING_REGISTRY.some(
    descriptor => touched.has(descriptor.path) && ids.includes(descriptor.section),
  )
}

export function SettingsWindowNavigationEntry({
  section,
  depth,
  selected,
  onSelect,
}: {
  section: SettingsSection
  depth: number
  selected: string
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const active = selected === section.id
  // A section is marked when anything under it is staged, sub-sections included: the change
  // would otherwise be invisible from a tree the user has navigated away from.
  const staged = useSettingsDraft(state => sectionIsStaged(state.touched, section))

  return (
    <WindowNavItem
      active={active}
      hint={t(staged ? 'settings.sectionStagedHint' : 'settings.sectionHint')}
      onSelect={() => onSelect(section.id)}
      depth={depth}
      className="gap-1.5 pr-3"
      nested={
        section.children.length > 0 && (
          <ul className="m-0 list-none p-0">
            {section.children.map(child => (
              <SettingsWindowNavigationEntry
                key={child.id}
                section={child}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )
      }
    >
      {t(section.labelKey)}
      {/* The ink only: on a selected entry the column is painted `bg-primary` itself. */}
      <SettingStagedDot
        staged={staged}
        label={t('settings.modified')}
        className={active ? 'bg-primary-content' : undefined}
      />
    </WindowNavItem>
  )
}
