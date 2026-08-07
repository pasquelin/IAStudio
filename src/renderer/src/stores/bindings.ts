import { bindingOf, type BindingOverrides, type CommandId } from '@shared/domain/command'
import { DEFAULT_MOTION, type MotionId, type Signature } from '@shared/domain/shortcut'
import { useSettings } from './settings'

/**
 * The keyboard bindings, which are settings like any other: shared by every window, saved with
 * the profile, and editable from the shortcuts screen.
 *
 * They used to live in this window's `localStorage`, where a remap reached neither the other
 * windows nor the native menu — and where no screen could edit them at all.
 */
export function useBindingOverrides(): BindingOverrides {
  return useSettings(state => state.settings.shortcuts.overrides)
}

/** The key one command answers to, for a tooltip or a toolbar. */
export function useBinding(id: CommandId): Signature | null {
  return useSettings(state => bindingOf(id, state.settings.shortcuts.overrides))
}

/** Read outside React, on a keydown: subscribing per event would be a subscription per frame. */
export function currentOverrides(): BindingOverrides {
  return useSettings.getState().settings.shortcuts.overrides
}

/** Motion is held rather than fired, and is not remappable yet — see `DEFAULT_MOTION`. */
export function motionFor(signature: Signature): MotionId | null {
  const found = Object.entries(DEFAULT_MOTION).find(([, bound]) => bound === signature)
  return found ? (found[0] as MotionId) : null
}
