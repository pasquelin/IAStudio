import { bench, describe } from 'vitest'
import { EMPTY_TIMELINE } from '@shared/domain/animation'
import { DEFAULT_WORLD } from '@shared/domain/scene'
import { meshNode } from './scene-fixtures'
import { createRuntimeWorldCompiler, runtimeWorldPatch } from './runtimeWorldCompiler'
import type { SceneState } from './sceneState'

const COUNT = 50_000
const nodes = Array.from({ length: COUNT }, (_unused, index) => meshNode(`node-${index}`))
const before: SceneState = {
  nodes,
  selectedIds: [],
  world: DEFAULT_WORLD,
  animation: EMPTY_TIMELINE,
}
const changed: SceneState = {
  ...before,
  nodes: nodes.map((node, index) => (index === COUNT - 1 ? { ...node, visible: false } : node)),
}

describe('50,000 authoring nodes with one local edit', () => {
  bench('builds and compiles the delta', () => {
    const compiler = createRuntimeWorldCompiler()
    compiler.compileRuntimeWorld(before)
    compiler.compileRuntimeRegion(runtimeWorldPatch(before, changed))
  })
})
