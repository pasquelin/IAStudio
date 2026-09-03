import { Scene } from 'three'
import { bench, describe } from 'vitest'
import type { HeightmapSamples } from '@shared/domain/heightmap'
import {
  DEFAULT_RELIEF_ELEVATION,
  DEFAULT_RELIEF_ORIGIN,
  DEFAULT_RELIEF_SIZE,
  DEFAULT_WORLD,
  reliefLayer,
} from '@shared/domain/scene'
import { createReliefSurface } from './reliefSurface'

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
