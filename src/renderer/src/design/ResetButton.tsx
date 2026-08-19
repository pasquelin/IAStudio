import { mdiBackupRestore } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { TIP_LEFT } from '@/helpers/tooltip'
import { ToolButton } from './ToolButton'

export type ResetButtonProps = {
  /** Absent means the line already stands at its default — the button is not drawn at all. */
  onReset?: () => void
}

/**
 * Puts a property back where it started. Written once because every family of field ends its line
 * with the same button, and the two that had it first spelt out the same four props.
 *
 * It draws NOTHING while the value is already the default: a row of controls that do nothing is
 * how a panel stops being read. Whoever owns the value decides that, since only they know what
 * the default is — a mesh reads its own primitive's factory, a transform reads the identity.
 */
export function ResetButton({ onReset }: ResetButtonProps) {
  const { t } = useTranslation()

  if (!onReset) return null

  return (
    <ToolButton
      icon={mdiBackupRestore}
      label={t('inspector.reset')}
      description={t('inspector.resetHint')}
      tooltip={TIP_LEFT}
      variant="header"
      onClick={onReset}
    />
  )
}
