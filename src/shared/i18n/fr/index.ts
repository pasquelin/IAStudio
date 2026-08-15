import activity from './activity.json'
import assets from './assets.json'
import commands from './commands.json'
import common from './common.json'
import image from './image.json'
import inspector from './inspector.json'
import models from './models.json'
import scene from './scene.json'
import settings from './settings.json'
import shell from './shell.json'
import texture from './texture.json'
import usage from './usage.json'

/**
 * The source bundle, split by functional surface. One flat file was the most contested path of
 * the repository — nearly a fifth of the commits touched it — so two branches working on
 * different spaces used to collide on every merge.
 *
 * The sections are merged back into one object on purpose: the studio has a single namespace,
 * and every locale is type-checked against this shape. Splitting the storage must not split the
 * contract.
 */
export const fr = {
  ...activity,
  ...assets,
  ...commands,
  ...common,
  ...image,
  ...inspector,
  ...models,
  ...scene,
  ...settings,
  ...shell,
  ...texture,
  ...usage,
}

/** The shape every other locale must have, in full. Named here because `fr` defines it. */
export type Translations = typeof fr
