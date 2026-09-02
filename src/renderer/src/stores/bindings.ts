import {
  bindingOf,
  platformDefaults,
  type BindingOverrides,
  type CommandId,
} from '@shared/domain/command'
import { DEFAULT_MOTION, type MotionId, type Signature } from '@shared/domain/shortcut'
import { SCHEME_OF, type NavigationPreset } from '@shared/domain/navigationPreset'
import { IS_MAC } from '@/helpers/platform'
import { useSettings } from './settings'

const PLATFORM_DEFAULTS = platformDefaults(IS_MAC)

/**
 * The remaps over what this system ships. Cached on the identity of the stored object: this is
 * read on every keystroke, and a fresh merge per press would be a new object every time — which
 * a zustand selector reads as a change and re-renders on.
 *
 * 🛑 What SHOWS a binding reads this; what WRITES one reads the stored table. Merged into the
 * written table, the platform's own keys would be saved as though the user had remapped them —
 * which is also why a row asks the stored table whether it is remapped.
 */
let mergedFrom: { overrides: BindingOverrides; preset: NavigationPreset } | null = null
let merged: BindingOverrides = PLATFORM_DEFAULTS

/**
 * Three layers, and the person's own is the last: what this system ships, then what the chosen
 * application binds differently, then every remap that was actually made — see `navigationPreset`.
 */
function withPlatformDefaults(
  overrides: BindingOverrides,
  preset: NavigationPreset,
): BindingOverrides {
  if (mergedFrom?.overrides !== overrides || mergedFrom.preset !== preset) {
    mergedFrom = { overrides, preset }
    merged = { ...PLATFORM_DEFAULTS, ...SCHEME_OF[preset].bindings, ...overrides }
  }
  return merged
}

/**
 * The same merge, uncached, for a table the store does not hold — the shortcuts screen reads its
 * own draft. 🛑 Never `withPlatformDefaults`: its memo has ONE slot, and two identities alternating
 * through it would make `useBindingOverrides` answer a fresh object every other read, which is
 * exactly what `useSyncExternalStore` refuses. The caller memoises.
 */
export function resolveBindings(
  overrides: BindingOverrides,
  preset: NavigationPreset,
): BindingOverrides {
  return { ...PLATFORM_DEFAULTS, ...SCHEME_OF[preset].bindings, ...overrides }
}

/**
 * The keyboard bindings, which are settings like any other: shared by every window, saved with
 * the profile, and editable from the shortcuts screen.
 *
 * They used to live in this window's `localStorage`, where a remap reached neither the other
 * windows nor the native menu — and where no screen could edit them at all.
 */
export function useBindingOverrides(): BindingOverrides {
  return useSettings(state =>
    withPlatformDefaults(state.settings.shortcuts.overrides, state.settings.three.navigationPreset),
  )
}

/** The key one command answers to, for a tooltip or a toolbar. */
export function useBinding(id: CommandId): Signature | null {
  return useSettings(state =>
    bindingOf(
      id,
      withPlatformDefaults(
        state.settings.shortcuts.overrides,
        state.settings.three.navigationPreset,
      ),
    ),
  )
}

/** Read outside React, on a keydown: subscribing per event would be a subscription per frame. */
export function currentOverrides(): BindingOverrides {
  const { shortcuts, three } = useSettings.getState().settings
  return withPlatformDefaults(shortcuts.overrides, three.navigationPreset)
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
