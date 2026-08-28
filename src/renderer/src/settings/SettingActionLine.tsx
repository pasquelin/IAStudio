import { useTranslation } from 'react-i18next'
import { HINT_LEFT } from '@/helpers/tooltip'
import {
  WINDOW_ACTION,
  WINDOW_ACTION_DANGER,
  WINDOW_ACTION_QUIET,
  WINDOW_HELP,
} from '@/design/windowStyles'
import { SettingLine } from './SettingLine'

/** What paints the button, where nothing is being confirmed — see `WINDOW_ACTION_QUIET`. */
export type SettingActionTone = 'action' | 'quiet'

export type SettingActionLineProps = {
  title: string
  /** What there is to do right now — « nothing to merge », « twelve of them ». Already translated. */
  help: string
  /** The word on the button, already translated. */
  button: string
  disabled?: boolean
  /** The sentence a destructive gesture asks first. Its presence is what paints the button. */
  confirm?: string
  tone?: SettingActionTone
  onRun: () => void
}

/**
 * A line that ACTS: a title, a sentence saying what there is to do, and one button.
 *
 * 🛑 Written once because it was written three times, and the three had already drifted —
 * `SettingActionsRow` painted primary where `MemoryAction` painted plain, and `MemoryUpkeep`
 * spelt a fourth inline. Nothing read those class strings, so nothing went red: the section that
 * reindexes and compacts read as a run of cancellations for as long as it stood.
 *
 * The tooltip is posed HERE and not left to the caller, for the same reason: one of the three
 * carried it and the other two did not, and `CLAUDE.md` asks every button to explain itself.
 */
export function SettingActionLine({
  title,
  help,
  button,
  disabled = false,
  confirm,
  tone = 'action',
  onRun,
}: SettingActionLineProps) {
  const { t } = useTranslation()

  return (
    <SettingLine title={title} help={<p className={WINDOW_HELP}>{help}</p>}>
      <button
        type="button"
        // The help under the pointer too: a narrow window pushes the sentence beside the row out
        // of sight well before it takes the button with it.
        {...HINT_LEFT(help)}
        className={
          confirm ? WINDOW_ACTION_DANGER : tone === 'quiet' ? WINDOW_ACTION_QUIET : WINDOW_ACTION
        }
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
