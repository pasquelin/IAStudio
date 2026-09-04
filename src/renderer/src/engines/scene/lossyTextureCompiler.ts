import type { ExportedAssetOverride, LossyOptimization } from '@shared/domain/gameExport'
import { DEFAULT_OPTIMIZATION_POLICY } from '@shared/domain/optimizationPolicy'
import { fetchOriginalAsset } from '@/helpers/assetFetch'
import { createWorkerPort } from '../core/workerPort'
import LossyTextureWorker from './lossyTexture.worker?worker'
import type { LossyTextureResponse } from './lossyTextureMessage'

export type LossyTextureWatch = {
  signal?: AbortSignal
  onProgress?: (completed: number, total: number) => void
}

type TextureCompilerPorts = {
  read: (assetId: string) => Promise<Uint8Array | null>
  transform: (
    assetId: string,
    bytes: Uint8Array,
    scale: number,
    quality: number | undefined,
    signal: AbortSignal | undefined,
  ) => Promise<ExportedAssetOverride | null>
  dispose?: () => void
}

export async function compileLossyTextures(
  assetIds: readonly string[],
  options: LossyOptimization,
  watch: LossyTextureWatch = {},
  ports: TextureCompilerPorts = browserTexturePorts(),
): Promise<readonly ExportedAssetOverride[]> {
  if (options.textureReduction === 'off' && options.textureCompression === 'off') {
    ports.dispose?.()
    return []
  }

  const overrides: ExportedAssetOverride[] = []
  const quality =
    options.textureCompression === 'off'
      ? undefined
      : DEFAULT_OPTIMIZATION_POLICY.jpegQuality[options.textureCompression] / 100
  try {
    for (const [index, assetId] of assetIds.entries()) {
      if (watch.signal?.aborted) throw new DOMException('Texture compilation aborted', 'AbortError')
      const bytes = await ports.read(assetId)
      if (!bytes) {
        watch.onProgress?.(index + 1, assetIds.length)
        continue
      }
      const override = await ports.transform(
        assetId,
        bytes,
        DEFAULT_OPTIMIZATION_POLICY.textureScale[options.textureReduction],
        quality,
        watch.signal,
      )
      if (override) overrides.push(override)
      watch.onProgress?.(index + 1, assetIds.length)
    }
    return overrides
  } finally {
    ports.dispose?.()
  }
}

function browserTexturePorts(): TextureCompilerPorts {
  const port = createWorkerPort<ExportedAssetOverride | undefined, LossyTextureResponse>(
    () => new LossyTextureWorker(),
    'lossy texture',
    answer => answer.override,
  )
  return {
    read: async assetId => {
      try {
        return new Uint8Array(await (await fetchOriginalAsset(assetId)).arrayBuffer())
      } catch {
        // The package writer reports missing catalogue assets; optimization must not mask that report.
        return null
      }
    },
    transform: async (assetId, bytes, scale, quality, signal) => {
      const abort = (): void => port.dispose()
      signal?.addEventListener('abort', abort, { once: true })
      try {
        return (
          (await port.send(
            id => ({
              message: {
                id,
                assetId,
                bytes,
                scale,
                ...(quality === undefined ? {} : { quality }),
              },
              transfer: [bytes.buffer],
            }),
            { signal },
          )) ?? null
        )
      } finally {
        signal?.removeEventListener('abort', abort)
      }
    },
    dispose: port.dispose,
  }
}
