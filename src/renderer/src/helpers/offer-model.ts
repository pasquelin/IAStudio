import type { ModelFamily } from '@shared/domain/model'
import { sectionOfFamily } from '@shared/domain/settings-registry'
import { HOME_SURFACE } from '@shared/domain/tool'
import { revealTool } from '@/helpers/reveal-panel'
import { workspaceById } from '@/helpers/workspaces'
import { toolSurface } from '@/stores/layouts'
import { useSettings } from '@/stores/settings'

/**
 * Takes the user where a model of this family is chosen — never choosing one for them. The one
 * answer to that question, so two callers cannot send the user to two different screens.
 *
 * A space browses its own family and no other, so a cutout model would never appear in its
 * browser however long one looked: those are set in the preferences, and nowhere else. The home
 * browses nothing at all, which lands in the same place.
 *
 * Its own file rather than beside `revealTool`, and the opening chunk is why: reaching the
 * preferences means reaching `settings-registry`, which a guard keeps out of what the splash
 * screen waits for (`eager-graph`). Its caller is a space, loaded on demand.
 */
export function offerModelsOfFamily(family: ModelFamily): void {
  const surface = toolSurface()
  const browsed = surface === HOME_SURFACE ? null : workspaceById(surface).family

  if (browsed === family) return revealTool('models')

  const section = sectionOfFamily(family)
  if (section) useSettings.getState().openSection(section)
}
