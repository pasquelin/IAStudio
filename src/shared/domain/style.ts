import type { MaterialSettings } from './texture'

/**
 * A way of reading a material, kept OUTSIDE any project — the same reasoning as
 * `domain/favorite.ts`, and for a closer reason still: a style has to apply to a texture it was
 * not saved from, which the next project is full of.
 *
 * It carries values and never a map. A map is an asset of one project's catalogue, named by an
 * id that means nothing in the next one, and copying the pixels instead would put hundreds of
 * megabytes in the user's data folder. The distinction that makes it work: **a style says how to
 * read the maps of the texture in front, not which maps to read.** A style that brought its own
 * channels would no longer apply to a texture — it would replace it.
 *
 * Nothing is dropped at save time, not even a value the current texture has no map to make use
 * of: `roughnessRange` remaps a map, `normalScale` needs a normal, and a style stripped of what
 * is inert today would be wrong the day the texture is completed.
 */
export type MaterialStyle = {
  id: string
  /** Generated when saved, renamed from the panel. Never unique — only the id is. */
  name: string
  createdAt: string
  values: MaterialSettings
}

/**
 * The first `<prefix> N` no style answers to.
 *
 * The prefix is handed in rather than written here: the word is user-facing, so it comes from
 * the bundle, and `shared/` reads no bundle.
 *
 * It fills gaps instead of counting the list. Counting would hand out a name a rename could
 * already be holding — saving twice after renaming the first would offer "Style 2" twice, and
 * two rows with one name in a panel one renames from is exactly the confusion to avoid.
 */
export function nextStyleName(styles: readonly MaterialStyle[], prefix: string): string {
  const taken = new Set(styles.map(style => style.name))

  let n = 1
  while (taken.has(`${prefix} ${n}`)) n += 1
  return `${prefix} ${n}`
}
