import { englishText } from '@shared/i18n'
import { refused, type ActionField } from '@shared/domain/assistant'
import { COMPONENTS, COMPONENT_TYPES, descriptorOf } from '@shared/domain/componentRegistry'
import { isComponentType } from '@shared/domain/componentRegistry'
import { refFromString } from '@shared/domain/ref'
import STUDIO_TYPES from '@game/api/studio.d.ts?raw'
import { mounted } from './sceneHandlers'
import type { ActionHandlers } from './actionHandler'
import { textOf } from './actionInputs'
import { nodeAimed } from './nodeAimed'

/** The handlers of `STUDIO_ACTIONS`, which says why there are three of them. */
export const STUDIO_HANDLERS: ActionHandlers = {
  'studio.describe': input => {
    const open = mounted()
    if (!open) return refused('wrongSurface')

    const named = textOf(input, 'ref') ?? ''
    const scene = open.state
    if (named.length === 0) {
      return {
        ok: true,
        data: {
          scene: open.documentId,
          nodes: scene.nodes.map(node => ({ id: node.id, name: node.name, type: node.type })),
          available: { components: COMPONENT_TYPES },
        },
      }
    }

    // 🛑 A reference naming ANOTHER document is refused rather than answered off the scene in
    // front: a confident answer about the wrong object is worse than no answer.
    const ref = refFromString(named)
    if (ref?.kind === 'entity' && ref.document !== open.documentId) {
      return refused('notFound', `"${named}" belongs to another document`)
    }
    const node = nodeAimed(scene, ref?.kind === 'entity' ? ref.id : named)
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
          fields: isComponentType(component.type)
            ? descriptorOf(component.type).fields.map(describeField)
            : [],
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
    // 🛑 Resolved, never the KEYS: an action whose trade is to document serves sentences, and
    // `mcpTools` already puts every description through `englishText` for the same reason.
    const held = COMPONENTS[topic]
    return {
      ok: true,
      data: {
        topic,
        title: englishText(held.titleKey),
        description: englishText(held.descriptionKey),
        fields: held.fields.map(describeField),
      },
    }
  },
}

/** One field as a model reads it: the label resolved, and the bounds it must respect. */
const describeField = (field: ActionField): Record<string, unknown> => ({
  key: field.key,
  kind: field.kind,
  label: englishText(field.labelKey),
  required: field.required,
  ...(field.options ? { options: field.options } : {}),
  ...(field.min === undefined ? {} : { min: field.min }),
  ...(field.max === undefined ? {} : { max: field.max }),
})
