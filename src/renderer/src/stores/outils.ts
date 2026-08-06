import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { IdOutil, ZoneOutils } from '@/app/outils'

export const TAILLE_MIN = 140
export const TAILLE_MAX = 720

type OuvertsParZone = Partial<Record<ZoneOutils, IdOutil | null>>
type TaillesParZone = Partial<Record<ZoneOutils, number>>
type ReduitesParZone = Partial<Record<ZoneOutils, boolean>>

type EtatOutils = {
  ouverts: OuvertsParZone
  tailles: TaillesParZone
  reduites: ReduitesParZone
  /** Dernière zone cliquée : c'est elle dont l'icône de rail s'accentue. */
  zoneFocus: ZoneOutils | null
  basculer: (zone: ZoneOutils, outil: IdOutil) => void
  fermer: (zone: ZoneOutils) => void
  reduire: (zone: ZoneOutils) => void
  focaliser: (zone: ZoneOutils | null) => void
  redimensionner: (zone: ZoneOutils, taille: number) => void
  reinitialiser: () => void
}

export const TAILLES_PAR_DEFAUT: Record<ZoneOutils, number> = {
  gauche: 260,
  droite: 320,
  haut: 180,
  bas: 240,
}

const OUVERTS_PAR_DEFAUT: OuvertsParZone = {
  gauche: 'explorateur',
  droite: 'generateur',
  bas: 'assets',
}

export function tailleParDefaut(zone: ZoneOutils): number {
  return TAILLES_PAR_DEFAUT[zone]
}

/** Une taille hors bornes rendrait la zone inutilisable ou mangerait le centre. */
export function borner(taille: number): number {
  return Math.min(TAILLE_MAX, Math.max(TAILLE_MIN, Math.round(taille)))
}

export const useOutils = create<EtatOutils>()(
  persist(
    (set, get) => ({
      ouverts: OUVERTS_PAR_DEFAUT,
      tailles: {},
      reduites: {},
      zoneFocus: null,

      basculer: (zone, outil) =>
        set(etat => {
          const dejaOuvert = etat.ouverts[zone] === outil
          // Rappuyer sur l'icône d'un outil réduit le déplie plutôt que de le fermer :
          // sinon le seul moyen de revenir d'un panneau réduit serait de le fermer d'abord.
          if (dejaOuvert && etat.reduites[zone]) {
            return { reduites: { ...etat.reduites, [zone]: false }, zoneFocus: zone }
          }
          return {
            ouverts: { ...etat.ouverts, [zone]: dejaOuvert ? null : outil },
            zoneFocus: dejaOuvert ? null : zone,
          }
        }),

      fermer: zone =>
        set(etat => ({
          ouverts: { ...etat.ouverts, [zone]: null },
          zoneFocus: etat.zoneFocus === zone ? null : etat.zoneFocus,
        })),

      reduire: zone => set(etat => ({ reduites: { ...etat.reduites, [zone]: true } })),

      focaliser: zone => set({ zoneFocus: zone }),

      redimensionner: (zone, taille) =>
        set({ tailles: { ...get().tailles, [zone]: borner(taille) } }),

      reinitialiser: () =>
        set({ ouverts: OUVERTS_PAR_DEFAUT, tailles: {}, reduites: {}, zoneFocus: null }),
    }),
    {
      name: 'scenario-studio:outils',
      // Le focus est un état de session : le restaurer accentuerait au démarrage une zone
      // que l'utilisateur n'a pas touchée.
      partialize: etat => ({
        ouverts: etat.ouverts,
        tailles: etat.tailles,
        reduites: etat.reduites,
      }),
    },
  ),
)
