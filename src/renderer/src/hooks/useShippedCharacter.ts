import { useEffect } from 'react'
import { ensureShippedCharacter } from '@/engines/scene/shippedCharacter'
import { useProject } from '@/stores/project'

/**
 * Puts the shipped character into the open project, and remembers what it became.
 *
 * Mounted by the 3D space rather than by the studio, as the working textures are: a project one
 * only ever paints in has no business gaining a two-megabyte mesh. It covers the Add menu, whose
 * hand is slower than any install; the door that CREATES a document awaits the same call for
 * itself, since a template lays its modules down before this — or any other editor — has mounted.
 */
export function useShippedCharacter(): void {
  const path = useProject(state => state.project?.path ?? '')

  useEffect(() => {
    void ensureShippedCharacter(path)
  }, [path])
}
