import { mdiAlertCircleOutline } from '@mdi/js'
import { WINDOW_ACTION_QUIET } from '@/design/windowStyles'
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

export function ShortcutsSettingsCommandRow({
  descriptor,
  overrides,
  resolved,
  clashing,
  capturing,
  onCapture,
  onBind,
}: {
  descriptor: CommandDescriptor
  /** The stored table — what says whether this line is REMAPPED. */
  overrides: BindingOverrides
  /** The same, merged with what this system ships — what the line SHOWS. */
  resolved: BindingOverrides
  clashing: boolean
  capturing: boolean
  onCapture: () => void
  onBind: (signature: Signature | null) => void
}) {
  const { t } = useTranslation()
  const label = useShortcutLabel()

  useChordCapture(signature => (signature === '' ? onCapture() : onBind(signature)), capturing)

  // Shown from the resolved table, remapped from the stored one: a key this system ships is
  // not something the user changed.
  const binding = bindingOf(descriptor.id, resolved)
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
          // The base is the role; the two words after it are STATE, which no role names — see the
          // blind spot `no-loose-window-button.test.ts` writes out.
          className={cn(
            WINDOW_ACTION_QUIET,
            'w-40 font-mono',
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
