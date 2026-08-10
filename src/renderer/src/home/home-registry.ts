import type { FC } from 'react'
import type { HomeSectionId } from '@shared/domain/home'
import { Explore } from './sections/Explore'
import { Favorites } from './sections/Favorites'
import { Jobs } from './sections/Jobs'
import { Similar } from './sections/Similar'
import { Spark } from './sections/Spark'
import { Spotlight } from './sections/Spotlight'
import { Tools } from './sections/Tools'
import { Usage } from './sections/Usage'

/**
 * What draws each section. A `Record` rather than a list, so a section added to the shared
 * registry is a compile error here rather than a heading with nothing under it.
 */
export const HOME_COMPONENTS: Record<HomeSectionId, FC> = {
  spotlight: Spotlight,
  tools: Tools,
  favorites: Favorites,
  jobs: Jobs,
  similar: Similar,
  spark: Spark,
  usage: Usage,
  explore: Explore,
}
