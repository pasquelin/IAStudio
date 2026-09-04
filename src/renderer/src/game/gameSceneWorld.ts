import type { Scene } from 'three'
import type { HeightmapSamples } from '@shared/domain/heightmap'
import { enabledScatters, enabledTerrains, type SceneWorld } from '@shared/domain/scene'
import type { AssetPort } from '@game/ports/assetPort'
import { createRefCache } from '@/engines/core/refCache'
import { createReliefSurface, type ReliefSurface } from '@/engines/scene/reliefSurface'
import { createScatterSurface } from '@/engines/scene/scatterSurface'
import { disposeTree, type ModelSource } from '@/engines/scene/modelCache'

export type WorldDrape = {
  hideGround: boolean
  dispose: () => void
}

export async function drapeWorld(
  scene: Scene,
  world: SceneWorld,
  assets: AssetPort,
  loadModel: ModelSource | undefined,
  heightmaps: ReadonlyMap<string, HeightmapSamples> | undefined,
): Promise<WorldDrape> {
  const terrains = enabledTerrains(world.layers)
  const scatters = enabledScatters(world.layers)
  const relief = terrains.length === 0 ? null : await drapeRelief(scene, world, heightmaps)
  const maps = heightmaps ?? relief?.heightmaps()
  const models = scatters.length === 0 ? null : scatterModels(assets, loadModel)
  const scatter = models
    ? createScatterSurface(scene, { models, onUnsupported: () => undefined })
    : null
  if (scatter) await scatter.sync(world, maps)
  return {
    hideGround: terrains.length > 0 && (maps?.size ?? 0) > 0,
    dispose: () => {
      scatter?.dispose()
      relief?.dispose()
      models?.dispose()
    },
  }
}

async function drapeRelief(
  scene: Scene,
  world: SceneWorld,
  heightmaps: ReadonlyMap<string, HeightmapSamples> | undefined,
): Promise<ReliefSurface> {
  const wanted = enabledTerrains(world.layers).filter(terrain =>
    heightmaps?.has(terrain.heightmap.assetId),
  ).length
  const relief = createReliefSurface(scene, {
    load: async assetId => {
      const samples = heightmaps?.get(assetId)
      if (!samples) throw new Error(assetId)
      return samples
    },
  })
  relief.sync(world)
  for (let turn = 0; turn < 32 && relief.heightmaps().size < wanted; turn += 1) {
    await Promise.resolve()
  }
  return relief
}

function scatterModels(assets: AssetPort, loadModel: ModelSource | undefined) {
  return createRefCache({
    load: async (assetId: string) => {
      const url = assets.urlOf({ kind: 'asset', id: assetId })
      if (!url || !loadModel) throw new Error(assetId)
      return loadModel(url)
    },
    free: disposeTree,
    onFailure: () => undefined,
  })
}
