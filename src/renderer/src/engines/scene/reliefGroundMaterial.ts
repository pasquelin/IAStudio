import { DataTexture, RGBAFormat, SRGBColorSpace, type MeshStandardMaterial } from 'three'
import { assetUrl, versionedUrl } from '@shared/domain/asset'
import type { GroundPaint } from '@shared/domain/groundPaint'
import type { ReliefLayer } from '@shared/domain/scene'
import { loadTexture, type TextureSource } from './textureCache'

export type ReliefGroundMaterial = {
  material: MeshStandardMaterial
  groundAssetId: string | null
  groundGeneration: number
}

type Options = {
  loadGround?: TextureSource
  assetVersion?: (assetId: string) => string | undefined
  onReady?: () => void
  onFailure?: (assetId: string, error: unknown) => void
}

export function applyGroundPaint(
  terrain: ReliefGroundMaterial | undefined,
  paint: GroundPaint,
): void {
  if (!terrain) return
  const texture = new DataTexture(
    Uint8Array.from(paint.pixels),
    paint.width,
    paint.height,
    RGBAFormat,
  )
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  terrain.groundGeneration += 1
  terrain.material.map?.dispose()
  terrain.material.map = texture
  terrain.material.needsUpdate = true
}

export function syncGroundMaterial(
  terrain: ReliefGroundMaterial,
  layer: ReliefLayer,
  options: Options,
): void {
  const assetId = layer.groundMaterials[0]?.albedo.assetId ?? null
  if (assetId === terrain.groundAssetId) return
  terrain.groundAssetId = assetId
  const token = ++terrain.groundGeneration
  if (!assetId) {
    terrain.material.map?.dispose()
    terrain.material.map = null
    terrain.material.needsUpdate = true
    return
  }
  void loadGroundMaterial(terrain, assetId, token, options)
}

async function loadGroundMaterial(
  terrain: ReliefGroundMaterial,
  assetId: string,
  token: number,
  options: Options,
): Promise<void> {
  try {
    const texture = await (options.loadGround ?? loadTexture)(
      versionedUrl(assetUrl(assetId), options.assetVersion?.(assetId)),
    )
    if (token !== terrain.groundGeneration) {
      texture.dispose()
      return
    }
    terrain.material.map?.dispose()
    terrain.material.map = texture
    terrain.material.needsUpdate = true
    options.onReady?.()
  } catch (error) {
    if (token === terrain.groundGeneration) options.onFailure?.(assetId, error)
  }
}
