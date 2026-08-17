import type { SettingDescriptor } from '@shared/domain/settings-registry'
import { SettingRow } from './SettingRow/SettingRow'

/**
 * A run of settings. Used both by a section showing what it owns and by the search showing
 * what it found, so a setting looks the same however it was reached.
 */
export function SettingList({ descriptors }: { descriptors: readonly SettingDescriptor[] }) {
  return (
    <div className="flex max-w-2xl flex-col">
      {descriptors.map(descriptor => (
        <SettingRow key={descriptor.path} descriptor={descriptor} />
      ))}
    </div>
  )
}
