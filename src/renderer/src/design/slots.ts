import type { ReactNode } from 'react'

/**
 * Section configuration for a bar: `false` hides, a `ReactNode` replaces, absent keeps the
 * default rendering. Taken from map3D — this is what lets six workspaces share a single bar
 * without forking it.
 */
export type SlotConfig<S extends string> = Partial<Record<S, ReactNode | false>>

export type SlotResolution = { visible: boolean; replacement: ReactNode | null }

export function resolveSlot<S extends string>(
  config: SlotConfig<S> | undefined,
  section: S,
): SlotResolution {
  const value = config?.[section]
  if (value === false) return { visible: false, replacement: null }
  if (value === undefined || value === null) return { visible: true, replacement: null }
  return { visible: true, replacement: value }
}
