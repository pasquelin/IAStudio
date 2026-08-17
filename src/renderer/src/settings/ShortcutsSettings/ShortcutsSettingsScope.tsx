import { useTranslation } from 'react-i18next'
import type {
  BindingOverrides,
  CommandDescriptor,
  CommandId,
  CommandScope,
} from '@shared/domain/command'
import type { Signature } from '@shared/domain/shortcut'
import { ShortcutsSettingsCommandRow } from './ShortcutsSettingsCommandRow'

export function ShortcutsSettingsScope({
  scope,
  descriptors,
  overrides,
  clashing,
  capturing,
  onCapture,
  onBind,
}: {
  scope: CommandScope
  descriptors: readonly CommandDescriptor[]
  overrides: BindingOverrides
  clashing: ReadonlySet<CommandId>
  capturing: CommandId | null
  onCapture: (id: CommandId | 'search' | null) => void
  onBind: (id: CommandId, signature: Signature | null) => void
}) {
  const { t } = useTranslation()

  if (descriptors.length === 0) return null

  return (
    <section>
      <h3 className="text-base-content/70 text-tiny mb-1 tracking-wide uppercase">
        {t(`settings.scope.${scope}`)}
      </h3>

      {descriptors.map(descriptor => (
        <ShortcutsSettingsCommandRow
          key={descriptor.id}
          descriptor={descriptor}
          overrides={overrides}
          clashing={clashing.has(descriptor.id)}
          capturing={capturing === descriptor.id}
          onCapture={() => onCapture(capturing === descriptor.id ? null : descriptor.id)}
          onBind={signature => onBind(descriptor.id, signature)}
        />
      ))}
    </section>
  )
}
