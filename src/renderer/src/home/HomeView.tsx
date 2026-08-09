import { useTranslation } from 'react-i18next'
import {
  hiddenHomeSections,
  homePlaceOf,
  homeSections,
  shownHomeSection,
  type HomeSectionId,
} from '@shared/domain/home'
import { Button } from '@/design/Button'
import { ErrorBoundary } from '@/design/ErrorBoundary'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { DEFAULT_WORKSPACE } from '@shared/domain/workspace'
import { HOME_COMPONENTS } from './home-registry'
import { enterWorkspace } from './open'
import { useHomeSections } from './use-home-sections'

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

  // Nothing at all until the main process has said which project is open, if any. Half the
  // sections require one, so drawing before the answer lays out a page of three bands and then
  // reflows it into nine — the aside appearing alone moves the whole column 264 px sideways.
  // The wait is a file read; the key, which is a request, is left to settle under the page.
  if (!projectKnown) return <div className="h-full" />

  const aside = sections.filter(id => homePlaceOf(id) === 'aside')
  const main = sections.filter(id => homePlaceOf(id) !== 'aside')

  return (
    <div className="h-full overflow-x-hidden overflow-y-auto">
      {/* Bounded, and centred: shelves stretched across a 34" display stop being shelves. */}
      <div className="mx-auto flex max-w-[1400px] gap-6 px-6 py-6">
        {/* Withdrawn on a narrow window rather than stacked above the page: a rail one keeps an
            eye on is not worth the first screenful when there is no room to put it beside. */}
        {aside.length > 0 && (
          <aside
            className={cn(
              'sticky top-0 hidden w-[240px] shrink-0 flex-col gap-8 self-start lg:flex',
              // Bounded and scrollable from the start: a sticky column taller than the window
              // hides its own foot, and nothing about the page's scroll can bring it back.
              'max-h-[calc(100vh-3rem)] overflow-y-auto',
            )}
          >
            <Column ids={aside} />
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <Column ids={main} />
          <Closing />
        </div>
      </div>
    </div>
  )
}

function Column({ ids }: { ids: readonly HomeSectionId[] }) {
  return ids.map(id => {
    const Section = HOME_COMPONENTS[id]
    return (
      // Per section: a shelf that throws takes itself off the home, not the home with it.
      <ErrorBoundary key={id}>
        <Section />
      </ErrorBoundary>
    )
  })
}

/** The foot of the page: one sentence, two ways on. Nobody should reach the bottom and stop. */
function Closing() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <p className="text-muted m-0 text-center text-[12px]">{t('home.closing.title')}</p>
      <Button onClick={() => enterWorkspace(DEFAULT_WORKSPACE)}>{t('home.closing.action')}</Button>
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
    <p className="text-muted m-0 flex items-center gap-2 text-[11px]">
      {t('home.hidden', { count: hidden.length })}
      <button
        type="button"
        onClick={restore}
        className={cn(
          'text-accent cursor-pointer rounded-(--radius-sc-sm) border-none bg-transparent',
          'p-0 text-[11px] underline',
          FOCUS_RING,
        )}
      >
        {t('home.restore')}
      </button>
    </p>
  )
}
