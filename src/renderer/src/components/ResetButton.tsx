import { mdiBackupRestore } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { TIP_LEFT } from '@/helpers/tooltip'
import { ToolButton } from './ToolButton'

export type ResetButtonProps = {
  /** Absent means the line already stands at its default — the button is drawn, but inert. */
  onReset?: () => void
}

/**
 * Puts a property back where it started, written once for every family of field.
 *
 * Always drawn and disabled at its default: drawn only when it acts, it narrowed the field under
 * the pointer mid-drag. Whoever owns the value says what that default is.
 */
export function ResetButton({ onReset }: ResetButtonProps) {
  const { t } = useTranslation()

  return (
    <ToolButton
      icon={mdiBackupRestore}
      label={t('inspector.reset')}
      description={t('inspector.resetHint')}
      tooltip={TIP_LEFT}
      variant="header"
      disabled={!onReset}
      onClick={onReset}
    />
  )
}
