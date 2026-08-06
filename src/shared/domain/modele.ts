/**
 * Les entrées d'un modèle Scenario sont propres à chaque modèle et se découvrent à
 * l'exécution (`GET /models/{id}`). `FieldDescriptor` est leur forme normalisée, seule
 * connue du renderer — cf. spec § 6.
 */
export type SorteChamp =
  | 'texte'
  | 'texteLong'
  | 'nombre'
  | 'entier'
  | 'booleen'
  | 'choix'
  | 'image'
  | 'couleur'
  | 'graine'
  | 'brut'

export type OptionChamp = {
  valeur: string
  libelle: string
}

export type DescripteurChamp = {
  cle: string
  sorte: SorteChamp
  libelle: string
  aide?: string
  requis: boolean
  defaut?: unknown
  min?: number
  max?: number
  pas?: number
  options?: OptionChamp[]
  groupe?: string
  dependDe?: { cle: string; valeur: unknown }
}

export type FamilleModele =
  | 'image'
  | 'video'
  | '3d'
  | 'audio'
  | 'upscale'
  | 'detourage'
  | 'vectorisation'
  | 'autre'

export type ResumeModele = {
  id: string
  nom: string
  famille: FamilleModele
  fournisseur: string
  vignette?: string
}

export type DescripteurModele = ResumeModele & {
  champs: DescripteurChamp[]
}
