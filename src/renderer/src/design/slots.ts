import type { ReactNode } from 'react'

/**
 * Configuration de sections d'une barre : `false` masque, un `ReactNode` remplace,
 * absent laisse le rendu par défaut. Repris de `map3D` — c'est ce qui permet à six
 * espaces de partager une seule barre sans la forker.
 */
export type ConfigSlots<S extends string> = Partial<Record<S, ReactNode | false>>

export type ResolutionSlot = { visible: boolean; remplacement: ReactNode | null }

export function resoudreSlot<S extends string>(
  config: ConfigSlots<S> | undefined,
  section: S,
): ResolutionSlot {
  const valeur = config?.[section]
  if (valeur === false) return { visible: false, remplacement: null }
  if (valeur === undefined || valeur === null) return { visible: true, remplacement: null }
  return { visible: true, remplacement: valeur }
}
