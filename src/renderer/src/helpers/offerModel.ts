import type { ModelFamily } from '@shared/domain/model'
import { sectionOfFamily } from '@shared/domain/settingsRegistry'
import { revealTool } from '@/helpers/revealPanel'
import { familyOfSurface } from '@/helpers/workspaces'
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
 * preferences means reaching `settingsRegistry`, which a guard keeps out of what the splash
 * screen waits for (`eager-graph`). Its caller is a space, loaded on demand.
 */
export function offerModelsOfFamily(family: ModelFamily): void {
  if (familyOfSurface(toolSurface()) === family) return revealTool('models')

  const section = sectionOfFamily(family)
  if (section) useSettings.getState().openSection(section)
}
