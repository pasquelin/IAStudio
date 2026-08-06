import type { SerializedDockview } from 'dockview-react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { IdEspace } from '@/app/espaces'
import { ESPACE_PAR_DEFAUT } from '@/app/espaces'

/** Disposition Dockview sérialisée. Sa forme appartient à Dockview, on ne la relit pas. */
export type DispositionSerialisee = SerializedDockview

type EtatDispositions = {
  espaceActif: IdEspace
  dispositions: Partial<Record<IdEspace, DispositionSerialisee>>
  activerEspace: (espace: IdEspace) => void
  memoriser: (espace: IdEspace, disposition: DispositionSerialisee) => void
  oublier: (espace: IdEspace) => void
}

/**
 * Chaque espace garde SA disposition : revenir sur « 3D » doit retrouver le viewport et
 * l'outliner tels qu'ils étaient, pas la disposition de « Image ».
 */
export const useDispositions = create<EtatDispositions>()(
  persist(
    set => ({
      espaceActif: ESPACE_PAR_DEFAUT,
      dispositions: {},
      activerEspace: espace => set({ espaceActif: espace }),
      memoriser: (espace, disposition) =>
        set(etat => ({ dispositions: { ...etat.dispositions, [espace]: disposition } })),
      oublier: espace =>
        set(etat => {
          const restantes = { ...etat.dispositions }
          delete restantes[espace]
          return { dispositions: restantes }
        }),
    }),
    { name: 'scenario-studio:dispositions' },
  ),
)
