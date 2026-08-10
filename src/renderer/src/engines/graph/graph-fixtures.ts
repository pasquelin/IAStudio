import type { GraphEdge, GraphNode, GraphState } from '@shared/domain/graph'
import { DEFAULT_OUTPUT_NAME, handleId, loopInputId, loopOutputId } from './handles'
import type { LoopListKind } from './loops'

/**
 * A text node with the one port it is wired by, for the suites whose subject is not the port
 * itself. Declared once so a new required field on `GraphNode` breaks in one place.
 *
 * **Spelled exactly as `createNode` spells it, and that is the point.** The field of the id is
 * `prompt` while the type is `text` — the field name is not the type — and this fixture used to
 * write `output` and `prompt` instead. Three lots were tested against a text node the studio does
 * not build, which is how the one connection the graph space exists for could be refused on the
 * canvas while every suite stayed green.
 *
 * The tests that DO make ports their subject — polymorphic inputs, mismatched types — keep
 * writing their own: there, the handles are what is being read.
 */
export function textNode(id: string, value?: string): GraphNode {
  return {
    id,
    type: 'text',
    position: { x: 0, y: 0 },
    data: {
      // Left out where none is given rather than defaulted: a written `value` is hashed.
      ...(value === undefined ? {} : { value }),
      outputHandles: [
        { id: handleId(id, 'target', 'prompt'), name: DEFAULT_OUTPUT_NAME, type: 'text' },
      ],
    },
  }
}

/**
 * A generator node with one prompt port, named as `modelPorts` names one: by the field's key.
 *
 * `null` is a generator carrying NO model, which a node read off a file may well be — spelled
 * that way rather than `undefined`, which the default would swallow.
 */
export function modelNode(
  id: string,
  form: Readonly<Record<string, unknown>> = {},
  modelId: string | null = 'model_flux',
): GraphNode {
  return {
    id,
    type: 'model',
    position: { x: 0, y: 0 },
    data: {
      ...(modelId === null ? {} : { modelId }),
      form,
      inputHandles: [{ id: handleId(id, 'source', 'prompt'), name: 'prompt', type: 'prompt' }],
      outputHandles: [
        { id: handleId(id, 'target', 'image'), name: DEFAULT_OUTPUT_NAME, type: 'image' },
      ],
    },
  }
}

/**
 * An approval node, with the one port the converter finds it by. No output and no `conditional`:
 * an approval is read as a dependency, never as a value — see `createNode`.
 */
export function approvalNode(id: string, message = ''): GraphNode {
  return {
    id,
    type: 'approval',
    position: { x: 0, y: 0 },
    data: { message, inputHandles: [{ id: handleId(id, 'source', 'approval'), name: 'approval' }] },
  }
}

/** A note: drawn on the canvas, compiled to nothing, and read by no port at either end. */
export function noteNode(id: string, content = ''): GraphNode {
  return { id, type: 'stickyNote', position: { x: 0, y: 0 }, data: { content } }
}

/**
 * A transform node, spelled as `createNode` spells one: an untyped `text` input beside the
 * conditional port every node carries, and an output the next node reads as text.
 */
export function transformNode(id: string, value = ''): GraphNode {
  return {
    id,
    type: 'transformText',
    position: { x: 0, y: 0 },
    data: {
      value,
      inputHandles: [
        { id: handleId(id, 'source', 'conditional'), name: 'conditional', type: 'conditional' },
        { id: handleId(id, 'source', 'text'), name: 'text' },
      ],
      outputHandles: [
        { id: handleId(id, 'target', 'text'), name: DEFAULT_OUTPUT_NAME, type: 'text' },
      ],
    },
  }
}

/**
 * A loop walking the lists it is given, one numbered pair of ports each.
 *
 * The `conditional` port comes first and is NOT a list — it is what keeps these suites honest
 * about the reader, which has to tell a port the loop walks from a port every node carries.
 */
export function forEachNode(id: string, kinds: readonly LoopListKind[] = ['image']): GraphNode {
  return {
    id,
    type: 'forEach',
    position: { x: 0, y: 0 },
    data: {
      inputHandles: [
        { id: handleId(id, 'source', 'conditional'), name: 'conditional', type: 'conditional' },
        ...kinds.map((kind, index) => ({
          id: loopInputId(id, index),
          name: `list${index}`,
          type: kind,
        })),
      ],
      outputHandles: kinds.map((kind, index) => ({
        id: loopOutputId(id, index),
        name: `item${index}`,
        type: kind,
      })),
    },
  }
}

/** The end of a loop, naming the one it closes — the field the converter pairs the two by. */
export function forEachEndNode(id: string, parentNodeId?: string): GraphNode {
  return {
    id,
    type: 'forEachEnd',
    position: { x: 0, y: 0 },
    data: {
      ...(parentNodeId === undefined ? {} : { parentNodeId }),
      inputHandles: [
        { id: handleId(id, 'source', 'conditional'), name: 'conditional', type: 'conditional' },
      ],
    },
  }
}

/**
 * The wire an approval names the node it guards by. Its own port on one end, and the guarded
 * node's output on the other, which is what lets the approval show what it is asked about.
 */
export const guards = (approvalId: string, guarded: string, from = 'image'): GraphEdge =>
  wire(approvalId, 'approval', guarded, from)

/** `source` is the CONSUMER and `target` the PROVIDER — Scenario's inverted convention. */
export function wire(consumer: string, port: string, provider: string, from: string): GraphEdge {
  return {
    id: `${provider}--TO--${consumer}`,
    source: consumer,
    sourceHandle: handleId(consumer, 'source', port),
    target: provider,
    targetHandle: handleId(provider, 'target', from),
  }
}

export const graphOf = (nodes: readonly GraphNode[], edges: readonly GraphEdge[]): GraphState => ({
  nodes,
  edges,
  inputKeys: [],
})
