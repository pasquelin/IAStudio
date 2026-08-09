import { bench, describe } from 'vitest'
import type { GraphEdge, GraphNode, GraphState } from '@shared/domain/graph'
import { handleId } from './handles'
import { planGraph } from './plan'

/**
 * What planning a whole graph costs, and therefore whether a caller may ask for one on a gesture
 * — or on a keystroke.
 *
 * The size is not arbitrary: 62 nodes is the largest published Scenario workflow
 * (`wflow_H1bKz78jgpinWPKJfVCM5uAp`), and the studio's own ceiling for export is 50. Two weights
 * of form are measured because the whole cost follows the bytes hashed, not the node count: a
 * lifelike generator form is a few hundred bytes, one carrying long prompts and a LoRA stack a
 * few thousand.
 */

function formOf(index: number, heavy: boolean): Record<string, unknown> {
  const form: Record<string, unknown> = {
    prompt: heavy ? `a knight on a horse, ${index} `.repeat(20) : `a knight on a horse, ${index}`,
    negativePrompt: 'blurry, low quality',
    width: 1024,
    height: 1024,
    numOutputs: 4,
    numInferenceSteps: 30,
    guidance: 7.5,
    seed: index * 977,
    scheduler: 'EulerDiscreteScheduler',
    quality: 'high',
  }
  if (heavy) form.loras = Array.from({ length: 8 }, (_unused, n) => ({ id: `lora_${n}`, scale: n }))
  return form
}

/** A chain, plus two wires reaching further back: about three providers per node. */
function graphOf(count: number, heavy: boolean): GraphState {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  for (let at = 0; at < count; at += 1) {
    const id = `m${at}`
    nodes.push({
      id,
      type: 'model',
      position: { x: at * 10, y: 0 },
      data: {
        modelId: 'model_flux',
        form: formOf(at, heavy),
        inputHandles: Array.from({ length: heavy ? 30 : 4 }, (_unused, n) => ({
          id: handleId(id, 'source', `port${n}`),
          name: `port${n}`,
          type: 'image',
        })),
        outputHandles: [{ id: handleId(id, 'target', 'image'), name: 'output', type: 'image' }],
      },
    })

    for (const back of [1, 4, 9]) {
      if (at - back < 0) continue
      edges.push({
        id: `m${at - back}--TO--${id}`,
        source: id,
        sourceHandle: handleId(id, 'source', `port${back}`),
        target: `m${at - back}`,
        targetHandle: handleId(`m${at - back}`, 'target', 'image'),
      })
    }
  }

  return { nodes, edges, inputKeys: [] }
}

/** Every node in one loop: the case where Kahn places nothing and the peeling runs instead. */
function loopedGraph(count: number): GraphState {
  const straight = graphOf(count, false)
  const back: GraphEdge = {
    id: 'loop',
    source: 'm0',
    sourceHandle: handleId('m0', 'source', 'port0'),
    target: `m${count - 1}`,
    targetHandle: handleId(`m${count - 1}`, 'target', 'image'),
  }

  return { ...straight, edges: [...straight.edges, back] }
}

describe('planning a graph', () => {
  const lifelike = graphOf(62, false)
  const heavy = graphOf(62, true)
  const looped = loopedGraph(62)

  bench('62 nodes, lifelike forms', () => void planGraph(lifelike))
  bench('62 nodes, heavy forms', () => void planGraph(heavy))
  bench('62 nodes, all caught in one cycle', () => void planGraph(looped))
})
