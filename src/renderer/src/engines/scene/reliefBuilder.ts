import type { HeightmapSamples } from '@shared/domain/heightmap'
import type { ReliefExtent } from '@shared/domain/relief'
import type { TerrainEditLayer } from '@shared/domain/scene'
import { createWorkerPort } from '../core/workerPort'
import type {
  ReliefBuildRequest,
  ReliefBuildResponse,
  ReliefGeometryData,
} from './reliefBuildMessage'

export type ReliefBuilder = {
  build: (
    samples: HeightmapSamples,
    extent: ReliefExtent,
    grain: number,
    edits: readonly TerrainEditLayer[],
    signal: AbortSignal,
  ) => Promise<ReliefGeometryData[] | null>
  dispose: () => void
}

export function createReliefBuilder(spawn: () => Worker): ReliefBuilder {
  const port = createWorkerPort<ReliefGeometryData[], ReliefBuildResponse>(
    spawn,
    'relief geometry',
    answer => answer.chunks,
  )

  return {
    build: (samples, extent, grain, edits, signal) =>
      port.send(
        id => {
          const values = samples.values.slice()
          const message: ReliefBuildRequest = {
            id,
            width: samples.width,
            height: samples.height,
            values,
            extent,
            grain,
            edits,
          }
          return { message, transfer: [values.buffer] }
        },
        { signal },
      ),
    dispose: port.dispose,
  }
}
