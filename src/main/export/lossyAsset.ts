import { nativeImage } from 'electron'
import { extname } from 'node:path'
import { stemOf } from '@shared/domain/fileName'
import type { LossyOptimization } from '@shared/domain/gameExport'
import { DEFAULT_OPTIMIZATION_POLICY } from '@shared/domain/optimizationPolicy'
import type { ExportedAsset } from './gameExport'

const DECODABLE = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.bmp'])
/** Returns the original bytes for containers and codecs Chromium cannot safely decode here. */
export async function optimizeLossyAsset(
  asset: ExportedAsset,
  options: LossyOptimization,
): Promise<ExportedAsset> {
  if (
    (options.textureCompression === 'off' && options.textureReduction === 'off') ||
    !DECODABLE.has(extname(asset.name).toLowerCase())
  ) {
    return asset
  }

  const decoded = nativeImage.createFromBuffer(Buffer.from(asset.bytes))
  if (decoded.isEmpty()) return asset

  const factor = DEFAULT_OPTIMIZATION_POLICY.textureScale[options.textureReduction]
  const size = decoded.getSize()
  const image =
    factor === 1
      ? decoded
      : decoded.resize({
          width: Math.max(1, Math.round(size.width * factor)),
          height: Math.max(1, Math.round(size.height * factor)),
          quality: 'good',
        })

  if (options.textureCompression === 'off') {
    return { name: `${stemOf(asset.name)}.png`, bytes: image.toPNG() }
  }
  return {
    name: `${stemOf(asset.name)}.jpg`,
    bytes: image.toJPEG(DEFAULT_OPTIMIZATION_POLICY.jpegQuality[options.textureCompression]),
  }
}
