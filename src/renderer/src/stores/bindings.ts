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

/**
 * Motion by key code, inverted once at module level rather than per keystroke: this is read on
 * every keydown AND keyup, and holding a direction to fly the camera repeats keydown.
 */
const MOTION_BY_CODE: ReadonlyMap<Signature, MotionId> = new Map(
  // `as`: `Object.entries` widens the key to `string`, and the table is keyed by `MotionId`.
  (Object.entries(DEFAULT_MOTION) as [MotionId, readonly Signature[]][]).flatMap(([id, bound]) =>
    bound.map((code): [Signature, MotionId] => [code, id]),
  ),
)

/**
 * The direction a physical key holds, or nothing. Read on `KeyboardEvent.code` rather than on a
 * signature: boost IS Shift, so a signature would spell it `Shift+ShiftLeft` and spell every
 * direction pressed under it `Shift+…` — a table of bare codes matches none of those.
 */
export function motionFor(code: string): MotionId | null {
  return MOTION_BY_CODE.get(code) ?? null
}
