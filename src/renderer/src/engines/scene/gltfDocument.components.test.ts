import { describe, expect, it } from 'vitest'
import type { Component } from '@shared/domain/component'
import { newComponent } from '@shared/domain/componentRegistry'
import { GLTF_SCENE_STATE } from '@shared/domain/gltf'
import { isRecord } from '@shared/guards'
import {
  gltfDocumentOf,
  sceneFromGltf,
  sceneHoldsMore,
  type GltfDocumentOptions,
} from './gltfDocument'
import { meshNode } from './scene-fixtures'
import { EMPTY_SCENE, type SceneState } from './sceneState'

const WRITTEN: GltfDocumentOptions = { documentId: 'doc-1', documentKind: 'scene' }

const sceneWith = (components?: readonly Component[]): SceneState => ({
  ...EMPTY_SCENE,
  nodes: [components === undefined ? meshNode('a') : { ...meshNode('a'), components }],
})

const written = (state: SceneState): Record<string, unknown> => {
  const document = gltfDocumentOf(state, WRITTEN)
  if (!isRecord(document)) throw new Error('not a document')
  return document
}

/** The payload's own nodes, which is where a component rides — see `ScenePayload`. */
const payloadNodes = (document: Record<string, unknown>): Record<string, unknown>[] => {
  const scenes = document.scenes
  const first = Array.isArray(scenes) ? scenes[0] : null
  const extras = isRecord(first) ? first.extras : null
  const studio = isRecord(extras) ? extras.iastudio : null
  const state = isRecord(studio) ? studio[GLTF_SCENE_STATE] : null
  const nodes = isRecord(state) ? state.nodes : null
  return Array.isArray(nodes) ? nodes.filter(isRecord) : []
}

describe('a scene document carrying components', () => {
  it('writes them and reads them back unchanged', () => {
    const health = newComponent('Health')
    const back = sceneFromGltf(written(sceneWith([health])))

    expect(back.nodes[0]?.components).toEqual([health])
  })

  /** The byte-for-byte promise: a document written before components exist gains no key. */
  it('leaves a node that carries none without the key at all', () => {
    expect(payloadNodes(written(sceneWith()))[0]).not.toHaveProperty('components')
    expect(sceneFromGltf(written(sceneWith()))).toEqual(sceneWith())
  })

  /**
   * A type this build has no system for is dropped from the state — nothing would simulate it —
   * and the refusal below is what stops a save from losing it from the FILE too.
   */
  it('drops a component of a type this build does not know', () => {
    const document = written(sceneWith([newComponent('Health')]))
    const node = payloadNodes(document)[0]
    if (node) node.components = [{ type: 'Wings', span: 2 }]

    expect(sceneFromGltf(document).nodes[0]?.components).toEqual([])
  })

  it('refuses to save over a file holding a component it cannot act on', () => {
    const document = written(sceneWith([newComponent('Health')]))
    const node = payloadNodes(document)[0]
    if (node) node.components = [newComponent('Health'), { type: 'Wings', span: 2 }]

    expect(sceneHoldsMore(document)).toEqual(['components.Wings'])
  })

  it('finds nothing to refuse in a file whose components it knows', () => {
    expect(sceneHoldsMore(written(sceneWith([newComponent('Health')])))).toEqual([])
  })
})
