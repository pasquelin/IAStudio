import { describe, expect, it } from 'vitest'
import { validateEditorInfo } from '@scenario-labs/sdk'
import type { GraphNode, GraphState } from './graph'
import { WORKFLOW_FILE_VERSION, workflowFileOf, workflowInputsOf } from './workflow-file'

const assetNode = (id: string, data: GraphNode['data'] = {}): GraphNode => ({
  id,
  type: 'asset',
  position: { x: 0, y: 0 },
  data,
})

const graphOf = (nodes: readonly GraphNode[], inputKeys: readonly string[] = []): GraphState => ({
  nodes,
  edges: [],
  inputKeys,
})

const ABOUT = { name: 'Heroes', exportedAt: '2026-08-10T18:00:00.000Z', exportedBy: 'user_1' }

describe('the inputs a graph declares', () => {
  /**
   * The whole reason this module exists. Read off `wflow_H1bKz78jgpinWPKJfVCM5uAp` on 10 August:
   * `inputKeys` is EMPTY there while `inputs_definition` carries one entry per node marked
   * `isInput`. Derived from `inputKeys`, an export would ask its caller for nothing.
   */
  it('reads them off the nodes marked as inputs, not off inputKeys', () => {
    const graph = graphOf(
      [
        assetNode('image2', { isInput: true, type: 'image', title: 'Hero — Sci-Fi Medic' }),
        assetNode('image9', { type: 'image', title: 'Not an input' }),
      ],
      // Deliberately naming another node: `inputKeys` must not decide this.
      ['image9'],
    )

    expect(workflowInputsOf(graph)).toEqual([
      {
        name: 'image2',
        label: 'Hero — Sci-Fi Medic',
        description: '',
        type: 'file',
        kind: 'image',
        costImpact: false,
        required: { always: false },
      },
    ])
  })

  /** `required` is an OBJECT in the App read, never a boolean — spelled out rather than assumed. */
  it('spells required as the object the API carries', () => {
    const graph = graphOf([assetNode('image2', { isInput: true, type: 'image' })])

    expect(workflowInputsOf(graph)[0]?.required).toEqual({ always: false })
  })

  it('leaves the label blank rather than filling it with the id', () => {
    const graph = graphOf([assetNode('image2', { isInput: true, type: 'image' })])

    expect(workflowInputsOf(graph)[0]?.label).toBe('')
  })

  /** An asset node whose kind a file did not spell still asks for a picture, not for nothing. */
  it('falls back to a picture where the node names no kind', () => {
    const graph = graphOf([assetNode('image2', { isInput: true })])

    expect(workflowInputsOf(graph)[0]).toMatchObject({ type: 'file', kind: 'image' })
  })

  it('asks for a string where the input node is not an asset', () => {
    const text: GraphNode = {
      id: 'text1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: { isInput: true },
    }

    expect(workflowInputsOf(graphOf([text]))[0]).toMatchObject({ type: 'string', kind: 'text' })
  })

  it('declares nothing for a graph no node is marked in', () => {
    expect(workflowInputsOf(graphOf([assetNode('image2', { type: 'image' })]))).toEqual([])
  })
})

/**
 * The promise of the whole lot, checked against the very validator the webapp runs on import —
 * `validateEditorInfo`, exported by the SDK. Nothing else can prove "a graph made in the studio
 * opens in the webapp": the shape was read off one App, and one App is not the contract.
 */
describe('the file, put through the webapp’s own import validator', () => {
  it('is accepted as it stands', () => {
    const graph = graphOf([assetNode('image2', { isInput: true, type: 'image', title: 'Hero' })])

    expect(() => validateEditorInfo(workflowFileOf(graph, ABOUT))).not.toThrow()
  })

  /** The version is what it checks first, and ours is written for that reason. */
  it('is refused once the version is not the one it knows', () => {
    const file = { ...workflowFileOf(graphOf([]), ABOUT), version: '2.0' }

    expect(() => validateEditorInfo(file)).toThrow()
  })
})

describe('the file a graph becomes', () => {
  it('writes the version the webapp validates', () => {
    expect(workflowFileOf(graphOf([]), ABOUT).version).toBe(WORKFLOW_FILE_VERSION)
    expect(WORKFLOW_FILE_VERSION).toBe('1.0')
  })

  /** `editorInfo` is the graph itself — what the other editor opens. */
  it('carries the graph under editorInfo, edges and input keys included', () => {
    const graph = graphOf([assetNode('image2', { type: 'image' })], ['image2'])

    expect(workflowFileOf(graph, ABOUT).editorInfo).toEqual({
      nodes: graph.nodes,
      edges: [],
      inputKeys: ['image2'],
    })
  })

  /**
   * The boxes a user drew around their nodes. Dropped, an export loses them while every node keeps
   * a `data.group` naming an id nothing resolves — an aller-retour that is not idempotent.
   */
  it('carries the node groups too', () => {
    const grouped: GraphState = {
      ...graphOf([assetNode('image2', { type: 'image', group: 'g1' })]),
      nodeGroups: { g1: { title: 'Heroes' } },
    }

    expect(workflowFileOf(grouped, ABOUT).editorInfo).toMatchObject({
      nodeGroups: { g1: { title: 'Heroes' } },
    })
  })

  /** A graph with no box says nothing rather than an empty one, as the reader writes it. */
  it('leaves the groups out where the graph has none', () => {
    expect(workflowFileOf(graphOf([]), ABOUT).editorInfo).not.toHaveProperty('nodeGroups')
  })

  /**
   * The clock and the account come from the caller: `shared/` carries no runtime dependency, and
   * a timestamp read inside would make this suite depend on the hour it runs at.
   */
  it('takes the moment and the author rather than reading them', () => {
    expect(workflowFileOf(graphOf([]), ABOUT)).toMatchObject({
      name: 'Heroes',
      description: '',
      exportedAt: '2026-08-10T18:00:00.000Z',
      exportedBy: 'user_1',
      tagSet: [],
    })
  })
})
