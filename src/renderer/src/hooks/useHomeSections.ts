import { useMemo } from 'react'
import { visibleHomeSections, type HomeSectionId } from '@shared/domain/home'
import { hasApi, useSettings } from '@/stores/settings'

/**
 * The sections to draw, in the user's order. The rules live in `domain/home.ts` — this only says
 * where the one answer it needs comes from.
 */
export function useHomeSections(): readonly HomeSectionId[] {
  const stored = useSettings(state => state.settings.home.sections)
  const api = useSettings(hasApi)

  return useMemo(() => visibleHomeSections(stored, api), [stored, api])
}
