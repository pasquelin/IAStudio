import { useEffect } from 'react'
import { forgetCheckerTextures, rememberCheckerTextures } from '@/engines/scene/checkerTextures'
import { getBridge } from '@/services/bridge'
import { useProject } from '@/stores/project'

/** The install in flight, by project — so ten open scenes ask the main process once. */
let running: { path: string; work: Promise<void> } | null = null

function install(path: string): Promise<void> {
  if (running?.path === path) return running.work

  const work = (getBridge()?.assets.installBundledTextures() ?? Promise.resolve([]))
    .then(rememberCheckerTextures)
    // Silent on purpose: a project whose textures cannot be written gives plain primitives,
    // which is a legitimate state — see `checkerTextures`.
    .catch(() => forgetCheckerTextures())

  running = { path, work }
  return work
}

/**
 * Puts the shipped working textures into the open project, and remembers what they became.
 *
 * Mounted by the 3D space rather than by the studio: a project one only ever paints in has no
 * business gaining four texture assets. It runs long before a hand reaches the Add menu, which
 * is what lets `createNodeOf` stay synchronous.
 */
export function useCheckerTextures(): void {
  const path = useProject(state => state.project?.path ?? '')

  useEffect(() => {
    if (path === '') {
      forgetCheckerTextures()
      running = null
      return
    }

    void install(path)
  }, [path])
}
