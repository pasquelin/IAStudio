import {
  mdiCreationOutline,
  mdiFolderOutline,
  mdiImageMultipleOutline,
  mdiProgressClock,
} from '@mdi/js'

export type ToolZone = 'left' | 'right' | 'top' | 'bottom'

export type ToolId = 'explorer' | 'generator' | 'assets' | 'jobs'

export type Tool = {
  id: ToolId
  icon: string
  zone: ToolZone
}

/**
 * Fenêtres d'outils, à la manière d'un IDE : elles vivent sur les bords, une par zone à la
 * fois, et se choisissent au rail d'icônes. Seul le centre porte des onglets — ce sont des
 * documents, et un document a un nom ; un outil a une icône.
 */
export const TOOLS: readonly Tool[] = [
  { id: 'explorer', icon: mdiFolderOutline, zone: 'left' },
  { id: 'generator', icon: mdiCreationOutline, zone: 'right' },
  { id: 'assets', icon: mdiImageMultipleOutline, zone: 'bottom' },
  { id: 'jobs', icon: mdiProgressClock, zone: 'bottom' },
]

export const ZONES: readonly ToolZone[] = ['left', 'right', 'top', 'bottom']

export function toolsInZone(zone: ToolZone): Tool[] {
  return TOOLS.filter(tool => tool.zone === zone)
}

/** Clé i18n du titre d'un outil — jamais le texte affiché. */
export function toolTitleKey(id: ToolId): string {
  return `panels.${id}`
}

/** Zones horizontales : leur taille se règle en hauteur, pas en largeur. */
export function isHorizontal(zone: ToolZone): boolean {
  return zone === 'top' || zone === 'bottom'
}

export function isToolZone(value: string): value is ToolZone {
  return ZONES.some(zone => zone === value)
}

export function isToolId(value: string): value is ToolId {
  return TOOLS.some(tool => tool.id === value)
}
