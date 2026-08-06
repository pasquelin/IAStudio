import type { ReactNode } from 'react'

/**
 * Configuration de sections d'une barre : `false` masque, un `ReactNode` remplace,
 * absent laisse le rendu par défaut. Repris de map3D — c'est ce qui permet à six espaces
 * de partager une seule barre sans la forker.
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
