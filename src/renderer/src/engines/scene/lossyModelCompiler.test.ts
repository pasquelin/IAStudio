import {
  BoxGeometry,
  Group,
  LOD,
  Mesh,
  MeshStandardMaterial,
  SkinnedMesh,
  type BufferGeometry,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import { NO_LOSSY_OPTIMIZATION } from '@shared/domain/gameExport'
import { compileLossyModels } from './lossyModelCompiler'

describe('LOSSY imported models compiled for an export', () => {
  it('keeps exact LOD0 outside the plan and compiles only distant levels', async () => {
    const root = new Group()
    root.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()))
    const simplify = vi.fn(
      async (_geometry: BufferGeometry, _ratio: number, _signal: AbortSignal | undefined) =>
        new BoxGeometry(),
    )

    const compiled = await compileLossyModels(
      ['tree'],
      { ...NO_LOSSY_OPTIMIZATION, generateLods: true },
      undefined,
      { load: async () => root, simplify, dispose: vi.fn() },
    )

    expect(compiled.get('tree')?.[0]).toMatchObject({ meshIndex: 0 })
    expect(compiled.get('tree')?.[0]?.geometry).toBeUndefined()
    expect(compiled.get('tree')?.[0]?.lodMeshes).toHaveLength(2)
    expect(simplify.mock.calls.map(call => call[1])).toEqual([0.35, 0.65])
  })

  it('does not simplify skinned geometry whose animation attributes must survive', async () => {
    const root = new Group()
    root.add(new SkinnedMesh(new BoxGeometry(), new MeshStandardMaterial()))
    const simplify = vi.fn()

    const compiled = await compileLossyModels(
      ['character'],
      { ...NO_LOSSY_OPTIMIZATION, geometrySimplification: 'aggressive' },
      undefined,
      { load: async () => root, simplify, dispose: vi.fn() },
    )

    expect(compiled.size).toBe(0)
    expect(simplify).not.toHaveBeenCalled()
  })

  it('uses existing LODs instead of generating nested replacements', async () => {
    const root = new LOD()
    root.addLevel(new Mesh(new BoxGeometry(), new MeshStandardMaterial()), 0)
    root.addLevel(new Mesh(new BoxGeometry(), new MeshStandardMaterial()), 20)
    const simplify = vi.fn()

    const compiled = await compileLossyModels(
      ['tree'],
      { ...NO_LOSSY_OPTIMIZATION, generateLods: true },
      undefined,
      { load: async () => root, simplify, dispose: vi.fn() },
    )

    expect(compiled.size).toBe(0)
    expect(simplify).not.toHaveBeenCalled()
  })
})
