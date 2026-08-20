import { hostedUrl } from './asset'

/**
 * What a scene document opens on. Shared because the choice crosses the boundary twice: the
 * window that names a document answers with one, and the main process serves its thumbnail.
 *
 * A template is CODE, never a file to fetch: each one is a `SceneState` built by
 * `engines/scene/sceneTemplates`, so a studio with no network opens every one of them.
 */
export type SceneTemplateId =
  | 'empty'
  | 'basic'
  | 'photoStudio'
  | 'cinematic'
  | 'archvis'
  | 'firstPerson'
  | 'thirdPerson'
  | 'topDown'

/**
 * Which shelf a template is drawn on. The three character ones differ from the five above by
 * what the camera is FOR, not by what the scene holds, and a flat list of eight hides that.
 */
export type SceneTemplateGroup = 'general' | 'character'

export const SCENE_TEMPLATE_GROUPS: readonly SceneTemplateGroup[] = ['general', 'character']

/** Ordered, and the order is what the window draws: `Record` makes a new id a compile error. */
export const TEMPLATES_BY_GROUP: Record<SceneTemplateGroup, readonly SceneTemplateId[]> = {
  general: ['empty', 'basic', 'photoStudio', 'cinematic', 'archvis'],
  character: ['firstPerson', 'thirdPerson', 'topDown'],
}

export const SCENE_TEMPLATE_IDS: readonly SceneTemplateId[] = SCENE_TEMPLATE_GROUPS.flatMap(
  group => TEMPLATES_BY_GROUP[group],
)

/**
 * What a new scene takes when nobody picks — lit, floored and framed. `empty` would open on a
 * document one has to furnish before seeing anything, which is a first launch nobody asks for.
 */
export const DEFAULT_SCENE_TEMPLATE: SceneTemplateId = 'basic'

export function isSceneTemplateId(value: unknown): value is SceneTemplateId {
  return SCENE_TEMPLATE_IDS.some(id => id === value)
}

/**
 * The host that serves the still drawn of each template — shipped beside the app under
 * `resources/templates`, like the animations are, and common to every project.
 */
export const TEMPLATE_HOST = 'template'

/** Where the window reads a template's still from. The file is named after the template. */
export function templateThumbnailUrl(id: SceneTemplateId): string {
  return hostedUrl(TEMPLATE_HOST, `${id}.png`)
}
