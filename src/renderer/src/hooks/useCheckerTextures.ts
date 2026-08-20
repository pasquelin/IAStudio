import { useEffect } from 'react'
import { ensureCheckerTextures } from '@/engines/scene/checkerTextures'
import { useProject } from '@/stores/project'

/**
 * Puts the shipped working textures into the open project, and remembers what they became.
 *
 * Mounted by the 3D space rather than by the studio: a project one only ever paints in has no
 * business gaining four texture assets. It covers the Add menu, whose hand is slower than any
 * install; the door that CREATES a document awaits the same call for itself, since a template
 * lays its shapes down before this — or any other editor — has mounted.
 */
export function useCheckerTextures(): void {
  const path = useProject(state => state.project?.path ?? '')

  useEffect(() => {
    void ensureCheckerTextures(path)
  }, [path])
}
