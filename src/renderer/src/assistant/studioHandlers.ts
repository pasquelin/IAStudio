import { assistantAction, refused, type ActionOutcome } from '@shared/domain/assistant'
import { batchCalls } from '@shared/domain/gameActions'
import { COMPONENTS, COMPONENT_TYPES, descriptorOf } from '@shared/domain/componentRegistry'
import { isComponentType } from '@shared/domain/componentRegistry'
import { refFromString } from '@shared/domain/ref'
import STUDIO_TYPES from '@game/api/studio.d.ts?raw'
import { activeSceneId, useDocuments } from '@/stores/documents'
import { sceneOf, useScenes } from '@/stores/scenes'
import type { ActionHandlers } from './actionHandler'
import { textOf } from './actionInputs'
import { nodeAimed } from './nodeAimed'

/**
 * The three that keep a model from having to GUESS — the plan's § 16.3.
 *
 * 🛑 They are the answer to the tool COUNT, not a convenience: one action that describes what is
 * in front, one that serves the slice of documentation answering a question, and one that runs a
 * lot of primitives as a single undo entry replace the hundred narrow actions a game would
 * otherwise need. Measured in the same lot — see the token delta.
 */
export const STUDIO_HANDLERS: ActionHandlers = {
  'studio.describe': input => {
    const documentId = activeSceneId(useDocuments.getState())
    if (documentId === null) return refused('wrongSurface')

    const named = textOf(input, 'ref') ?? ''
    const scene = sceneOf(useScenes.getState(), documentId)
    if (named.length === 0) {
      return {
        ok: true,
        data: {
          scene: documentId,
          nodes: scene.nodes.map(node => ({ id: node.id, name: node.name, type: node.type })),
          available: { components: COMPONENT_TYPES },
        },
      }
    }

    const node = nodeAimed(scene, refFromString(named)?.kind === 'entity' ? idOf(named) : named)
    if (!node) return refused('notFound', `no node "${named}" in the scene in front, by id or name`)

    return {
      ok: true,
      data: {
        id: node.id,
        name: node.name,
        type: node.type,
        transform: node.transform,
        components: (node.components ?? []).map(component => ({
          type: component.type,
          properties: component,
          // The descriptor, so a model knows what it may WRITE without a second call.
          schema: isComponentType(component.type) ? descriptorOf(component.type).fields : [],
        })),
        relations: {
          parent: node.parentId ?? null,
          children: scene.nodes.filter(one => one.parentId === node.id).map(one => one.id),
        },
        available: {
          components: COMPONENT_TYPES.filter(
            type => !(node.components ?? []).some(one => one.type === type),
          ),
        },
      },
    }
  },

  'studio.docs': input => {
    const topic = (textOf(input, 'topic') ?? '').trim()
    if (topic.length === 0) {
      return { ok: true, data: { topics: [...COMPONENT_TYPES, 'script'] } }
    }
    // 🛑 The SAME text the editor types against, sliced — never a second telling of it, which is
    // the one that would drift from what the compiler enforces.
    if (topic === 'script') return { ok: true, data: { topic, docs: STUDIO_TYPES } }

    if (!isComponentType(topic)) {
      return refused('notFound', `no topic "${topic}" — ask with no topic for the list`)
    }
    const held = COMPONENTS[topic]
    return {
      ok: true,
      data: {
        topic,
        titleKey: held.titleKey,
        descriptionKey: held.descriptionKey,
        schema: held.fields,
      },
    }
  },
}

/** The id inside an `entity:<document>/<id>` reference — `nodeAimed` takes a bare one. */
const idOf = (named: string): string => named.split('/').at(-1) ?? named

/** What a batch was handed, refused before anything runs rather than halfway through it. */
export function batchRefusal(input: Record<string, unknown>): ActionOutcome | null {
  const calls = batchCalls(input)
  if (calls.length === 0) return refused('badInput', 'calls must be a JSON array of {action,input}')

  for (const call of calls) {
    if (!assistantAction(call.action)) return refused('badInput', `no action "${call.action}"`)
    if (call.action === 'studio.batch') return refused('badInput', 'a batch may not hold a batch')
  }
  return null
}
