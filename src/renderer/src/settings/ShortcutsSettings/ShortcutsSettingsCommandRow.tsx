import { mdiAlertCircleOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { bindingOf, type BindingOverrides, type CommandDescriptor } from '@shared/domain/command'
import type { Signature } from '@shared/domain/shortcut'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { useChordCapture } from '@/hooks/useChordCapture'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { HINT_LEFT } from '@/helpers/tooltip'
import { SettingLine } from '../SettingLine'
import { SettingRestoreButton } from '../SettingRestoreButton'
import { WINDOW_HELP } from '@/design/windowStyles'
import { withPlatformDefaults } from '@/stores/bindings'

export function ShortcutsSettingsCommandRow({
  descriptor,
  overrides,
  clashing,
  capturing,
  onCapture,
  onBind,
}: {
  descriptor: CommandDescriptor
  overrides: BindingOverrides
  clashing: boolean
  capturing: boolean
  onCapture: () => void
  onBind: (signature: Signature | null) => void
}) {
  const { t } = useTranslation()
  const label = useShortcutLabel()

  useChordCapture(signature => (signature === '' ? onCapture() : onBind(signature)), capturing)

  const binding = bindingOf(descriptor.id, withPlatformDefaults(overrides))
  const remapped = overrides[descriptor.id] !== undefined
  const id = `command-${descriptor.id}`
  const describedBy = `${id}-help`

  return (
    <SettingLine
      title={t(descriptor.titleKey)}
      help={
        <p id={describedBy} className={WINDOW_HELP}>
          {t(descriptor.helpKey)}
        </p>
      }
    >
      <>
        {clashing && (
          <span className="text-error flex" title={t('settings.shortcutConflict')}>
            <UiIcon path={mdiAlertCircleOutline} size={14} />
          </span>
        )}

        <button
          id={id}
          type="button"
          aria-describedby={describedBy}
          aria-label={t(descriptor.titleKey)}
          {...HINT_LEFT(t('settings.captureHint'))}
          onClick={onCapture}
          className={cn(
            'btn btn-sm w-40 font-mono',
            capturing && 'btn-primary',
            clashing && !capturing && 'btn-error btn-outline',
          )}
        >
          {capturing ? t('settings.pressAKey') : label(binding) || t('settings.unbound')}
        </button>

        <SettingRestoreButton
          restorable={remapped}
          of={t(descriptor.titleKey)}
          onRestore={() => onBind(null)}
        />
      </>
    </SettingLine>
  )
}
