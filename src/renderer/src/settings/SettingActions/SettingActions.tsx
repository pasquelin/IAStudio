import type { SettingsSectionId } from '@shared/domain/settings'
import { actionsIn } from '@shared/domain/settings-registry'
import { SettingActionsRow } from './SettingActionsRow'

export function SettingActions({ section }: { section: SettingsSectionId }) {
  const actions = actionsIn(section)

  if (actions.length === 0) return null

  return (
    <div>
      {actions.map(action => (
        <SettingActionsRow key={action.id} action={action} />
      ))}
    </div>
  )
}
