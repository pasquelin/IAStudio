import {
  mdiCreationOutline,
  mdiFolderOutline,
  mdiImageMultipleOutline,
  mdiProgressClock,
} from '@mdi/js'

export type ZoneOutils = 'gauche' | 'droite' | 'haut' | 'bas'

export type IdOutil = 'explorateur' | 'generateur' | 'assets' | 'taches'

export type Outil = {
  id: IdOutil
  icone: string
  zone: ZoneOutils
}

/**
 * Fenêtres d'outils, à la manière d'un IDE : elles vivent sur les bords, une par zone à la
 * fois, et se choisissent au rail d'icônes. Seul le centre porte des onglets — ce sont des
 * documents, et un document a un nom ; un outil a une icône.
 */
export const OUTILS: readonly Outil[] = [
  { id: 'explorateur', icone: mdiFolderOutline, zone: 'gauche' },
  { id: 'generateur', icone: mdiCreationOutline, zone: 'droite' },
  { id: 'assets', icone: mdiImageMultipleOutline, zone: 'bas' },
  { id: 'taches', icone: mdiProgressClock, zone: 'bas' },
]

export const ZONES: readonly ZoneOutils[] = ['gauche', 'droite', 'haut', 'bas']

export function outilsDeZone(zone: ZoneOutils): Outil[] {
  return OUTILS.filter(outil => outil.zone === zone)
}

/** Clé i18n du titre d'un outil — jamais le texte affiché. */
export function cleTitreOutil(id: IdOutil): string {
  return `panneaux.${id}`
}

/** Zones horizontales : leur rail est couché et leur taille se règle en hauteur. */
export function estHorizontale(zone: ZoneOutils): boolean {
  return zone === 'haut' || zone === 'bas'
}
