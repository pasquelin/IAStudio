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
  /** Absolute path of the clip file — `.glb`, `.gltf` or `.fbx`. */
  path: string
  /** Absolute path of `thumb.png`, or `null` when the folder holds none. */
  thumbnail: string | null
}

/** The clip files an animation folder may hold, lowercase and with their dot. */
export const ANIMATION_EXTENSIONS: readonly string[] = ['.glb', '.gltf', '.fbx']
