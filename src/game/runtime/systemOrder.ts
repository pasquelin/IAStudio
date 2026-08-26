// SPDX-License-Identifier: MIT

import type { ComponentType } from '@shared/domain/component'

export type SystemName =
  | 'input'
  | 'script'
  | 'movement'
  | 'physics'
  | 'collision'
  | 'gameplay'
  | 'animator'
  | 'audio'
  | 'timeline'
  | 'camera'

/**
 * The order a step runs its systems in, declared once rather than left to whoever registers last.
 *
 * 🛑 It is a CONTRACT, not a convenience: physics after movement is why a wall stops a walker,
 * and the camera last is why it does not follow a position the physics then corrects. A script's
 * `onLateUpdate` runs in the `script` system's late pass, which is after all of this.
 */
export const SYSTEM_ORDER: readonly SystemName[] = [
  'input',
  'script',
  'movement',
  'physics',
  'collision',
  'gameplay',
  'animator',
  'audio',
  'timeline',
  'camera',
]

/** Just enough of a system to be ordered and to be checked. */
export type SystemShape = {
  name: SystemName
  reads: readonly ComponentType[]
  writes: readonly ComponentType[]
}

/**
 * The same systems, in the declared order. Two of one name keep the order they were given in.
 *
 * A name `SYSTEM_ORDER` does not list runs LAST rather than first: `indexOf` answers -1, and the
 * natural edit — a name added to `SystemName`, the list forgotten — would otherwise put it ahead
 * of `input`. `systemOrder.test.ts` holds the two lists together by the compiler.
 */
export function orderedByDeclaration<T extends SystemShape>(systems: readonly T[]): T[] {
  const rank = (name: SystemName): number => {
    const at = SYSTEM_ORDER.indexOf(name)
    return at < 0 ? SYSTEM_ORDER.length : at
  }

  return [...systems].sort((one, other) => rank(one.name) - rank(other.name))
}

/**
 * The component types more than one system writes.
 *
 * A read after a write is the DESIGN — a system reading what an earlier one wrote is how a step
 * composes. Two writers is not: which one wins depends on the order, and the order is not a thing
 * a component's owner declared.
 */
export function writeConflicts(systems: readonly SystemShape[]): ComponentType[] {
  const writers = new Map<ComponentType, Set<SystemName>>()
  for (const system of systems)
    // By NAME, not by count: a system listing one type twice in its own `writes` is careless, not
    // a conflict, and counting occurrences reported it as one.
    for (const type of system.writes)
      writers.set(type, (writers.get(type) ?? new Set()).add(system.name))

  return [...writers].filter(([, names]) => names.size > 1).map(([type]) => type)
}
