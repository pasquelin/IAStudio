import { describe, expect, it } from 'vitest'
import { EMPTY_TIMELINE } from '@shared/domain/animation'
import { DEFAULT_WORLD } from '@shared/domain/scene'
import { meshNode } from './scene-fixtures'
import {
  createRuntimeWorldCompiler,
  runtimeWorldPatch,
  runtimeWorldPatchIsEmpty,
  worldWithRuntimePatch,
} from './runtimeWorldCompiler'
import type { SceneState } from './sceneState'

const stateOf = (...nodes: ReturnType<typeof meshNode>[]): SceneState => ({
  nodes,
  selectedIds: [],
  world: DEFAULT_WORLD,
  animation: EMPTY_TIMELINE,
})

describe('runtimeWorldPatch', () => {
  it('applies a transported delta to the authoring world without using runtime state', () => {
    const a = meshNode('a')
    const b = meshNode('b')
    const before = stateOf(a, b)
    const after = stateOf({ ...b, visible: false }, meshNode('c'))

    expect(worldWithRuntimePatch(before, runtimeWorldPatch(before, after))).toEqual(after)
  })

  it('contains only changed authoring sections', () => {
    const a = meshNode('a')
    const b = meshNode('b')
    const before = stateOf(a, b)
    const changed = { ...b, visible: false }

    const patch = runtimeWorldPatch(before, stateOf(a, changed))

    expect(patch).toMatchObject({
      changedNodes: [changed],
      removedIds: [],
      order: null,
      world: null,
      animation: null,
    })
  })

  it('does not publish selection-only authoring changes', () => {
    const before = stateOf(meshNode('a'))
    const patch = runtimeWorldPatch(before, { ...before, selectedIds: ['a'] })

    expect(runtimeWorldPatchIsEmpty(patch)).toBe(true)
  })
})

describe('createRuntimeWorldCompiler', () => {
  it('validates compiled worlds through concrete scene observations and rendered frames', async () => {
    const compiler = createRuntimeWorldCompiler()
    const node: ReturnType<typeof meshNode> = {
      ...meshNode('a'),
      optimization: { mode: 'instance' },
    }
    const source = stateOf(node)
    const pixels = new Uint8Array([10, 20, 30, 255])
    const rendered: string[] = []

    const report = await compiler.validateSafeWorld(source, {
      cameras: [{ id: 'main' }],
      renderOriginal: async (world, camera) => {
        expect(world).toBe(source)
        rendered.push(`original:${camera.id}`)
        return { width: 1, height: 1, pixels }
      },
      renderOptimized: async (world, camera) => {
        expect(world.runtimeOptimization.artifacts).toHaveLength(1)
        rendered.push(`optimized:${camera.id}`)
        return { width: 1, height: 1, pixels: pixels.slice() }
      },
      visualOptions: { channelTolerance: 0, maximumChangedPixelRatio: 0 },
    })

    expect(rendered).toEqual(['original:main', 'optimized:main'])
    expect(report.equivalent).toBe(true)
    expect(report.functional.every(result => result.equivalent)).toBe(true)
    expect(compiler.getOptimizationReport().cachedNodes).toBe(1)
  })

  it('reuses unchanged runtime nodes and recompiles only a transported delta', () => {
    const compiler = createRuntimeWorldCompiler()
    const a = meshNode('a')
    const b = meshNode('b')
    const authoring = stateOf(a, b)
    const compiled = compiler.compileRuntimeWorld(structuredClone(authoring))
    const nextAuthoring = stateOf(a, { ...b, visible: false })

    const next = compiler.compileRuntimeRegion(
      structuredClone(runtimeWorldPatch(authoring, nextAuthoring)),
    )
    if (!next) throw new Error('runtime was not compiled')

    expect(next.nodes[0]).toBe(compiled.nodes[0])
    expect(next.nodes[1]).not.toBe(compiled.nodes[1])
    expect(compiler.getOptimizationReport()).toMatchObject({
      compiledNodes: 1,
      reusedNodes: 1,
      removedNodes: 0,
      cachedNodes: 2,
    })
  })

  it('compiles repeated authoring nodes into a deterministic runtime instance artifact', () => {
    const compiler = createRuntimeWorldCompiler()
    const source = stateOf(
      ...Array.from({ length: 16 }, (_unused, index) => meshNode(`tree-${index}`)),
    )

    const runtime = compiler.compileRuntimeWorld(source)

    expect(runtime).not.toBe(source)
    expect(runtime.runtimeOptimization.artifacts).toHaveLength(1)
    expect(runtime.runtimeOptimization.artifacts[0]).toMatchObject({
      strategy: 'instance',
      sourceIds: source.nodes.map(node => node.id).sort(),
    })
    expect(compiler.getOptimizationReport()).toMatchObject({
      compiledArtifacts: 1,
      reusedArtifacts: 0,
    })
  })

  it('reuses unaffected runtime artifacts after a local transform change', () => {
    const compiler = createRuntimeWorldCompiler()
    const nodes = Array.from({ length: 32 }, (_unused, index) => {
      const node = meshNode(`mesh-${index}`)
      return index < 16 ? node : { ...node, material: { ...node.material, roughness: 0.25 } }
    })
    const before = stateOf(...nodes)
    const first = nodes[0]
    if (!first) throw new Error('missing fixture')
    const runtime = compiler.compileRuntimeWorld(before)
    const changed = {
      ...first,
      transform: {
        ...first.transform,
        position: { ...first.transform.position, x: 3 },
      },
    }
    const after = stateOf(changed, ...nodes.slice(1))

    const next = compiler.compileRuntimeRegion(runtimeWorldPatch(before, after))

    expect(next?.runtimeOptimization.artifacts).toEqual(runtime.runtimeOptimization.artifacts)
    expect(next?.runtimeOptimization.artifacts[0]).toBe(runtime.runtimeOptimization.artifacts[0])
    expect(compiler.getOptimizationReport()).toMatchObject({
      compiledNodes: 1,
      compiledArtifacts: 0,
      reusedArtifacts: 2,
    })
  })

  it('does not trust an unchanged UUID after its render data changes', () => {
    const compiler = createRuntimeWorldCompiler()
    const source = meshNode('same')
    const before = stateOf(source)
    const compiled = compiler.compileRuntimeWorld(structuredClone(before))
    const next = stateOf({ ...source, castShadow: !source.castShadow })

    const changed = compiler.compileRuntimeRegion(structuredClone(runtimeWorldPatch(before, next)))

    expect(changed?.nodes[0]).not.toBe(compiled.nodes[0])
  })

  it('reuses a changed reference whose complete signature is equal', () => {
    const compiler = createRuntimeWorldCompiler()
    const source = stateOf(meshNode('same'))
    const compiled = compiler.compileRuntimeWorld(structuredClone(source))
    const equal = structuredClone(source)

    const next = compiler.compileRuntimeRegion(structuredClone(runtimeWorldPatch(source, equal)))

    expect(next?.nodes[0]).toBe(compiled.nodes[0])
    expect(compiler.getOptimizationReport()).toMatchObject({ compiledNodes: 0, reusedNodes: 1 })
  })

  it('invalidates a selected entity even when its signature is equal', () => {
    const compiler = createRuntimeWorldCompiler()
    const forced: ReturnType<typeof meshNode> = {
      ...meshNode('a'),
      optimization: { mode: 'instance' },
    }
    const source = stateOf(forced)
    const compiled = compiler.compileRuntimeWorld(structuredClone(source))
    compiler.invalidateOptimization(['a'])

    const next = compiler.compileRuntimeRegion(runtimeWorldPatch(source, source))

    expect(next?.nodes[0]).not.toBe(compiled.nodes[0])
    expect(next?.runtimeOptimization.artifacts[0]).not.toBe(
      compiled.runtimeOptimization.artifacts[0],
    )
  })

  it('preserves forced instance and batch representations below automatic thresholds', () => {
    const compiler = createRuntimeWorldCompiler()
    const instance: ReturnType<typeof meshNode> = {
      ...meshNode('instance'),
      optimization: { mode: 'instance' },
    }
    const batch: ReturnType<typeof meshNode> = {
      ...meshNode('batch'),
      optimization: { mode: 'batch' },
    }

    const runtime = compiler.compileRuntimeWorld(stateOf(instance, batch))

    expect(runtime.runtimeOptimization.artifacts.map(artifact => artifact.strategy).sort()).toEqual(
      ['batch', 'instance'],
    )
  })

  it('evicts deleted entities and preserves the requested order', () => {
    const compiler = createRuntimeWorldCompiler()
    const a = meshNode('a')
    const b = meshNode('b')
    const before = stateOf(a, b)
    compiler.compileRuntimeWorld(structuredClone(before))

    const next = compiler.compileRuntimeRegion(
      structuredClone(runtimeWorldPatch(before, stateOf({ ...b, name: 'B' }))),
    )

    expect(next?.nodes.map(node => node.id)).toEqual(['b'])
    expect(compiler.getOptimizationReport()).toMatchObject({ removedNodes: 1, cachedNodes: 1 })
  })

  it('keeps authoring-only session data out of the runtime world', () => {
    const compiler = createRuntimeWorldCompiler()
    const source: SceneState = {
      ...stateOf(meshNode('a')),
      selectedIds: ['a'],
      lockedAxes: [{ nodeId: 'a', channel: 'position', axis: 'x' }],
    }

    const runtime = compiler.compileRuntimeWorld(source)

    expect(runtime.selectedIds).toEqual([])
    expect(runtime.lockedAxes).toBeUndefined()
  })

  it('clears its disposable cache', () => {
    const compiler = createRuntimeWorldCompiler()
    const source = stateOf(meshNode('a'))
    compiler.compileRuntimeWorld(source)
    compiler.clearOptimizationCache()

    expect(
      compiler.compileRuntimeRegion(runtimeWorldPatch(source, structuredClone(source))),
    ).toBeNull()
    expect(compiler.getOptimizationReport()).toEqual({
      compiledNodes: 0,
      reusedNodes: 0,
      removedNodes: 0,
      cachedNodes: 0,
      compilationMs: 0,
      compiledArtifacts: 0,
      reusedArtifacts: 0,
    })
  })
})
