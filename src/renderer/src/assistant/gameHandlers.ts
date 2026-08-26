import { refused, type ActionOutcome } from '@shared/domain/assistant'
import type { ActionField } from '@shared/domain/assistantAction'
import type { ComponentType, JsonValue } from '@shared/domain/component'
import { descriptorOf, isComponentType } from '@shared/domain/componentRegistry'
import type { Command } from '@/engines/core/history'
import { attachComponent, detachComponent, setComponentField } from '@/engines/scene/commands'
import type { SceneNode, SceneState } from '@/engines/scene/sceneState'
import { activeSceneId, useDocuments } from '@/stores/documents'
import { sceneOf, useScenes } from '@/stores/scenes'
import type { ActionHandlers } from './actionHandler'
import { textOf } from './actionInputs'
import { nodeAimed } from './nodeAimed'

/**
 * What an object DOES while the game runs, driven from outside the window.
 *
 * Its own file from the first action, `sceneHandlers.ts` at 41,9 Ko being the warning: the game
 * families would double it, and nobody opens a file that size to add a component.
 */

/**
 * The node and the component type both named, in the scene in front. Every way of missing is told
 * apart — the surface, the object, the type — because one refusal for all three sent a model
 * repairing what was not broken.
 */
function aimed(
  input: Record<string, unknown>,
  build: (node: SceneNode, type: ComponentType) => Command<SceneState> | null,
): ActionOutcome {
  const documentId = activeSceneId(useDocuments.getState())
  if (documentId === null) return refused('wrongSurface')

  const named = textOf(input, 'nodeId') ?? ''
  const node = nodeAimed(sceneOf(useScenes.getState(), documentId), named)
  if (!node) return refused('notFound', `no node "${named}" in the scene in front, by id or name`)

  const type = textOf(input, 'type') ?? ''
  if (!isComponentType(type)) return refused('badInput', `no component type "${type}"`)

  const command = build(node, type)
  if (!command) return refused('badInput', `"${node.name}" has no such field on ${type}`)

  // 🛑 Told apart from a call that did nothing: a command the state refuses leaves the document
  // untouched, and answering `ok` is what sent a client re-sending the same call.
  if (command.refuses?.(sceneOf(useScenes.getState(), documentId))) {
    return refused('badInput', `"${node.name}" is already as asked`)
  }

  useScenes.getState().runCommand(documentId, command)
  return { ok: true }
}

/**
 * The text a client sent, read as the kind the descriptor declares. A client cannot type a
 * component's value — the fields differ by type — so it types a word and the registry says what
 * that word means here.
 */
function writable(field: ActionField, said: string): JsonValue | null {
  if (field.kind === 'boolean') return said === 'true' ? true : said === 'false' ? false : null
  if (field.kind !== 'number' && field.kind !== 'integer') return said

  const value = Number(said)
  return Number.isFinite(value) ? value : null
}

export const GAME_HANDLERS: ActionHandlers = {
  'component.attach': input => aimed(input, (node, type) => attachComponent(node.id, type)),

  'component.detach': input => aimed(input, (node, type) => detachComponent(node.id, type)),

  'component.set': input =>
    aimed(input, (node, type) => {
      const named = textOf(input, 'field') ?? ''
      // Refused rather than dropped: `withComponentField` alone would ignore a mistyped name and
      // let the call report success.
      const field = descriptorOf(type).fields.find(one => one.key === named)
      if (!field) return null

      const value = writable(field, textOf(input, 'value') ?? '')
      return value === null ? null : setComponentField(node.id, type, named, value)
    }),
}
