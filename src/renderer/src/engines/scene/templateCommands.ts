import type { SceneTemplateId } from '@shared/domain/sceneTemplate'
import { composed, type Command } from '@/engines/core/history'
import { addNodes, setWorld } from './commands'
import { sceneFromTemplate } from './sceneTemplates'
import type { SceneState } from './sceneState'

/**
 * A template, laid out in the scene in front — its objects, and how the scene is walked.
 *
 * 🛑 The SAME declaration « Nouveau document » builds from: two ways of asking for a third-person
 * game that disagreed on the hero and the floor would be two games under one name.
 *
 * `play` alone of the world: laying pieces into an open scene must not repaint its sky.
 */
export function layOutTemplate(id: SceneTemplateId): Command<SceneState> {
  const built = sceneFromTemplate(id)

  return composed(`template:${id}`, [addNodes(built.nodes), setWorld({ play: built.world.play })])
}
