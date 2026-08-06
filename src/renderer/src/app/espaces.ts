import {
  mdiCubeOutline,
  mdiImageOutline,
  mdiPanoramaVariantOutline,
  mdiTextureBox,
  mdiVideoOutline,
  mdiVolumeHigh,
} from '@mdi/js'
import type { FamilleModele } from '@shared/domain/modele'

export type IdEspace = 'image' | 'video' | '3d' | 'audio' | 'textures' | 'skyboxes'

export type Espace = {
  id: IdEspace
  icone: string
  /** Famille de modèles Scenario proposée par le générateur dans cet espace. */
  famille: FamilleModele
}

export const ESPACES: readonly Espace[] = [
  { id: 'image', icone: mdiImageOutline, famille: 'image' },
  { id: 'video', icone: mdiVideoOutline, famille: 'video' },
  { id: '3d', icone: mdiCubeOutline, famille: '3d' },
  { id: 'audio', icone: mdiVolumeHigh, famille: 'audio' },
  { id: 'textures', icone: mdiTextureBox, famille: 'image' },
  { id: 'skyboxes', icone: mdiPanoramaVariantOutline, famille: 'image' },
]

export const ESPACE_PAR_DEFAUT: IdEspace = 'image'

/** Clé i18n du libellé d'un espace — le libellé n'est jamais écrit en dur. */
export function cleLibelleEspace(id: IdEspace): string {
  return `espaces.${id}`
}

export function espaceParId(id: IdEspace): Espace {
  const espace = ESPACES.find(candidat => candidat.id === id)
  if (!espace) throw new Error(`Espace inconnu : ${id}`)
  return espace
}
