import { Scene } from 'three'
import { bench, describe } from 'vitest'
import type { HeightmapSamples } from '@shared/domain/heightmap'
import { chunkCountAlong, chunkLayout } from '@shared/domain/relief'
import {
  DEFAULT_RELIEF_ELEVATION,
  DEFAULT_RELIEF_ORIGIN,
  DEFAULT_RELIEF_SIZE,
  DEFAULT_WORLD,
  reliefLayer,
} from '@shared/domain/scene'
import type { ReliefGeometryData } from './reliefBuildMessage'
import { createReliefSurface, reliefGeometryData } from './reliefSurface'

function samplesOf(side: number): HeightmapSamples {
  const values = new Float32Array(side * side)
  for (let at = 0; at < values.length; at++) values[at] = (at % side) / side
  return { width: side, height: side, values }
}

const WORLD = {
  ...DEFAULT_WORLD,
  layers: [
    reliefLayer(
      { assetId: 'heightmap' },
      {
        origin: DEFAULT_RELIEF_ORIGIN,
        size: DEFAULT_RELIEF_SIZE,
        elevation: DEFAULT_RELIEF_ELEVATION,
      },
    ),
  ],
}

const EXTENT = {
  origin: DEFAULT_RELIEF_ORIGIN,
  size: DEFAULT_RELIEF_SIZE,
  elevation: DEFAULT_RELIEF_ELEVATION,
}

function geometryOf(samples: HeightmapSamples): ReliefGeometryData[] {
  const chunks = []
  const columns = chunkCountAlong(samples.width, 64)
  const rows = chunkCountAlong(samples.height, 64)
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      chunks.push(
        reliefGeometryData(
          samples,
          EXTENT,
          chunkLayout(column, row, samples.width, samples.height, 64),
          64,
          [],
        ),
      )
    }
  }
  return chunks
}

function install(samples: HeightmapSamples, chunks: ReliefGeometryData[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const surface = createReliefSurface(new Scene(), {
      builder: {
        build: async incoming => {
          incoming.values.slice()
          return chunks
        },
        dispose: () => {},
      },
      onReady: () => {
        surface.dispose()
        resolve()
      },
      onFailure: (_assetId, error) => reject(error),
    })
    surface.sync(WORLD, samples)
  })
}

describe('building and releasing every relief position and normal on the UI thread', () => {
  for (const side of [512, 1024, 2048]) {
    const samples = samplesOf(side)
    bench(
      `${side} by ${side} samples`,
      () => {
        const surface = createReliefSurface(new Scene())
        surface.sync(WORLD, samples)
        surface.dispose()
      },
      { time: 200, iterations: 1, warmupTime: 0, warmupIterations: 1 },
    )
  }
})

describe('copying samples for the worker and installing the geometry it built', () => {
  for (const side of [512, 1024, 2048]) {
    const samples = samplesOf(side)
    const chunks = geometryOf(samples)
    bench(`${side} by ${side} samples`, () => install(samples, chunks), {
      time: 200,
      iterations: 1,
      warmupTime: 0,
      warmupIterations: 1,
    })
  }
})
