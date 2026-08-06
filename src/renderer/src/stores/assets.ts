import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AffichageAssets = 'grille' | 'liste'

type EtatAssets = {
  affichage: AffichageAssets
  definirAffichage: (affichage: AffichageAssets) => void
}

/**
 * L'affichage vit dans un store plutôt que dans le composant : ses boutons sont rendus par
 * l'en-tête du panneau, la grille par son contenu, et les deux doivent lire la même valeur.
 */
export const useAssets = create<EtatAssets>()(
  persist(
    set => ({
      affichage: 'grille',
      definirAffichage: affichage => set({ affichage }),
    }),
    { name: 'scenario-studio:assets' },
  ),
)
