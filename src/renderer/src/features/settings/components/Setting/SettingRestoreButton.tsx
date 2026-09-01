import { mdiRestore } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { WindowIconButton } from '@/components/WindowIconButton'
import { TIP_LEFT } from '@/helpers/tooltip'

export type SettingRestoreButtonProps = {
  /** Whether the value still differs from what the application ships with. */
  restorable: boolean
  /** What is restored, already translated — for a row whose own label the tooltip cannot show. */
  of?: string
  onRestore: () => void
}

/**
 * The way back to the FACTORY value of one setting — not to the one held before the window opened,
 * which is what Cancel is for. Kept in place rather than unmounted: a button appearing between the
 * control and the edge would shift the whole row the moment a value is touched.
 */
export function SettingRestoreButton({ restorable, of, onRestore }: SettingRestoreButtonProps) {
  const { t } = useTranslation()
  const title =
    of === undefined ? t('settings.restoreDefault') : `${t('settings.restoreDefault')} — ${of}`

  return (
    <WindowIconButton
      path={mdiRestore}
      label={title}
      // The studio's tooltip rather than `title`: the native one comes with the OS delay and
      // none of the theme, and these windows mount the shared host like every other.
      tooltip={TIP_LEFT(title, false, t('settings.restoreDefaultHint'))}
      disabled={!restorable}
      faded={!restorable}
      onClick={onRestore}
    />
  )
}
