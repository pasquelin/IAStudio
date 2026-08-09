import type { ModelFamily } from '@shared/domain/model'
import { sectionOfFamily } from '@shared/domain/settings-registry'
import { HOME_SURFACE } from '@shared/domain/tool'
import { setFacetValue } from '@/helpers/collection-state'
import { revealTool } from '@/helpers/reveal-panel'
import { workspaceById } from '@/helpers/workspaces'
import { FAMILY_FACET } from '@/panels/models/family-facet'
import { toolSurface } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'

/**
 * Takes the user where a model of this family is chosen — never choosing one for them. The one
 * answer to that question: an image edit reaching for an upscaler and a graph putting down a
 * generator both ask it, and two answers would send them to different screens.
 *
 * Which screen depends on the surface. One that browses every family shows the browser narrowed
 * to the one asked for — the facet is written here rather than at the call site, naming one
 * being the panel's own language. One that browses a family of its own can only ever list that
 * family, so a cutout model would never appear there however long one looked: those are set in
 * the preferences, and nowhere else.
 *
 * Its own file rather than beside `revealTool`, and the opening chunk is why: reaching the
 * preferences means reaching `settings-registry`, which a guard keeps out of what the splash
 * screen waits for (`eager-graph`). Both callers are spaces, loaded on demand.
 */
export function offerModelsOfFamily(family: ModelFamily): void {
  const surface = toolSurface()
  const browsed = surface === HOME_SURFACE ? null : workspaceById(surface).family

  if (browsed === null) {
    const { collection, setCollection } = useModels.getState()
    setCollection(setFacetValue(collection, FAMILY_FACET, family))
    return revealTool('models')
  }

  if (browsed === family) return revealTool('models')

  const section = sectionOfFamily(family)
  if (section) useSettings.getState().openSection(section)
}
