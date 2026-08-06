export type TypeAsset = 'image' | 'video' | 'audio' | 'modele3d' | 'texture' | 'skybox'

export type EmplacementAsset = 'local' | 'cloud'

export type Asset = {
  id: string
  nom: string
  type: TypeAsset
  emplacement: EmplacementAsset
  /** Chemin relatif au dossier du projet quand `emplacement` vaut `local`. */
  chemin?: string
  /** Identifiant Scenario d'origine, quand l'asset vient d'une génération. */
  assetIdDistant?: string
  tacheId?: string
  largeur?: number
  hauteur?: number
  octets?: number
  tags: string[]
  creeLe: string
  /** Asset dont celui-ci dérive — permet de remonter à l'image source d'une texture. */
  deriveDe?: string
}

export type RequeteAssets = {
  type?: TypeAsset
  tags?: string[]
  texte?: string
  limite?: number
  decalage?: number
}
