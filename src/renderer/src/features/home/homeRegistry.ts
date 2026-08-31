import type { FC } from 'react'
import type { HomeSectionId } from '@shared/domain/home'
import { ModelInventory } from './components/ModelInventory/ModelInventory'
import { News } from './components/News/News'
import { Spotlight } from './components/Spotlight/Spotlight'
import { Tools } from './components/Tools/Tools'

/**
 * What draws each section. A `Record` rather than a list, so a section added to the shared
 * registry is a compile error here rather than a heading with nothing under it.
 */
export const HOME_COMPONENTS: Record<HomeSectionId, FC> = {
  spotlight: Spotlight,
  tools: Tools,
  models: ModelInventory,
  news: News,
}
