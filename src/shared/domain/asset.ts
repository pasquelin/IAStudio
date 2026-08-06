export type AssetType = 'image' | 'video' | 'audio' | 'mesh' | 'texture' | 'skybox'

export type AssetLocation = 'local' | 'cloud'

export type Asset = {
  id: string
  name: string
  type: AssetType
  location: AssetLocation
  /** Chemin relatif au dossier du projet quand `location` vaut `local`. */
  path?: string
  /** Identifiant Scenario d'origine, quand l'asset vient d'une génération. */
  remoteAssetId?: string
  jobId?: string
  width?: number
  height?: number
  bytes?: number
  tags: string[]
  createdAt: string
  /** Asset dont celui-ci dérive — permet de remonter à l'image source d'une texture. */
  derivedFrom?: string
}

export type AssetQuery = {
  type?: AssetType
  tags?: string[]
  text?: string
  limit?: number
  offset?: number
}
