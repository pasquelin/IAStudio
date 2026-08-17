import type { BindingOverrides } from '@shared/domain/command'
import { useSettings } from '@/stores/settings'
import { useSettingsDraft } from '@/stores/settingsDraft'

/**
 * The bindings as they stand, buffer included. Staged like every other setting: a remap is not
 * written until Apply, which is what makes Cancel able to take it back.
 */
export function useOverrides(): [BindingOverrides, (next: BindingOverrides) => void] {
  const stored = useSettings(state => state.settings.shortcuts.overrides)
  const staged = useSettingsDraft(state => state.pending.shortcuts?.overrides)
  const stageBranch = useSettingsDraft(state => state.stageBranch)

  return [staged ?? stored, next => stageBranch({ shortcuts: { overrides: next } })]
}
