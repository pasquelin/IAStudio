import type { ExportedAssetOverride } from '@shared/domain/gameExport'

export type LossyTextureRequest = {
  id: number
  assetId: string
  bytes: Uint8Array
  scale: number
  quality?: number
}

export type LossyTextureResponse =
  | { id: number; done: false; progress: number }
  | { id: number; done: true; ok: true; override?: ExportedAssetOverride }
  | { id: number; done: true; ok: false; error: string }
