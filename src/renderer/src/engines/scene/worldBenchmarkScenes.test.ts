import { describe, expect, it } from 'vitest'
import { worldBenchmarkScenes } from './worldBenchmarkScenes.fixture'

describe('the reproducible world benchmark suite', () => {
  it('holds the five documented workloads at their declared scale', () => {
    const scenes = worldBenchmarkScenes()

    expect(scenes.map(scene => scene.id)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5'])
    expect(scenes.slice(0, 4).map(scene => scene.state.nodes.length)).toEqual([
      50, 10_000, 10_000, 20_000,
    ])
    expect(scenes[4]?.state.nodes.some(node => (node.components?.length ?? 0) > 0)).toBe(true)
  })

  it('rebuilds identical deterministic inputs', () => {
    expect(worldBenchmarkScenes()).toEqual(worldBenchmarkScenes())
  })
})
