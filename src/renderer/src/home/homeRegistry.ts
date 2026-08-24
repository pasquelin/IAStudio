import type { FC } from 'react'
import type { HomeSectionId } from '@shared/domain/home'
import { ModelInventory } from './sections/ModelInventory/ModelInventory'
import { Spotlight } from './sections/Spotlight/Spotlight'
import { Tools } from './sections/Tools/Tools'

/**
 * What draws each section. A `Record` rather than a list, so a section added to the shared
 * registry is a compile error here rather than a heading with nothing under it.
 */
export const HOME_COMPONENTS: Record<HomeSectionId, FC> = {
  spotlight: Spotlight,
  tools: Tools,
  models: ModelInventory,
}
