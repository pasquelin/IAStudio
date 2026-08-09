import { DEFAULT_HOME_SECTIONS } from '@shared/domain/home'
import type { Project } from '@shared/domain/project'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'

/** A project the studio has answered about, for the suites of every section. */
export const HOME_PROJECT: Project = {
  path: '/projects/summer',
  manifest: {
    version: 1,
    name: 'Summer',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
}

/**
 * A studio that has already answered, on the default order.
 *
 * The home says nothing before the main process has spoken — which is what `Spotlight.test` is
 * about, and what every other suite has to step past to reach the shelf it is testing.
 */
export function settleHome(project: Project | null = HOME_PROJECT): void {
  useSettings.setState(state => ({
    authKnown: true,
    settings: { ...state.settings, home: { enabled: true, sections: [...DEFAULT_HOME_SECTIONS] } },
  }))
  useProject.setState({ project, known: true })
}
