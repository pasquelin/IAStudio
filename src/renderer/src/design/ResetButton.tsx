import { mdiBackupRestore } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { TIP_LEFT } from '@/helpers/tooltip'
import { ToolButton } from './ToolButton'

export type ResetButtonProps = {
  /** Absent means the line already stands at its default — the button is drawn, but inert. */
  onReset?: () => void
}

/**
 * Puts a property back where it started. Written once because every family of field ends its line
 * with the same button, and the two that had it first spelt out the same four props.
 *
 * Always DRAWN, disabled while the value is already its default — decision of 2026-08-19. Drawing
 * it only when it acts made the field narrow under the pointer mid-drag, the button appearing at
 * the very moment the value left its default. Whoever owns the value decides what that default is:
 * a mesh reads its own primitive's factory, a transform reads the identity.
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
