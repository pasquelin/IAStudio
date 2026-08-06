export type AssetType = 'image' | 'video' | 'audio' | 'mesh' | 'texture' | 'skybox'

export type AssetLocation = 'local' | 'cloud'

export type Asset = {
  id: string
  name: string
  type: AssetType
  location: AssetLocation
  /** Path relative to the project folder when `location` is `local`. */
  path?: string
  /** Originating Scenario identifier, when the asset comes from a generation. */
  remoteAssetId?: string
  jobId?: string
  width?: number
  height?: number
  bytes?: number
  tags: string[]
  createdAt: string
  /** Asset this one derives from — lets us trace a texture back to its source image. */
  derivedFrom?: string
}

export type AssetQuery = {
  type?: AssetType
  tags?: string[]
  text?: string
  limit?: number
  offset?: number
}
