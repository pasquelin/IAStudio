import { useTranslation } from 'react-i18next'
import type { SettingAction } from '@shared/domain/settingsRegistry'
import { getBridge } from '@/services/bridge'
import { SettingActionLine } from '../SettingActionLine'
import { useSettingsDraft } from '@/stores/settingsDraft'

/**
 * A button that acts, rather than a setting that holds a value — which is why these live in a
 * registry of their own and never pass through the editing buffer: there is nothing to apply.
 */
export function SettingActionsRow({ action }: { action: SettingAction }) {
  const { t } = useTranslation()
  const cancel = useSettingsDraft(state => state.cancel)

  // 🛑 No confirming here: `SettingActionLine` owns that gesture, and asking on both sides put
  // the same question up twice in a row on `advanced.reset` and on the Resolve bridge.
  const run = (): void => {
    // A reset would be immediately overwritten by whatever the buffer still holds.
    if (action.id === 'advanced.reset') cancel()

    void getBridge()?.settings.runAction(action.id)
  }

  return (
    <SettingActionLine
      title={t(action.titleKey)}
      help={t(action.helpKey)}
      button={t(action.buttonKey)}
      {...(action.confirmKey ? { confirm: t(action.confirmKey) } : {})}
      onRun={run}
    />
  )
}
