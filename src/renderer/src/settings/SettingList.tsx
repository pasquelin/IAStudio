import type { SettingDescriptor } from '@shared/domain/settingsRegistry'
import { SettingRow } from './SettingRow/SettingRow'
import { SETTING_COLUMN } from './settingStyles'

/**
 * A run of settings. Used both by a section showing what it owns and by the search showing
 * what it found, so a setting looks the same however it was reached.
 */
export function SettingList({ descriptors }: { descriptors: readonly SettingDescriptor[] }) {
  return (
    <div className={SETTING_COLUMN}>
      {descriptors.map(descriptor => (
        <SettingRow key={descriptor.path} descriptor={descriptor} />
      ))}
    </div>
  )
}
