import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { hiddenHomeSections, homeSections, shownHomeSection } from '@shared/domain/home'
import { Button } from '@/design/Button'
import { ErrorBoundary } from '@/design/ErrorBoundary'
import { ScrollHostProvider } from '@/design/ScrollHost'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { DEFAULT_WORKSPACE } from '@shared/domain/workspace'
import { HOME_COMPONENTS } from './home-registry'
import { QuietNote } from '@/design/QuietNote'
import { enterWorkspace } from './open'
import { useHomeSections } from './use-home-sections'
import { HINT_TOP } from '@/helpers/tooltip'

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
          <Closing />
        </div>
      </div>
    </ScrollHostProvider>
  )
}

/** The foot of the page: one sentence, two ways on. Nobody should reach the bottom and stop. */
function Closing() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <QuietNote standalone>{t('home.closing.title')}</QuietNote>
      <Button
        {...HINT_TOP(t('home.closingActionHint'))}
        onClick={() => enterWorkspace(DEFAULT_WORKSPACE)}
      >
        {t('home.closing.action')}
      </Button>
      <Hidden />
    </div>
  )
}

/**
 * The way back from hiding a section, offered where the sections are rather than in the
 * preferences: a control that removes something must say where it went, or the studio grows a
 * setting whose only symptom is a shelf that stopped appearing.
 */
function Hidden() {
  const { t } = useTranslation()
  const stored = useSettings(state => state.settings.home.sections)

  const hidden = hiddenHomeSections(stored)
  if (hidden.length === 0) return null

  const restore = (): void => {
    const sections = hidden.reduce(
      (all, id) => shownHomeSection(all, id, true),
      homeSections(stored),
    )
    void useSettings.getState().write({ home: { sections } })
  }

  return (
    <p className="text-muted text-tiny m-0 flex items-center gap-2">
      {t('home.hidden', { count: hidden.length })}
      <button
        type="button"
        {...HINT_TOP(t('home.restoreHint'))}
        onClick={restore}
        className={cn(
          'text-accent-ink cursor-pointer rounded-(--radius-sc-sm) border-none bg-transparent',
          'text-tiny p-0 underline',
          FOCUS_RING,
        )}
      >
        {t('home.restore')}
      </button>
    </p>
  )
}
