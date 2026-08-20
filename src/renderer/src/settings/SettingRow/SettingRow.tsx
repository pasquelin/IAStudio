import { useTranslation } from 'react-i18next'
import { defaultAt } from '@shared/domain/settingsPath'
import { descriptorAt, type SettingDescriptor } from '@shared/domain/settingsRegistry'
import { SettingLine } from '../SettingLine'
import { SettingRestoreButton } from '../SettingRestoreButton'
import { useSettingsDraft, useSettingValue } from '@/stores/settingsDraft'
import { WINDOW_HELP } from '@/design/windowStyles'
import { SettingRowControl } from './SettingRowControl'

/**
 * One setting, rendered from its descriptor alone: its name, what it does in plain words, its
 * control, and — once it differs from the default — a way back. No screen writes a control by
 * hand, so two settings of the same kind cannot end up behaving differently.
 */
export function SettingRow({ descriptor }: { descriptor: SettingDescriptor }) {
  const { t } = useTranslation()
  // Selected down to the leaf, not the whole settings object: that one is rebuilt on every
  // write, so a row would re-render whenever any other setting — or the open project — moved.
  const value = useSettingValue(descriptor.path)
  const staged = useSettingsDraft(state => state.touched.has(descriptor.path))
  const stage = useSettingsDraft(state => state.stage)

  // Read through the same rule as any other value, buffer included: turning the grid off must
  // grey its size immediately, not once the change has been applied.
  const requirement = descriptor.dependsOn
  const required = useSettingValue(requirement?.path)
  const enabled = !requirement || required === requirement.equals

  const fallback = defaultAt(descriptor.path)
  // Two different ideas, and they used to share one affordance: `staged` is "changed, not yet
  // applied", `restorable` is "no longer what it ships with".
  const restorable = value !== fallback

  const id = `setting-${descriptor.path}`
  const describedBy = `${id}-help`

  return (
    <SettingLine
      title={t(descriptor.titleKey)}
      labelFor={id}
      // Marks the row AND, through the section it belongs to, the entry in the tree.
      staged={staged}
      stagedLabel={t('settings.modified')}
      disabled={!enabled}
      help={
        <p id={describedBy} className={WINDOW_HELP}>
          {t(descriptor.helpKey)}
          {/* A greyed control that does not say why is a dead end. */}
          {!enabled && requirement && (
            <span className="text-warning block">
              {t('settings.requires', {
                setting: t(descriptorAt(requirement.path)?.titleKey ?? ''),
              })}
            </span>
          )}
        </p>
      }
    >
      <SettingRowControl
        descriptor={descriptor}
        id={id}
        scId={`setting.${descriptor.path}`}
        describedBy={describedBy}
        value={value}
        onChange={next => stage(descriptor.path, next)}
      />

      <SettingRestoreButton
        restorable={restorable}
        onRestore={() => stage(descriptor.path, fallback)}
      />
    </SettingLine>
  )
}
