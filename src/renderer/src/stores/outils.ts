import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { IdOutil, ZoneOutils } from '@/app/outils'

export const TAILLE_MIN = 140
export const TAILLE_MAX = 720

type OuvertsParZone = Partial<Record<ZoneOutils, IdOutil | null>>
type TaillesParZone = Partial<Record<ZoneOutils, number>>

type EtatOutils = {
  ouverts: OuvertsParZone
  tailles: TaillesParZone
  /** Rouvre l'outil, ou referme la zone si c'est déjà lui qui est ouvert. */
  basculer: (zone: ZoneOutils, outil: IdOutil) => void
  fermer: (zone: ZoneOutils) => void
  redimensionner: (zone: ZoneOutils, taille: number) => void
}

export const TAILLES_PAR_DEFAUT: Record<ZoneOutils, number> = {
  gauche: 240,
  droite: 300,
  haut: 180,
  bas: 220,
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
      ouverts: { gauche: 'explorateur', droite: 'generateur', bas: 'assets' },
      tailles: {},

      basculer: (zone, outil) =>
        set(etat => ({
          ouverts: { ...etat.ouverts, [zone]: etat.ouverts[zone] === outil ? null : outil },
        })),

      fermer: zone => set(etat => ({ ouverts: { ...etat.ouverts, [zone]: null } })),

      redimensionner: (zone, taille) =>
        set({ tailles: { ...get().tailles, [zone]: borner(taille) } }),
    }),
    { name: 'scenario-studio:outils' },
  ),
)
