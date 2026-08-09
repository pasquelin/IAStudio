import { useTranslation } from 'react-i18next'
import type { SettingsSectionId } from '@shared/domain/settings'
import { actionsIn, type SettingAction } from '@shared/domain/settings-registry'
import { getBridge } from '@/services/bridge'
import { useSettingsDraft } from '@/stores/settings-draft'

/**
 * A button that acts, rather than a setting that holds a value — which is why these live in a
 * registry of their own and never pass through the editing buffer: there is nothing to apply.
 */
function ActionRow({ action }: { action: SettingAction }) {
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
    <div className="border-base-300 flex flex-col gap-2 border-b py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium">{t(action.titleKey)}</span>

        <button
          type="button"
          onClick={run}
          className={action.confirmKey ? 'btn btn-sm btn-error btn-outline' : 'btn btn-sm'}
        >
          {t(action.buttonKey)}
        </button>
      </div>

      <p className="text-base-content/60 max-w-lg text-xs">{t(action.helpKey)}</p>
    </div>
  )
}

export function SettingActions({ section }: { section: SettingsSectionId }) {
  const actions = actionsIn(section)

  if (actions.length === 0) return null

  return (
    <div>
      {actions.map(action => (
        <ActionRow key={action.id} action={action} />
      ))}
    </div>
  )
}
