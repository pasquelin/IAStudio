import type { FC } from 'react'
import type { HomeSectionId } from '@shared/domain/home'
import { Activity } from './sections/Activity'
import { ByMode } from './sections/ByMode'
import { Creations } from './sections/Creations'
import { Documents } from './sections/Documents'
import { Explore } from './sections/Explore'
import { Favorites } from './sections/Favorites'
import { Jobs } from './sections/Jobs'
import { Library } from './sections/Library'
import { Projects } from './sections/Projects'
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
  projects: Projects,
  creations: Creations,
  byMode: ByMode,
  favorites: Favorites,
  library: Library,
  documents: Documents,
  jobs: Jobs,
  activity: Activity,
  usage: Usage,
  explore: Explore,
}
