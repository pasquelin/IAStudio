import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  COMMAND_SCOPES,
  DEFAULT_BINDINGS,
  DEFAULT_MOTION,
  type CommandId,
  type CommandScope,
  type MotionId,
  type Signature,
} from '@shared/domain/shortcut'
import { isRecord } from '@shared/guards'

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

/**
 * A persisted table completed with whatever the current build declares. Zustand merges the
 * stored state one level deep, so a command added since the user last ran the app would come
 * back missing — and `shortcutLabel(undefined)` throws on the first render of its toolbar.
 *
 * Only keys this build still knows are kept: a remap of a command since removed is dropped.
 */
function withDefaults<K extends string>(
  defaults: Record<K, Signature>,
  persisted: unknown,
): Record<K, Signature> {
  const merged = { ...defaults }
  if (!isRecord(persisted)) return merged

  for (const [key] of entriesOf(defaults)) {
    const bound = persisted[key]
    if (typeof bound === 'string') merged[key] = bound
  }
  return merged
}

/**
 * The command a signature fires on one surface. Scoped, because the same key means different
 * things on the timeline and in the scene, and only one of the two is ever listening.
 */
export function commandFor(
  state: Readable,
  signature: Signature,
  scope: CommandScope,
): CommandId | null {
  return (
    entriesOf(state.bindings).find(
      ([command, bound]) => bound === signature && COMMAND_SCOPES[command] === scope,
    )?.[0] ?? null
  )
}

export function motionFor(state: Readable, signature: Signature): MotionId | null {
  return entriesOf(state.motion).find(([, bound]) => bound === signature)?.[0] ?? null
}

/**
 * Commands sharing a signature with another one **on the same surface** — what the settings
 * screen will show in red. Across surfaces a shared key is the design, not a clash.
 */
export function conflicts(state: Readable): CommandId[] {
  const counted = new Map<string, CommandId[]>()
  for (const [command, signature] of entriesOf(state.bindings)) {
    const key = `${COMMAND_SCOPES[command]} ${signature}`
    counted.set(key, [...(counted.get(key) ?? []), command])
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
      // Merged per table rather than per store, so adding a command needs no version bump and
      // no migration: the new one arrives with its default and the user's remaps survive.
      merge: (persisted, current) => ({
        ...current,
        bindings: withDefaults(DEFAULT_BINDINGS, isRecord(persisted) ? persisted.bindings : null),
        motion: withDefaults(DEFAULT_MOTION, isRecord(persisted) ? persisted.motion : null),
      }),
    },
  ),
)
