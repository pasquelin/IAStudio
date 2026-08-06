import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ToolId, ToolZone } from '@/app/tools'

export const MIN_SIZE = 140

/**
 * Une zone d'outils ne prend jamais plus de la moitié de la fenêtre : au-delà, ce n'est plus
 * un panneau latéral, c'est le centre qui disparaît.
 */
export const MAX_SHARE = 0.5

type OpenByZone = Partial<Record<ToolZone, ToolId | null>>
type SizesByZone = Partial<Record<ToolZone, number>>
type CollapsedByZone = Partial<Record<ToolZone, boolean>>

type ToolsState = {
  open: OpenByZone
  sizes: SizesByZone
  collapsed: CollapsedByZone
  /** Dernière zone cliquée : c'est elle dont l'icône de rail s'accentue. */
  focusedZone: ToolZone | null
  toggle: (zone: ToolZone, tool: ToolId) => void
  close: (zone: ToolZone) => void
  collapse: (zone: ToolZone) => void
  focus: (zone: ToolZone | null) => void
  /** `available` : dimension du conteneur, dont on ne prend jamais plus de `MAX_SHARE`. */
  resize: (zone: ToolZone, size: number, available: number) => void
  reset: () => void
}

export const DEFAULT_SIZES: Record<ToolZone, number> = {
  left: 260,
  right: 320,
  top: 180,
  bottom: 240,
}

const DEFAULT_OPEN: OpenByZone = {
  left: 'explorer',
  right: 'generator',
  bottom: 'assets',
}

export function defaultSize(zone: ToolZone): number {
  return DEFAULT_SIZES[zone]
}

/**
 * Borne une taille de zone. Le plafond est relatif à la fenêtre, pas une constante : sur un
 * écran large, 720 px de panneau ne gênent personne ; sur une fenêtre étroite, ils avalent
 * le centre.
 */
export function clamp(size: number, available: number): number {
  return Math.min(Math.round(available * MAX_SHARE), Math.max(MIN_SIZE, Math.round(size)))
}

export const useTools = create<ToolsState>()(
  persist(
    (set, get) => ({
      open: DEFAULT_OPEN,
      sizes: {},
      collapsed: {},
      focusedZone: null,

      toggle: (zone, tool) =>
        set(state => {
          const alreadyOpen = state.open[zone] === tool
          // Rappuyer sur l'icône d'un outil réduit le déplie plutôt que de le fermer :
          // sinon le seul moyen de revenir d'un panneau réduit serait de le fermer d'abord.
          if (alreadyOpen && state.collapsed[zone]) {
            return { collapsed: { ...state.collapsed, [zone]: false }, focusedZone: zone }
          }
          return {
            open: { ...state.open, [zone]: alreadyOpen ? null : tool },
            focusedZone: alreadyOpen ? null : zone,
          }
        }),

      close: zone =>
        set(state => ({
          open: { ...state.open, [zone]: null },
          focusedZone: state.focusedZone === zone ? null : state.focusedZone,
        })),

      collapse: zone => set(state => ({ collapsed: { ...state.collapsed, [zone]: true } })),

      focus: zone => set({ focusedZone: zone }),

      resize: (zone, size, available) =>
        set({ sizes: { ...get().sizes, [zone]: clamp(size, available) } }),

      reset: () => set({ open: DEFAULT_OPEN, sizes: {}, collapsed: {}, focusedZone: null }),
    }),
    {
      name: 'scenario-studio:tools',
      // Le focus est un état de session : le restaurer accentuerait au démarrage une zone
      // que l'utilisateur n'a pas touchée.
      partialize: state => ({ open: state.open, sizes: state.sizes, collapsed: state.collapsed }),
    },
  ),
)
