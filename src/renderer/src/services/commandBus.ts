import type { CommandId, CommandScope } from '@shared/domain/command'

type Listener = (command: CommandId, to: string | null) => void

const listeners = new Set<Listener>()

/** How many mounted surfaces are listening for each scope. Counted: three claim `sequence`. */
const armed = new Map<CommandScope, number>()

/**
 * Hands a command to whichever surface is listening for it.
 *
 * The native menu is application-wide and fires commands that belong to a document — Flatten,
 * Rotate, the five model edits. It has no way to reach the tab in front: the keyboard path goes
 * through `useShortcuts`, which listens on the window, and the menu's own path stopped at
 * `useNativeMenu`, whose switch only ever knew the four global commands. Every other row of the
 * Image menu therefore did nothing at all.
 *
 * **`to` is the document it belongs to, when the sender knows which.** Without it a command goes
 * to the tab in front, which is right for a menu row and wrong for a panel: a panel holds the id
 * of the document it shows, and pinned to a background one it would otherwise edit whichever
 * document happened to be visible.
 *
 * A bus rather than a store: nothing here is state. A command happens, it is delivered, and a
 * surface that mounts afterwards must not receive it late.
 */
export function publishCommand(command: CommandId, to: string | null = null): void {
  for (const listener of [...listeners]) listener(command, to)
}

/** Listens until the returned function is called. */
export function subscribeToCommands(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Declares a surface as able to act on this scope, until the returned function is called.
 *
 * Kept beside the bus rather than derived from the listeners: publishing is memoryless, so a
 * caller that needs an ANSWER — an MCP client — has no other way to tell a command that ran from
 * one that fell into an empty room.
 */
export function armCommandScope(scope: CommandScope): () => void {
  armed.set(scope, (armed.get(scope) ?? 0) + 1)
  return () => {
    const held = (armed.get(scope) ?? 0) - 1
    if (held > 0) armed.set(scope, held)
    else armed.delete(scope)
  }
}

/** Whether publishing to this scope would reach anything. */
export function commandScopeIsArmed(scope: CommandScope): boolean {
  return armed.has(scope)
}
