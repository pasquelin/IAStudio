import { mdiRestore } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { defaultAt } from '@shared/domain/settingsPath'
import { descriptorAt, type SettingDescriptor } from '@shared/domain/settingsRegistry'
import { UiIcon } from '@/design/UiIcon'
import { TIP_LEFT } from '@/helpers/tooltip'
import { SettingLine } from '../SettingLine'
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
        describedBy={describedBy}
        value={value}
        onChange={next => stage(descriptor.path, next)}
      />

      <button
        type="button"
        // The studio's tooltip rather than `title`: the native one comes with the OS delay and
        // none of the theme, and this window now mounts the shared host like every other.
        {...TIP_LEFT(t('settings.restoreDefault'), false, t('settings.restoreDefaultHint'))}
        // Kept in place rather than unmounted: a button appearing between the control and the
        // edge would shift the whole row the moment a value is touched.
        className="btn btn-ghost btn-xs btn-square"
        disabled={!restorable}
        onClick={() => stage(descriptor.path, fallback)}
      >
        <UiIcon path={mdiRestore} size={14} className={restorable ? '' : 'opacity-0'} />
      </button>
    </SettingLine>
  )
}
