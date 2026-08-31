import { useTranslation } from 'react-i18next'
import type {
  BindingOverrides,
  CommandDescriptor,
  CommandId,
  CommandScope,
} from '@shared/domain/command'
import type { Signature } from '@shared/domain/shortcut'
import { WINDOW_GROUP_LABEL } from '@/components/windowStyles'
import { ShortcutsSettingsCommandRow } from './ShortcutsSettingsCommandRow'

export function ShortcutsSettingsScope({
  scope,
  descriptors,
  overrides,
  resolved,
  clashing,
  capturing,
  onCapture,
  onBind,
}: {
  scope: CommandScope
  descriptors: readonly CommandDescriptor[]
  overrides: BindingOverrides
  /** The same table, merged with what this system ships. What a row SHOWS reads this one. */
  resolved: BindingOverrides
  clashing: ReadonlySet<CommandId>
  capturing: CommandId | null
  onCapture: (id: CommandId | 'search' | null) => void
  onBind: (id: CommandId, signature: Signature | null) => void
}) {
  const { t } = useTranslation()

  if (descriptors.length === 0) return null

  return (
    <section>
      <h3 className={WINDOW_GROUP_LABEL}>{t(`settings.scope.${scope}`)}</h3>

      {descriptors.map(descriptor => (
        <ShortcutsSettingsCommandRow
          key={descriptor.id}
          descriptor={descriptor}
          overrides={overrides}
          resolved={resolved}
          clashing={clashing.has(descriptor.id)}
          capturing={capturing === descriptor.id}
          onCapture={() => onCapture(capturing === descriptor.id ? null : descriptor.id)}
          onBind={signature => onBind(descriptor.id, signature)}
        />
      ))}
    </section>
  )
}
