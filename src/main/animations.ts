import { orElse } from '@shared/promises'
import { readdir, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import {
  ANIMATION_EXTENSIONS,
  ANIMATION_THUMBNAIL,
  type BundledAnimation,
} from '@shared/domain/animationLibrary'
import { CHANNELS } from '@shared/ipc'
import { byCodeUnit } from '@shared/text'
import { handle } from '@main/ipc/handle'
import { assetFilePath } from '@main/assets/protocol'
import { bundledAnimations, resourcesRoot } from '@main/resources'

/**
 * The animations shipped beside the app, one folder each. A folder holding no clip is skipped
 * rather than shown empty: it would offer something no drag could produce.
 *
 * An absent directory answers nothing at all — the app ships without animations until someone
 * installs them, and that is a state to show, never an error to report.
 */
export async function bundledAnimationList(root: string): Promise<BundledAnimation[]> {
  const folders = await orElse(readdir(root, { withFileTypes: true }), [])
  const found: BundledAnimation[] = []

  for (const folder of folders) {
    if (!folder.isDirectory()) continue

    const inside: string[] = await orElse(readdir(join(root, folder.name)), [])
    if (!clipFileOf(inside)) continue

    found.push({ name: folder.name, thumbnail: inside.includes(ANIMATION_THUMBNAIL) })
  }

  return found.sort((left, right) => byCodeUnit(left.name, right.name))
}

/**
 * Which file the `animation` host hands over: the clip of a folder that is named alone, or the
 * exact file when the name goes deeper — which is how a thumbnail is asked for.
 *
 * Contained by `assetFilePath`, the same refusal the project's own scheme applies: the name comes
 * from a document, and a document is a file someone can edit.
 */
export async function bundledAnimationFile(root: string, id: string): Promise<string | null> {
  const inside = assetFilePath(root, id)
  if (!inside) return null

  const found = await orElse(stat(inside), null)
  if (!found) return null
  if (found.isFile()) return inside

  const clip = clipFileOf(await orElse(readdir(inside), []))
  return clip ? join(inside, clip) : null
}

/**
 * The one clip of a folder. Read the same way by both halves, since the list promises exactly
 * the file the host then serves — and sorted, so two files never answer by directory order.
 */
function clipFileOf(files: readonly string[]): string | undefined {
  return [...files]
    .sort(byCodeUnit)
    .find(file => ANIMATION_EXTENSIONS.includes(extname(file).toLowerCase()))
}

export function registerAnimationHandlers(): void {
  handle(CHANNELS.animationsList, () => bundledAnimationList(bundledAnimations(resourcesRoot())))
}
