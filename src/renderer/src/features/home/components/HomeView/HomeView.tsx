import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { HOME_COMPONENTS } from '../../homeRegistry'
import { useHomeSections } from '@/hooks/useHomeSections'
import { HomeViewClosing } from './HomeViewClosing'

/**
 * The studio's entry point: what you were doing, what it can do, and what it is doing now.
 *
 * It owns the only scroll on the screen, which the sections lay themselves out against rather
 * than opening a second scrollbar inside the first.
 */
export function HomeView() {
  const sections = useHomeSections()
  const projectKnown = useProject(state => state.known)
  const settingsLoaded = useSettings(state => state.loaded)

  // Nothing at all until the main process has said which project is open and which sections this
  // person kept. Half the sections require a project, and the order is a setting: drawing first
  // lays out three default bands and then reflows into nine in someone else's order.
  //
  // Both waits are file reads. The key is a request, and is left to settle under the page.
  if (!projectKnown || !settingsLoaded) return <div className="h-full" />

  return (
    <div className="h-full overflow-x-hidden overflow-y-auto">
      {/* Bounded by a gauge, and it is the whole page's readability: unbounded, a row's label
          sat at one edge of a wide display and its value at the other. */}
      <div className="mx-auto flex w-full max-w-(--sc-home-width) flex-col gap-8 px-6 py-6">
        {sections.map(id => {
          const Section = HOME_COMPONENTS[id]
          return (
            // Per section: a shelf that throws takes itself off the home, not the home with it.
            <ErrorBoundary key={id}>
              <Section />
            </ErrorBoundary>
          )
        })}
        <HomeViewClosing />
      </div>
    </div>
  )
}
