import type { Component } from '@shared/domain/component'
import { newComponent } from '@shared/domain/componentRegistry'
import type { GameTemplate, TemplatePiece } from '@shared/domain/gameTemplate'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import type { Command } from '@/engines/core/history'
import { newId } from '@/helpers/ids'
import { meshNode } from './nodeFactory'
import type { SceneNode, SceneState } from './sceneState'

/**
 * A template, laid out in the scene in front — nodes and their components, nothing else.
 *
 * 🛑 ONE undo entry for the whole assembly: laying out four objects and getting them back one at
 * a time is not what a person means by « I did not want this template ».
 */
export function layOutTemplate(template: GameTemplate): Command<SceneState> {
  const nodes = template.pieces.map(nodeOf)
  const ids = new Set(nodes.map(node => node.id))
  let before: SceneState['world']['play'] | null = null

  return {
    id: `template:${template.id}:${nodes[0]?.id ?? 'empty'}`,
    apply: state => {
      before = state.world.play
      return {
        ...state,
        nodes: [...state.nodes, ...nodes],
        // How the scene is WATCHED and walked is half of what a template means: « third person »
        // with an orbit camera and no gravity is a template that does nothing.
        world: { ...state.world, play: template.play },
      }
    },
    revert: state => ({
      ...state,
      nodes: state.nodes.filter(node => !ids.has(node.id)),
      world: { ...state.world, play: before ?? state.world.play },
    }),
  }
}

/** One piece as a node: a box of that size, at that place, carrying what it is told to carry. */
function nodeOf(piece: TemplatePiece): SceneNode {
  const node = meshNode(
    { kind: 'box', width: piece.size.x, height: piece.size.y, depth: piece.size.z },
    {
      name: piece.name,
      transform: { ...IDENTITY_TRANSFORM, position: { ...piece.at } },
      castShadow: true,
    },
  )
  return { ...node, id: newId(), components: piece.components.map(componentOf) }
}

/** The component with the settings the template asked for, over the ones the registry declares. */
const componentOf = (asked: TemplatePiece['components'][number]): Component => ({
  ...newComponent(asked.type),
  ...asked.settings,
  type: asked.type,
})
