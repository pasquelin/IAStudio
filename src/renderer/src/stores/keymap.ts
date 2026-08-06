import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_BINDINGS,
  DEFAULT_MOTION,
  type CommandId,
  type MotionId,
  type Signature,
} from '@shared/domain/shortcut'

type KeymapState = {
  bindings: Record<CommandId, Signature>
  motion: Record<MotionId, Signature>
  rebind: (command: CommandId, signature: Signature) => void
  reset: () => void
}

type Readable = Pick<KeymapState, 'bindings' | 'motion'>

export function commandFor(state: Readable, signature: Signature): CommandId | null {
  const found = Object.entries(state.bindings).find(([, bound]) => bound === signature)
  // `Object.entries` widens the key to `string`; the entry came from `bindings`, so its key
  // is a `CommandId`.
  return found ? (found[0] as CommandId) : null
}

export function motionFor(state: Readable, signature: Signature): MotionId | null {
  const found = Object.entries(state.motion).find(([, bound]) => bound === signature)
  // Same narrowing as above, same reason.
  return found ? (found[0] as MotionId) : null
}

/** Commands sharing a signature with another one — what the settings screen will show in red. */
export function conflicts(state: Readable): CommandId[] {
  const counted = new Map<Signature, CommandId[]>()
  for (const [command, signature] of Object.entries(state.bindings)) {
    // The key comes from `bindings`, so it is a `CommandId`.
    counted.set(signature, [...(counted.get(signature) ?? []), command as CommandId])
  }
  return [...counted.values()].filter(commands => commands.length > 1).flat()
}

/**
 * Bindings are user settings, so they persist and they are editable. Nothing reads a hardcoded
 * key anywhere else: the settings screen (spec §9) plugs in here without touching a handler.
 */
export const useKeymap = create<KeymapState>()(
  persist(
    set => ({
      bindings: { ...DEFAULT_BINDINGS },
      motion: { ...DEFAULT_MOTION },

      rebind: (command, signature) =>
        set(state => ({ bindings: { ...state.bindings, [command]: signature } })),

      reset: () => set({ bindings: { ...DEFAULT_BINDINGS }, motion: { ...DEFAULT_MOTION } }),
    }),
    {
      name: 'scenario-studio:keymap',
      version: 1,
      // Same reason as `stores/tools.ts`: a version bump must not cost the user their remaps.
      // A command that disappeared is simply never read again.
      migrate: persisted => (typeof persisted === 'object' ? persisted : undefined),
    },
  ),
)
