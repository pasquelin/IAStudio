import { describe, expect, it } from 'vitest'
import { isRecord } from '@shared/guards'
import { createFakeStudio } from './fakeStudio'
import { PROJECT } from './scenarios'

/**
 * 🛑 The one thing no eval run can tell you: an action modelled on the WRONG shape reads exactly
 * like a model that chose badly. `unmodelled` never names it — the action WAS modelled.
 */
const studio = () => createFakeStudio(PROJECT)

type Studio = ReturnType<typeof createFakeStudio>

const nodeIn = (bench: Studio, kind: string): string => {
  bench.run('workspace.open', { workspace: '3d', createDocument: true, title: 'Scene' })
  const added = bench.run('node.add', { kind, name: kind })
  return added.ok && isRecord(added.data) ? String(added.data['nodeId']) : ''
}

const castleId = (bench: Studio): string => {
  const found = bench.run('assets.search', { text: 'chateau' })
  const first = found.ok && Array.isArray(found.data) ? found.data[0] : null
  return isRecord(first) ? String(first['id']) : ''
}

describe('the studio the bench answers with', () => {
  it('puts a picture on a plane through the field the registry declares', () => {
    const bench = studio()
    const node = nodeIn(bench, 'plane')
    const assetId = castleId(bench)
    expect(assetId).not.toBe('')

    expect(bench.run('node.material', { nodeId: node, textures: { map: assetId } })).toEqual({
      ok: true,
    })
    expect(bench.front()?.nodes[0]?.textures.map).toBe(assetId)
  })

  /** The shape the bench used to accept, and the studio never has: no declared field is named. */
  it('refuses a material call naming a picture where no field takes one', () => {
    const bench = studio()
    const node = nodeIn(bench, 'plane')

    expect(bench.run('node.material', { nodeId: node, assetId: 'asset-1' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
    expect(bench.front()?.nodes[0]?.textures).toEqual({})
  })

  /** An imported model wears `model.textures`; a chain through this one fails in the studio. */
  it('refuses a material call on a node that wears none', () => {
    const bench = studio()
    bench.run('workspace.open', { workspace: '3d', createDocument: true, title: 'Scene' })
    const added = bench.run('node.addModel', { assetId: castleId(bench) })
    const node = added.ok && isRecord(added.data) ? String(added.data['nodeId']) : ''

    expect(bench.run('node.material', { nodeId: node, textures: { map: 'asset-1' } })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('carries a sprite map, and only onto a sprite', () => {
    const bench = studio()
    expect(bench.run('node.sprite', { nodeId: nodeIn(bench, 'plane'), map: 'asset-1' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })

    const other = studio()
    expect(other.run('node.sprite', { nodeId: nodeIn(other, 'sprite'), map: 'asset-1' }).ok).toBe(
      true,
    )
    // Its OWN field: a sprite is not a plane, and the scene oracle reads the colour map alone.
    expect(other.front()?.nodes[0]?.sprite).toBe('asset-1')
    expect(other.front()?.nodes[0]?.textures).toEqual({})
  })

  /** `texturesFrom` refuses a slot holding anything but a string; `validatesInput` only reads keys. */
  it('refuses a slot whose value is not an asset id, and a node named rather than identified', () => {
    const bench = studio()
    const node = nodeIn(bench, 'plane')

    expect(bench.run('node.material', { nodeId: node, textures: { map: 42 } })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
    // `nodeById` answers to the id alone — the field the model gets wrong most often.
    expect(bench.run('node.material', { nodeId: 'plane', textures: { map: 'asset-1' } })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  /** `node.geometry` aims at a node; a bench that made one scored "resize it" as a second one. */
  it('changes the shape of a node instead of adding one', () => {
    const bench = studio()
    const node = nodeIn(bench, 'box')

    expect(bench.run('node.geometry', { nodeId: node, width: 3 }).ok).toBe(true)
    expect(bench.front()?.nodes).toHaveLength(1)
  })

  it('names every action it has no answer for', () => {
    const bench = studio()
    bench.run('git.status', {})

    expect(bench.unmodelled()).toEqual(['git.status'])
  })
})
