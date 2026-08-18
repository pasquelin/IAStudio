import { readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { ANIMATION_EXTENSIONS, type BundledAnimation } from '@shared/domain/animationLibrary'
import { CHANNELS } from '@shared/ipc'
import { byCodeUnit } from '@shared/text'
import { handle } from '@main/ipc/handle'
import { bundledAnimations, resourcesRoot } from '@main/resources'

/**
 * The animations shipped beside the app, one folder each. A folder holding no clip is skipped
 * rather than shown empty: it would offer something no drag could produce.
 *
 * An absent directory answers nothing at all — the app ships without animations until someone
 * installs them, and that is a state to show, never an error to report.
 */
export async function bundledAnimationList(root: string): Promise<BundledAnimation[]> {
  const folders = await readdir(root, { withFileTypes: true }).catch(() => [])
  const found: BundledAnimation[] = []

  for (const folder of folders) {
    if (!folder.isDirectory()) continue

    const inside: string[] = await readdir(join(root, folder.name)).catch(() => [])
    const clip = inside.find(file => ANIMATION_EXTENSIONS.includes(extname(file).toLowerCase()))
    if (!clip) continue

    found.push({
      name: folder.name,
      path: join(root, folder.name, clip),
      thumbnail: inside.includes('thumb.png') ? join(root, folder.name, 'thumb.png') : null,
    })
  }

  return found.sort((left, right) => byCodeUnit(left.name, right.name))
}

export function registerAnimationHandlers(): void {
  handle(CHANNELS.animationsList, () => bundledAnimationList(bundledAnimations(resourcesRoot())))
}
