// @vitest-environment jsdom

import { BufferAttribute, Scene } from 'three'
import { describe, expect, it } from 'vitest'
import { RELIEF_CHUNK_TEXELS, chunkLayout, withChunkDelta } from '@shared/domain/relief'
import { DEFAULT_WORLD, reliefLayer, terrainEditLayer } from '@shared/domain/scene'
import { createReliefSurface } from './reliefSurface'

const TERRAIN = 'terrain'
const WIDTH = RELIEF_CHUNK_TEXELS + 1
const HEIGHT = RELIEF_CHUNK_TEXELS + 1

/**
 * With no accent token the painter falls back to black, so a fully painted vertex reads back as
 * `1 - weight * tint` — the gauge alone, which is what this measures.
 */
describe('how far a painted mask carries the accent', () => {
  it('softens the stencil by the ratio the theme publishes', () => {
    document.documentElement.style.setProperty('--sc-relief-mask-tint', '0.25')
    const samples = {
      width: WIDTH,
      height: HEIGHT,
      values: Float32Array.from({ length: WIDTH * HEIGHT }, () => 0),
    }
    const weights = withChunkDelta(samples, undefined, {
      column: 0,
      row: 0,
      localX: 1,
      localZ: 0,
      delta: 1,
    })
    const surface = createReliefSurface(new Scene())

    surface.sync(
      {
        ...DEFAULT_WORLD,
        layers: [
          reliefLayer(
            { assetId: 'asset_height' },
            {
              id: TERRAIN,
              edits: [
                terrainEditLayer({ id: 'sculpt', mask: { kind: 'painted', weights } }),
              ],
            },
          ),
        ],
      },
      samples,
    )

    const mesh = surface.meshOf(TERRAIN, 0, 0)
    const color = mesh?.geometry.getAttribute('color')
    if (!(color instanceof BufferAttribute)) throw new Error('chunk has no color buffer')
    const layout = chunkLayout(0, 0, WIDTH, HEIGHT, RELIEF_CHUNK_TEXELS)

    expect(color.array[layout.width * 0 * 3 + 3]).toBeCloseTo(0.75, 5)
    surface.dispose()
  })
})
