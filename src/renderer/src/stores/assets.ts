import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AssetsView = 'grid' | 'list'

type AssetsState = {
  view: AssetsView
  setView: (view: AssetsView) => void
}

/**
 * L'affichage vit dans un store plutôt que dans le composant : ses boutons sont rendus par
 * l'en-tête du panneau, la grille par son contenu, et les deux doivent lire la même valeur.
 */
export const useAssets = create<AssetsState>()(
  persist(
    set => ({
      view: 'grid',
      setView: view => set({ view }),
    }),
    { name: 'scenario-studio:assets' },
  ),
)
