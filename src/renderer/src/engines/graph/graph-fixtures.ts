import type { GraphEdge, GraphNode, GraphState } from '@shared/domain/graph'
import { DEFAULT_OUTPUT_NAME, handleId } from './handles'

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
export function textNode(id: string): GraphNode {
  return {
    id,
    type: 'text',
    position: { x: 0, y: 0 },
    data: {
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
