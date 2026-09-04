import { describe, expect, it } from 'vitest'
import { worldBenchmarkScenes } from './worldBenchmarkScenes.fixture'
import { runtimeArtifactsOf } from './runtimeWorldCompiler'

describe('the reproducible world benchmark suite', () => {
  it('holds the five documented workloads at their declared scale', () => {
    const scenes = worldBenchmarkScenes()

    expect(scenes.map(scene => scene.id)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5'])
    expect(scenes.slice(0, 4).map(scene => scene.state.nodes.length)).toEqual([
      50, 10_000, 10_000, 20_000,
    ])
    const mixed = scenes[4]?.state
    expect(
      mixed?.nodes.some(node =>
        node.components?.some(component => component.type === 'Script' && component.script),
      ),
    ).toBe(true)
    expect(
      mixed?.nodes.some(node => node.components?.some(component => component.type === 'RigidBody')),
    ).toBe(true)
    expect(mixed?.animation.events).not.toHaveLength(0)
    expect(mixed?.animation.transitions).not.toHaveLength(0)
  })

  it('rebuilds identical deterministic inputs', () => {
    expect(worldBenchmarkScenes()).toEqual(worldBenchmarkScenes())
  })

  it('partitions the props workload into bounded spatial batches', () => {
    const props = worldBenchmarkScenes().find(scene => scene.id === 'S3')
    if (!props) throw new Error('S3 benchmark scene is missing')

    const artifacts = runtimeArtifactsOf(props.state.nodes, props.state.animation)

    expect(artifacts).toHaveLength(16)
    expect(Math.max(...artifacts.map(artifact => artifact.sourceIds.length))).toBe(1_024)
  })
})
