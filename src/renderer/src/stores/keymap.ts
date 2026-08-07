import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DEFAULT_BINDINGS,
  DEFAULT_MOTION,
  type CommandId,
  type MotionId,
  type Signature,
} from '@shared/domain/shortcut'
import { isRecord } from '@/helpers/guards'

type KeymapState = {
  bindings: Record<CommandId, Signature>
  motion: Record<MotionId, Signature>
  rebind: (command: CommandId, signature: Signature) => void
  reset: () => void
}

type Readable = Pick<KeymapState, 'bindings' | 'motion'>

/**
 * `Object.entries` widens the key to `string`, so reading a binding table back needs one
 * narrowing. Written once here, generic over the table, rather than at each of the three call
 * sites that used to carry their own cast.
 */
function entriesOf<K extends string>(table: Record<K, Signature>): [K, Signature][] {
  return Object.entries<Signature>(table).filter((entry): entry is [K, Signature] =>
    Object.hasOwn(table, entry[0]),
  )
}

export function commandFor(state: Readable, signature: Signature): CommandId | null {
  return entriesOf(state.bindings).find(([, bound]) => bound === signature)?.[0] ?? null
}

export function motionFor(state: Readable, signature: Signature): MotionId | null {
  return entriesOf(state.motion).find(([, bound]) => bound === signature)?.[0] ?? null
}

/** Commands sharing a signature with another one — what the settings screen will show in red. */
export function conflicts(state: Readable): CommandId[] {
  const counted = new Map<Signature, CommandId[]>()
  for (const [command, signature] of entriesOf(state.bindings)) {
    counted.set(signature, [...(counted.get(signature) ?? []), command])
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
      migrate: persisted => (isRecord(persisted) ? persisted : undefined),
    },
  ),
)
