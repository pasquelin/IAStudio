import { mdiRestore } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { UiIcon } from '@/design/UiIcon'
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
    <button
      type="button"
      // The studio's tooltip rather than `title`: the native one comes with the OS delay and
      // none of the theme, and these windows mount the shared host like every other.
      {...TIP_LEFT(title, false, t('settings.restoreDefaultHint'))}
      className="btn btn-ghost btn-xs btn-square"
      disabled={!restorable}
      onClick={onRestore}
    >
      <UiIcon path={mdiRestore} size={14} className={restorable ? '' : 'opacity-0'} />
    </button>
  )
}
