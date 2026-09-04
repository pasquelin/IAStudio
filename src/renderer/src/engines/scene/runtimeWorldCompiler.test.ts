import { describe, expect, it } from 'vitest'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import { DEFAULT_WORLD } from '@shared/domain/scene'
import { DEFAULT_OPTIMIZATION_POLICY } from '@shared/domain/optimizationPolicy'
import { meshNode } from './scene-fixtures'
import {
  createRuntimeWorldCompiler,
  runtimeArtifactsOf,
  runtimeWorldPatch,
  runtimeWorldPatchIsEmpty,
  worldWithRuntimePatch,
} from './runtimeWorldCompiler'
import type { SceneNode, SceneState } from './sceneState'
import { sceneRuntimeSnapshot } from './sceneRuntimeSnapshot'
import type { ModelNode } from './sceneState'

const stateOf = (...nodes: ReturnType<typeof meshNode>[]): SceneState => ({
  nodes,
  selectedIds: [],
  world: DEFAULT_WORLD,
  animation: EMPTY_TIMELINE,
})

function boxNode(id: string, width: number, x: number): ReturnType<typeof meshNode> {
  const node = meshNode(id)
  return {
    ...node,
    geometry: { kind: 'box', width, height: 1, depth: 1 },
    transform: { ...node.transform, position: { x, y: 0, z: 0 } },
  }
}

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
      observeOriginal: async world => sceneRuntimeSnapshot(world),
      observeOptimized: async world => sceneRuntimeSnapshot(world),
      visualOptions: { channelTolerance: 0, maximumChangedPixelRatio: 0 },
    })

    expect(rendered).toEqual(['original:main', 'optimized:main'])
    expect(report.equivalent).toBe(true)
    expect(report.functional.every(result => result.equivalent)).toBe(true)
    expect(compiler.getOptimizationReport().cachedNodes).toBe(1)
  })

  it('reports a functional difference observed by the runtime driver', async () => {
    const compiler = createRuntimeWorldCompiler()
    const source = stateOf(meshNode('a'))

    const report = await compiler.validateSafeWorld(source, {
      cameras: [{ id: 'main' }],
      renderOriginal: async () => ({ width: 1, height: 1, pixels: new Uint8Array(4) }),
      renderOptimized: async () => ({ width: 1, height: 1, pixels: new Uint8Array(4) }),
      observeOriginal: async world => sceneRuntimeSnapshot(world),
      observeOptimized: async world => ({ ...sceneRuntimeSnapshot(world), picking: [] }),
      visualOptions: { channelTolerance: 0, maximumChangedPixelRatio: 0 },
    })

    expect(report.equivalent).toBe(false)
    expect(report.functional.find(result => result.check === 'picking')?.equivalent).toBe(false)
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

  it('keeps forced batches spatial instead of creating one world-sized draw unit', () => {
    const first = {
      ...boxNode('first', 1, 0),
      optimization: { mode: 'batch' },
    } satisfies ReturnType<typeof meshNode>
    const second = {
      ...boxNode('second', 2, DEFAULT_OPTIMIZATION_POLICY.maxBatchBounds * 2),
      optimization: { mode: 'batch' },
    } satisfies ReturnType<typeof meshNode>

    const artifacts = runtimeArtifactsOf([first, second], EMPTY_TIMELINE)

    expect(artifacts).toHaveLength(2)
    expect(artifacts.every(artifact => artifact.sourceIds.length === 1)).toBe(true)
  })

  it('partitions repeated instances into stable spatial artifacts', () => {
    const nodes = Array.from({ length: 32 }, (_unused, index) => {
      const node = meshNode(`tree-${index}`)
      return {
        ...node,
        transform: {
          ...node.transform,
          position: { x: index < 16 ? index : 512 + index, y: 0, z: 0 },
        },
      }
    })

    const artifacts = runtimeArtifactsOf(nodes, EMPTY_TIMELINE)

    expect(artifacts).toHaveLength(2)
    expect(artifacts.every(artifact => artifact.strategy === 'instance')).toBe(true)
    expect(artifacts.every(artifact => artifact.sourceIds.length === 16)).toBe(true)
  })

  it('refuses automatic instance cells below their local benefit threshold', () => {
    const nodes = Array.from({ length: 16 }, (_unused, index) => {
      const node = meshNode(`tree-${index}`)
      return {
        ...node,
        transform: {
          ...node.transform,
          position: { x: index * DEFAULT_OPTIMIZATION_POLICY.maxBatchBounds, y: 0, z: 0 },
        },
      }
    })

    expect(runtimeArtifactsOf(nodes, EMPTY_TIMELINE)).toEqual([])
  })

  it('partitions children from their resolved world transforms', () => {
    const parent = (id: string, x: number): SceneNode => {
      const transform = meshNode(id).transform
      return {
        id,
        parentId: null,
        name: id,
        visible: true,
        castShadow: false,
        receiveShadow: false,
        type: 'group',
        transform: { ...transform, position: { x, y: 0, z: 0 } },
      }
    }
    const children = Array.from({ length: 32 }, (_unused, index) => ({
      ...meshNode(`child-${index}`),
      parentId: index < 16 ? 'near' : 'far',
    }))

    const artifacts = runtimeArtifactsOf(
      [parent('near', 0), parent('far', 512), ...children],
      EMPTY_TIMELINE,
    )

    expect(artifacts).toHaveLength(2)
    expect(artifacts.every(artifact => artifact.sourceIds.length === 16)).toBe(true)
  })

  it('reuses instance artifacts outside the edited root cell', () => {
    const compiler = createRuntimeWorldCompiler()
    const nodes = Array.from({ length: 32 }, (_unused, index) => {
      const node = meshNode(`tree-${index}`)
      return {
        ...node,
        transform: {
          ...node.transform,
          position: { x: index < 16 ? index : 512 + index, y: 0, z: 0 },
        },
      }
    })
    const before = stateOf(...nodes)
    compiler.compileRuntimeWorld(before)
    const first = nodes[0]!
    const moved = {
      ...first,
      transform: { ...first.transform, position: { x: 70, y: 0, z: 0 } },
    }

    compiler.compileRuntimeRegion(runtimeWorldPatch(before, stateOf(moved, ...nodes.slice(1))))

    expect(compiler.getOptimizationReport().compiledArtifacts).toBe(1)
    expect(compiler.getOptimizationReport().reusedArtifacts).toBe(1)
  })

  it('analyzes only the affected spatial region after a local visibility change', () => {
    const compiler = createRuntimeWorldCompiler()
    const nodes = Array.from({ length: 48 }, (_unused, index) => {
      const node = meshNode(`tree-${index}`)
      return {
        ...node,
        transform: {
          ...node.transform,
          position: { x: Math.floor(index / 16) * 512, y: 0, z: index % 16 },
        },
      }
    })
    const before = stateOf(...nodes)
    compiler.compileRuntimeWorld(before)
    const last = nodes[47]
    if (!last) throw new Error('missing fixture')
    const after = stateOf(...nodes.slice(0, -1), { ...last, visible: false })

    compiler.compileRuntimeRegion(runtimeWorldPatch(before, after))

    expect(compiler.getOptimizationReport()).toMatchObject({
      compiledNodes: 1,
      analyzedArtifactNodes: 15,
      reusedArtifacts: 2,
    })
  })

  it('produces the same artifacts as a whole-world analysis for flat spatial scenes', () => {
    const nodes = Array.from({ length: 64 }, (_unused, index) => {
      const node = boxNode(`prop-${index}`, 1 + (index % 3), Math.floor(index / 16) * 512)
      return index >= 48
        ? ({ ...node, optimization: { mode: 'batch' } } satisfies ReturnType<typeof meshNode>)
        : node
    })

    const runtime = createRuntimeWorldCompiler().compileRuntimeWorld(stateOf(...nodes))

    expect(runtime.runtimeOptimization.artifacts).toEqual(runtimeArtifactsOf(nodes, EMPTY_TIMELINE))
  })

  it('groups compatible automatic and forced model instances as the whole-world analysis does', () => {
    const model = (id: string, mode: 'auto' | 'instance'): ModelNode => ({
      ...meshNode(id),
      type: 'model',
      model: { assetId: 'tree' },
      optimization: { mode },
    })
    const nodes = [
      ...Array.from({ length: 15 }, (_unused, index) => model(`auto-${index}`, 'auto')),
      model('forced', 'instance'),
    ]

    const runtime = createRuntimeWorldCompiler().compileRuntimeWorld({
      ...stateOf(),
      nodes,
    })

    expect(runtime.runtimeOptimization.artifacts).toEqual(runtimeArtifactsOf(nodes, EMPTY_TIMELINE))
    expect(runtime.runtimeOptimization.artifacts[0]?.sourceIds).toHaveLength(16)
  })

  it('propagates a forced mesh instance across compatible spatial regions', () => {
    const compiler = createRuntimeWorldCompiler()
    const forced = {
      ...meshNode('forced'),
      optimization: { mode: 'instance' },
    } satisfies ReturnType<typeof meshNode>
    const sourceAuto = meshNode('auto')
    const automatic = {
      ...sourceAuto,
      transform: { ...sourceAuto.transform, position: { x: 512, y: 0, z: 0 } },
    }
    const before = stateOf(forced, automatic)

    const runtime = compiler.compileRuntimeWorld(before)

    expect(runtime.runtimeOptimization.artifacts).toEqual(
      runtimeArtifactsOf(before.nodes, EMPTY_TIMELINE),
    )
    expect(runtime.runtimeOptimization.artifacts).toHaveLength(2)

    const movedAutomatic = {
      ...automatic,
      transform: { ...automatic.transform, position: { x: 512, y: 0, z: 1 } },
    }
    const movedState = stateOf(forced, movedAutomatic)
    const movedRuntime = compiler.compileRuntimeRegion(runtimeWorldPatch(before, movedState))
    expect(movedRuntime?.runtimeOptimization.artifacts).toEqual(
      runtimeArtifactsOf(movedState.nodes, EMPTY_TIMELINE),
    )

    const unforced = { ...forced, optimization: { mode: 'auto' } } satisfies ReturnType<
      typeof meshNode
    >
    const after = stateOf(unforced, movedAutomatic)
    const changed = compiler.compileRuntimeRegion(runtimeWorldPatch(movedState, after))

    expect(changed?.runtimeOptimization.artifacts).toEqual(
      runtimeArtifactsOf(after.nodes, EMPTY_TIMELINE),
    )
  })

  it('does not propagate forcing from an animated mesh excluded by the canonical policy', () => {
    const sourceForced = meshNode('forced')
    const forced = {
      ...sourceForced,
      optimization: { mode: 'instance' },
    } satisfies ReturnType<typeof meshNode>
    const sourceAuto = meshNode('auto')
    const automatic = {
      ...sourceAuto,
      transform: { ...sourceAuto.transform, position: { x: 512, y: 0, z: 0 } },
    }
    const animation = {
      ...EMPTY_TIMELINE,
      tracks: [
        {
          id: 'move-forced',
          name: 'Move forced',
          index: 0,
          muted: false,
          solo: false,
          locked: false,
          target: { nodeId: forced.id, property: 'position' },
          keys: [],
        },
      ],
    } satisfies AnimationTimeline
    const source: SceneState = { ...stateOf(forced, automatic), animation }

    const runtime = createRuntimeWorldCompiler().compileRuntimeWorld(source)

    expect(runtime.runtimeOptimization.artifacts).toEqual(
      runtimeArtifactsOf(source.nodes, animation),
    )
    expect(runtime.runtimeOptimization.artifacts).toEqual([])
  })

  it('does not compile an invalidated node that the same patch removes', () => {
    const compiler = createRuntimeWorldCompiler()
    const source = stateOf(meshNode('removed'))
    compiler.compileRuntimeWorld(source)
    compiler.invalidateOptimization(['removed'])

    compiler.compileRuntimeRegion(runtimeWorldPatch(source, stateOf()))

    expect(compiler.getOptimizationReport()).toMatchObject({
      compiledNodes: 0,
      reusedNodes: 0,
      removedNodes: 1,
    })
  })

  it('falls back to a whole-world analysis when a hierarchy changes', () => {
    const compiler = createRuntimeWorldCompiler()
    const parent = meshNode('parent')
    const child = { ...meshNode('child'), parentId: parent.id }
    const peer = meshNode('peer')
    const before = stateOf(parent, child, peer)
    compiler.compileRuntimeWorld(before)
    const moved = {
      ...parent,
      transform: { ...parent.transform, position: { x: 512, y: 0, z: 0 } },
    }

    compiler.compileRuntimeRegion(runtimeWorldPatch(before, stateOf(moved, child, peer)))

    expect(compiler.getOptimizationReport().analyzedArtifactNodes).toBe(3)
  })

  it('leaves regional mode when a flat node becomes a child', () => {
    const compiler = createRuntimeWorldCompiler()
    const sourceParent = meshNode('parent')
    const parent = {
      ...sourceParent,
      transform: { ...sourceParent.transform, position: { x: 512, y: 0, z: 0 } },
    }
    const child = meshNode('child')
    const peer = meshNode('peer')
    const before = stateOf(parent, child, peer)
    compiler.compileRuntimeWorld(before)
    const nested = { ...child, parentId: parent.id }

    compiler.compileRuntimeRegion(runtimeWorldPatch(before, stateOf(parent, nested, peer)))

    expect(compiler.getOptimizationReport().analyzedArtifactNodes).toBe(3)
  })

  it('recompiles the destination region when a move creates a group there', () => {
    const compiler = createRuntimeWorldCompiler()
    const destination = Array.from({ length: 15 }, (_unused, index) => {
      const node = meshNode(`destination-${index}`)
      return {
        ...node,
        transform: { ...node.transform, position: { x: 512, y: 0, z: index } },
      }
    })
    const moving = meshNode('moving')
    const before = stateOf(moving, ...destination)
    compiler.compileRuntimeWorld(before)
    const moved = {
      ...moving,
      transform: { ...moving.transform, position: { x: 512, y: 0, z: 15 } },
    }

    const runtime = compiler.compileRuntimeRegion(
      runtimeWorldPatch(before, stateOf(moved, ...destination)),
    )

    expect(runtime?.runtimeOptimization.artifacts[0]?.sourceIds).toHaveLength(16)
    expect(runtime?.runtimeOptimization.artifacts).toEqual(
      runtimeArtifactsOf([moved, ...destination], EMPTY_TIMELINE),
    )
  })

  it('chooses a measured merge for a small cell and a batch for a larger compatible cell', () => {
    const compiler = createRuntimeWorldCompiler()
    const nodes = Array.from({ length: 11 }, (_unused, index) =>
      boxNode(
        `prop-${index}`,
        index + 1,
        index < 2 ? index : DEFAULT_OPTIMIZATION_POLICY.maxBatchBounds + index,
      ),
    )

    const runtime = compiler.compileRuntimeWorld(stateOf(...nodes))

    const merge = runtime.runtimeOptimization.artifacts.find(
      artifact => artifact.strategy === 'merge',
    )
    const batch = runtime.runtimeOptimization.artifacts.find(
      artifact => artifact.strategy === 'batch',
    )
    expect(merge?.sourceIds).toEqual(['prop-0', 'prop-1'])
    expect(batch?.sourceIds).toHaveLength(9)
  })

  it('keeps explicit individual and excluded nodes out of automatic artifacts', () => {
    const compiler = createRuntimeWorldCompiler()
    const individual: ReturnType<typeof meshNode>[] = Array.from(
      { length: 2 },
      (_unused, index) => ({
        ...boxNode(`individual-${index}`, index + 1, index),
        optimization: { mode: 'individual' },
      }),
    )
    const excluded: ReturnType<typeof meshNode>[] = Array.from({ length: 2 }, (_unused, index) => ({
      ...boxNode(`excluded-${index}`, index + 3, index),
      optimization: { mode: 'exclude' },
    }))

    const runtime = compiler.compileRuntimeWorld(stateOf(...individual, ...excluded))

    expect(runtime.runtimeOptimization.artifacts).toEqual([])
  })

  it('keeps compatible objects in distant spatial cells out of one batch', () => {
    const compiler = createRuntimeWorldCompiler()
    const first = meshNode('first')
    const second = boxNode('second', 2, DEFAULT_OPTIMIZATION_POLICY.maxBatchBounds * 2)

    const runtime = compiler.compileRuntimeWorld(stateOf(first, second))

    expect(runtime.runtimeOptimization.artifacts).toEqual([])
  })

  it('keeps a mesh wider than the culling bound out of automatic artifacts', () => {
    const compiler = createRuntimeWorldCompiler()
    const nodes: ReturnType<typeof meshNode>[] = ['first', 'second'].map((id, index) => ({
      ...boxNode(id, index + 1, index),
      geometry: { kind: 'box', width: 300, height: 1, depth: 1 },
    }))

    const runtime = compiler.compileRuntimeWorld(stateOf(...nodes))

    expect(runtime.runtimeOptimization.artifacts).toEqual([])
  })

  it('splits a dense compatible world into finer culling cells', () => {
    const nodes = Array.from({ length: 4_096 }, (_unused, index) =>
      boxNode(`dense-${index}`, 1 + index / 100_000, index % 64),
    ).map((node, index) => ({
      ...node,
      transform: {
        ...node.transform,
        position: { x: node.transform.position.x, y: 0, z: Math.floor(index / 64) },
      },
    }))

    const artifacts = runtimeArtifactsOf(nodes, EMPTY_TIMELINE)

    expect(artifacts).toHaveLength(4)
    expect(artifacts.every(artifact => artifact.sourceIds.length === 1_024)).toBe(true)
  })

  it('recompiles when a move crosses an adaptive boundary inside the legacy fixed cell', () => {
    const compiler = createRuntimeWorldCompiler()
    const nodes = Array.from({ length: 512 }, (_unused, index) =>
      boxNode(`prop-${index}`, 1 + index / 100_000, index % 32),
    ).map((node, index) => ({
      ...node,
      transform: {
        ...node.transform,
        position: { x: node.transform.position.x, y: 0, z: Math.floor(index / 32) },
      },
    }))
    const before = stateOf(...nodes)
    compiler.compileRuntimeWorld(before)
    const moved = {
      ...nodes[0]!,
      transform: { ...nodes[0]!.transform, position: { x: 40, y: 0, z: 0 } },
    }
    const after = stateOf(moved, ...nodes.slice(1))

    compiler.compileRuntimeRegion(runtimeWorldPatch(before, after))

    expect(compiler.getOptimizationReport().compiledArtifacts).toBeGreaterThan(0)
  })

  it('recompiles when scale makes a spatial member too large for its cell', () => {
    const compiler = createRuntimeWorldCompiler()
    const first = boxNode('first', 1, 0)
    const second = boxNode('second', 2, 1)
    const before = stateOf(first, second)
    compiler.compileRuntimeWorld(before)
    const scaled = {
      ...second,
      transform: { ...second.transform, scale: { x: 300, y: 300, z: 300 } },
    }

    const runtime = compiler.compileRuntimeRegion(runtimeWorldPatch(before, stateOf(first, scaled)))

    expect(runtime?.runtimeOptimization.artifacts).toEqual([])
    expect(compiler.getOptimizationReport().compiledArtifacts).toBe(0)
  })

  it('recompiles spatial artifacts when a node crosses a cell boundary', () => {
    const compiler = createRuntimeWorldCompiler()
    const first = meshNode('first')
    const second = boxNode('second', 2, 1)
    const before = stateOf(first, second)
    compiler.compileRuntimeWorld(before)
    const after = stateOf(
      first,
      boxNode('second', 2, DEFAULT_OPTIMIZATION_POLICY.spatialCellTargetSize * 2),
    )

    const runtime = compiler.compileRuntimeRegion(runtimeWorldPatch(before, after))

    expect(runtime?.runtimeOptimization.artifacts).toEqual([])
    expect(compiler.getOptimizationReport().compiledArtifacts).toBe(0)
  })

  it('keeps mesh parents individual so their document subtree remains reachable', () => {
    const compiler = createRuntimeWorldCompiler()
    const parent = meshNode('parent')
    const peer = boxNode('peer', 2, 1)
    const child = { ...meshNode('child'), parentId: parent.id }

    const runtime = compiler.compileRuntimeWorld(stateOf(parent, peer, child))

    expect(
      runtime.runtimeOptimization.artifacts.some(artifact =>
        artifact.sourceIds.includes(parent.id),
      ),
    ).toBe(false)
  })

  it('chunks artifact members deterministically before signing them', () => {
    const nodes = Array.from({ length: 5 }, (_unused, index) =>
      boxNode(`prop-${index}`, index + 1, 0),
    )
    const policy = { ...DEFAULT_OPTIMIZATION_POLICY, maxObjectsPerBatch: 2 }

    const forward = runtimeArtifactsOf(nodes, EMPTY_TIMELINE, policy)
    const reversed = runtimeArtifactsOf([...nodes].reverse(), EMPTY_TIMELINE, policy)

    expect(reversed).toEqual(forward)
  })

  it('separates indexed and non-indexed primitives before merge', () => {
    const boxes = [boxNode('box-a', 1, 0), boxNode('box-b', 2, 1)]
    const polyhedra: ReturnType<typeof meshNode>[] = ['poly-a', 'poly-b'].map(id => ({
      ...meshNode(id),
      geometry: { kind: 'icosahedron', radius: 1 },
    }))

    const artifacts = runtimeArtifactsOf([...boxes, ...polyhedra], EMPTY_TIMELINE)

    expect(artifacts).toHaveLength(2)
    expect(artifacts.every(artifact => artifact.strategy === 'merge')).toBe(true)
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
      analyzedArtifactNodes: 0,
    })
  })
})
