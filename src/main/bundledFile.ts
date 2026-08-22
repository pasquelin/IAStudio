import { stat } from 'node:fs/promises'
import { assetFilePath } from '@main/assets/protocol'

/**
 * A file shipped beside the app — the still of a scene template, the picture of a model.
 *
 * Common to every project, so served on a host of its own: no catalogue has ever heard of one.
 * A picture nobody has drawn yet answers nothing and the window falls back to its glyph, which
 * is why this never throws.
 */
export async function bundledFile(root: string, file: string): Promise<string | null> {
  // Refuses whatever walks out of the folder, exactly as a project's own files are refused.
  const inside = assetFilePath(root, file)
  if (!inside) return null

  const found = await stat(inside).catch(() => null)
  return found?.isFile() ? inside : null
}
