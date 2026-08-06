import {
  mdiCubeOutline,
  mdiImageOutline,
  mdiPanoramaVariantOutline,
  mdiTextureBox,
  mdiVideoOutline,
  mdiVolumeHigh,
} from '@mdi/js'

export type IdEspace = 'image' | 'video' | '3d' | 'audio' | 'textures' | 'skyboxes'

/**
 * Où un panneau se pose à l'ouverture d'un espace : les quatre bords d'un IDE plus le
 * centre. `haut` et `bas` sont des bandes pleine largeur — c'est là que va la bibliothèque
 * d'assets, comme dans Unreal ; `onglet` range le panneau comme onglet voisin du précédent
 * au lieu d'ouvrir un groupe.
 *
 * L'utilisateur reste libre de tout redéplacer : ces zones ne décrivent que l'état initial,
 * après quoi c'est la disposition mémorisée par espace qui fait foi.
 */
export type ZonePanneau = 'centre' | 'gauche' | 'droite' | 'haut' | 'bas' | 'onglet'

export type PlacementPanneau = {
  id: string
  zone: ZonePanneau
}

export type Espace = {
  id: IdEspace
  icone: string
  /** Panneaux ouverts par défaut, dans l'ordre de pose. Le premier sert d'ancre. */
  panneaux: PlacementPanneau[]
}

const PANNEAUX_COMMUNS: PlacementPanneau[] = [
  { id: 'explorateur', zone: 'gauche' },
  { id: 'assets', zone: 'bas' },
  { id: 'taches', zone: 'onglet' },
]

export const ESPACES: readonly Espace[] = [
  {
    id: 'image',
    icone: mdiImageOutline,
    panneaux: [{ id: 'generateur', zone: 'droite' }, ...PANNEAUX_COMMUNS],
  },
  { id: 'video', icone: mdiVideoOutline, panneaux: PANNEAUX_COMMUNS },
  { id: '3d', icone: mdiCubeOutline, panneaux: PANNEAUX_COMMUNS },
  { id: 'audio', icone: mdiVolumeHigh, panneaux: PANNEAUX_COMMUNS },
  { id: 'textures', icone: mdiTextureBox, panneaux: PANNEAUX_COMMUNS },
  { id: 'skyboxes', icone: mdiPanoramaVariantOutline, panneaux: PANNEAUX_COMMUNS },
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
