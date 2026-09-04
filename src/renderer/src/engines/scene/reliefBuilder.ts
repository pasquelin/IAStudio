import type { HeightmapSamples } from '@shared/domain/heightmap'
import type { ReliefExtent } from '@shared/domain/relief'
import type { TerrainEditLayer } from '@shared/domain/scene'
import type { ReliefGeometryData } from './reliefBuildMessage'

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
