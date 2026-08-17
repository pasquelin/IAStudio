import { useState } from 'react'
import { ErrorBoundary } from '@/design/ErrorBoundary'
import { ScrollHostProvider } from '@/design/ScrollHost'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { HOME_COMPONENTS } from '../home-registry'
import { useHomeSections } from '../use-home-sections'
import { HomeViewClosing } from './HomeViewClosing'

/**
 * The studio's entry point: what you were doing, what it can do, and what it is doing now.
 *
 * It owns the only scroll on the screen. That is a decision the sections depend on — a shelf
 * measures itself against this container, and the infinite grid the explore section will bring
 * has to hang off it rather than open a second scrollbar inside the first.
 */
export function HomeView() {
  const sections = useHomeSections()
  const projectKnown = useProject(state => state.known)
  const settingsLoaded = useSettings(state => state.loaded)
  // State and not a ref: what hangs off this scroller has to render again once it exists.
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)

  // Nothing at all until the main process has said which project is open and which sections this
  // person kept. Half the sections require a project, and the order is a setting: drawing first
  // lays out three default bands and then reflows into nine in someone else's order.
  //
  // Both waits are file reads. The key is a request, and is left to settle under the page.
  if (!projectKnown || !settingsLoaded) return <div className="h-full" />

  return (
    // Published rather than left to be found: the grid virtualizes against this scroll and the
    // sticky headings measure themselves from its top, and neither could say so.
    <ScrollHostProvider host={scroller}>
      <div ref={setScroller} className="h-full overflow-x-hidden overflow-y-auto">
        <div className="flex flex-col gap-8 px-6 py-6">
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
    </ScrollHostProvider>
  )
}
