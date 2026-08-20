import { stat } from 'node:fs/promises'
import { assetFilePath } from '@main/assets/protocol'

/**
 * The still drawn of a scene template, shipped beside the app under `resources/templates`.
 *
 * Common to every project, like the animations are, and served on a host of its own: no
 * catalogue has ever heard of it. A template whose picture has not been drawn yet answers
 * nothing, and the window falls back to the glyph — which is why this never throws.
 */
export async function bundledTemplateFile(root: string, file: string): Promise<string | null> {
  // Refuses whatever walks out of the folder, exactly as a project's own files are refused.
  const inside = assetFilePath(root, file)
  if (!inside) return null

  const found = await stat(inside).catch(() => null)
  return found?.isFile() ? inside : null
}
