import { useTranslation } from 'react-i18next'
import { SettingLine } from '../SettingLine'
import { WINDOW_HELP } from '@/design/windowStyles'

/**
 * One gesture of the upkeep section: a title, a sentence saying what there is to do, a button.
 *
 * 🛑 Written once because it was written five times, and the copies had already drifted — three
 * lines carried a plain button, one a primary and one an outlined error, for no rule anybody
 * could state. `SettingActionsRow` is the same shape and cannot serve here: it takes a
 * `SettingAction` of the registry, and these gestures answer a memory rather than a setting.
 */
export function MemoryAction({
  title,
  help,
  button,
  disabled = false,
  confirm,
  onRun,
}: {
  title: string
  /** What there is to do right now — « nothing to merge », « twelve of them ». */
  help: string
  button: string
  disabled?: boolean
  /** The sentence a destructive gesture asks first. Its presence is what paints the button. */
  confirm?: string
  onRun: () => void
}) {
  const { t } = useTranslation()

  return (
    <SettingLine title={title} help={<p className={WINDOW_HELP}>{help}</p>}>
      <button
        type="button"
        className={confirm ? 'btn btn-sm btn-error btn-outline' : 'btn btn-sm'}
        disabled={disabled}
        // Asked for once, plainly: what these erase no Cancel button covers.
        onClick={() => {
          if (confirm === undefined || window.confirm(t(confirm))) onRun()
        }}
      >
        {button}
      </button>
    </SettingLine>
  )
}
