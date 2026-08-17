import { useTranslation } from 'react-i18next'
import type { SettingAction } from '@shared/domain/settingsRegistry'
import { getBridge } from '@/services/bridge'
import { HINT_LEFT } from '@/helpers/tooltip'
import { SettingLine } from '../SettingLine'
import { useSettingsDraft } from '@/stores/settingsDraft'
import { WINDOW_HELP } from '@/design/window-styles'

/**
 * A button that acts, rather than a setting that holds a value — which is why these live in a
 * registry of their own and never pass through the editing buffer: there is nothing to apply.
 */
export function SettingActionsRow({ action }: { action: SettingAction }) {
  const { t } = useTranslation()
  const cancel = useSettingsDraft(state => state.cancel)

  const run = (): void => {
    // Asked for once, plainly: these cannot be taken back, and no Cancel button covers them.
    if (action.confirmKey && !window.confirm(t(action.confirmKey))) return

    // A reset would be immediately overwritten by whatever the buffer still holds.
    if (action.id === 'advanced.reset') cancel()

    void getBridge()?.settings.runAction(action.id)
  }

  return (
    <SettingLine
      title={t(action.titleKey)}
      help={<p className={WINDOW_HELP}>{t(action.helpKey)}</p>}
    >
      <button
        type="button"
        // The action's own help, under the pointer: the pane shows it beside the row, and a
        // narrow window pushes it out of sight before the button goes with it.
        {...HINT_LEFT(t(action.helpKey))}
        onClick={run}
        className={action.confirmKey ? 'btn btn-sm btn-error btn-outline' : 'btn btn-sm'}
      >
        {t(action.buttonKey)}
      </button>
    </SettingLine>
  )
}
