import { hostedUrl } from './asset'

/**
 * An animation the app ships with: one folder under `resources/animations`, named after the
 * animation, holding the clip and — when someone has drawn one — a `thumb.png` beside it.
 *
 * A folder rather than a loose file so a thumbnail has somewhere to live, and so the NAME comes
 * from the folder rather than from inside the clip: a Tripo rig calls its only clip `NlaTrack`
 * and Uthana's carries no name at all, so what the file spells must never reach the screen.
 */
export type BundledAnimation = {
  /** The folder's name, which is what the studio shows and what a block is labelled with. */
  name: string
  /** Whether the folder holds a `thumb.png`. No path: the window reads both over the scheme. */
  thumbnail: boolean
}

/** The clip files an animation folder may hold, lowercase and with their dot. */
export const ANIMATION_EXTENSIONS: readonly string[] = ['.glb', '.gltf', '.fbx']

/** The still a folder may hold beside its clip, under this name and no other. */
export const ANIMATION_THUMBNAIL = 'thumb.png'

/**
 * The host that serves what ships beside the app rather than what a project owns — the animations
 * are common to every project, and no catalogue has ever heard of them.
 */
export const ANIMATION_HOST = 'animation'

/** Where the window reads a shipped clip from. The folder is named; which file is inside is not. */
export function bundledAnimationUrl(name: string): string {
  return hostedUrl(ANIMATION_HOST, name)
}
