import { describe, expect, it } from 'vitest'
import { instancedNodes, prefabNodes } from './prefab'
import { barrelDocument, barrelNodes } from './prefab-fixtures'

const ORIGIN = { x: 0, y: 0, z: 0 }
const held = barrelNodes()
const read = () => prefabNodes(barrelDocument())

describe('a prefab read off its file', () => {
  /** 🛑 A scene is written as glTF: read as a plain payload it answers an EMPTY scene. */
  it('reads a document as the studio wrote and the disk hands it', () => {
    expect(read()).toHaveLength(2)
  })

  /** A file of the project may be hand-edited or synced back half written. */
  it('gives nothing back for a document that no longer parses', () => {
    expect(prefabNodes({ ...barrelDocument(), content: '{ not json' })).toEqual([])
  })
})

describe('a prefab instanced into a scene', () => {
  /** Instancing twice must not give two nodes one id — the second would edit the first. */
  it('mints fresh ids, and different ones for a second instance', () => {
    const ids = [...instancedNodes(held, ORIGIN), ...instancedNodes(held, ORIGIN)].map(
      node => node.id,
    )

    expect(ids).not.toContain(held[0]?.id)
    expect(new Set(ids).size).toBe(4)
  })

  /** A child whose parent kept its old id would hang off the FIRST instance. */
  it('keeps the hierarchy, against the ids it just minted', () => {
    const nodes = instancedNodes(held, ORIGIN)

    expect(nodes.find(node => node.parentId !== null)?.parentId).toBe(
      nodes.find(node => node.name === 'Barrel')?.id,
    )
  })

  /** A child is placed against its parent already: moving it too would move it twice. */
  it('moves the roots by the offset and leaves the children where they were', () => {
    const nodes = instancedNodes(held, { x: 3, y: 0, z: -2 })

    expect(nodes.find(node => node.parentId === null)?.transform.position).toMatchObject({
      x: 3,
      z: -2,
    })
    expect(nodes.find(node => node.parentId !== null)?.transform.position).toEqual(
      held[1]?.transform.position,
    )
  })
})
