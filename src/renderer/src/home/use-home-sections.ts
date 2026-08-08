import { useMemo } from 'react'
import { visibleHomeSections, type HomeSectionId } from '@shared/domain/home'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'

/**
 * The sections to draw, in the user's order. The rules live in `domain/home.ts` — this only
 * says where the two answers it needs come from.
 */
export function useHomeSections(): readonly HomeSectionId[] {
  const stored = useSettings(state => state.settings.home.sections)
  const authenticated = useSettings(state => state.auth.authenticated)
  const hasProject = useProject(state => state.project !== null)

  return useMemo(
    () => visibleHomeSections(stored, { authenticated, hasProject }),
    [stored, authenticated, hasProject],
  )
}
