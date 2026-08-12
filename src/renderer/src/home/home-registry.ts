import type { FC } from 'react'
import type { HomeSectionId } from '@shared/domain/home'
import { Explore } from './sections/Explore'
import { Spotlight } from './sections/Spotlight'
import { Tools } from './sections/Tools'

/**
 * What draws each section. A `Record` rather than a list, so a section added to the shared
 * registry is a compile error here rather than a heading with nothing under it.
 */
export const HOME_COMPONENTS: Record<HomeSectionId, FC> = {
  spotlight: Spotlight,
  tools: Tools,
  explore: Explore,
}
