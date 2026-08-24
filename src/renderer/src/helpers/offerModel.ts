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
 * The generation panel when the space generates that family: its picker lists exactly what the
 * operation can be served by, and a model is picked there without leaving. Anything else is the
 * settings — a cutout model belongs to no space, and the home generates nothing at all.
 *
 * Its own file rather than beside `revealTool`, and the opening chunk is why: reaching the
 * preferences means reaching `settingsRegistry`, which a guard keeps out of what the splash
 * screen waits for (`eager-graph`). Its caller is a space, loaded on demand.
 */
export function offerModelsOfFamily(family: ModelFamily): void {
  if (familyOfSurface(toolSurface()) === family) {
    revealTool('generator')
    return
  }

  const section = sectionOfFamily(family)
  if (section) useSettings.getState().openSection(section)
}
