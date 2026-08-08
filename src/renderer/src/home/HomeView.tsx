import { useTranslation } from 'react-i18next'
import { Button } from '@/design/Button'
import { ErrorBoundary } from '@/design/ErrorBoundary'
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

  return (
    <div className="h-full overflow-x-hidden overflow-y-auto">
      {/* Bounded, and centred: shelves stretched across a 34" display stop being shelves. */}
      <div className="mx-auto flex max-w-[1400px] flex-col gap-8 px-6 py-6">
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
  )
}

/** The foot of the page: one sentence, two ways on. Nobody should reach the bottom and stop. */
function Closing() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <p className="text-muted m-0 text-center text-[12px]">{t('home.closing.title')}</p>
      <Button onClick={() => enterWorkspace(DEFAULT_WORKSPACE)}>{t('home.closing.action')}</Button>
    </div>
  )
}
