import { mdiFolderOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { RecentProject } from '@shared/domain/project'
import { Carousel } from '@/design/Carousel'
import { UiIcon } from '@/design/UiIcon'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { timeAgo } from '@/helpers/relative-time'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { Section } from '../Section'
import { ShelfCard, SHELF_CARD_HEIGHT } from '../ShelfCard'
import { HINT_TOP } from '@/helpers/tooltip'

const CARD_WIDTH = 220

/** A recent project needs an `id` to be carried by the carousel; its folder is already one. */
type Card = RecentProject & { id: string }

/**
 * The projects this studio has opened, newest first.
 *
 * Pinned, and read straight from the settings: the list travels with `lastProject` and every
 * window already holds it, so the shelf that makes the home an entry point costs no request and
 * works with no key.
 */
export function Projects() {
  const { t, i18n } = useTranslation()
  const recent = useSettings(state => state.settings.storage.recentProjects)

  const cards: Card[] = recent.map(entry => ({ ...entry, id: entry.path }))

  return (
    <Section id="projects" title={t('home.sections.projects')}>
      <Carousel
        items={cards}
        itemWidth={CARD_WIDTH}
        itemHeight={SHELF_CARD_HEIGHT}
        label={t('home.sections.projects')}
        empty={<Empty />}
        renderCard={project => (
          <ShelfCard
            icon={mdiFolderOutline}
            title={project.name}
            // The path when the date is unreadable — a hand-edited settings file reaches here.
            subtitle={timeAgo(project.openedAt, i18n.language) ?? project.path}
            hint={project.path}
            // A folder gone from the disk drops out of the shelf on its own: the store forgets
            // it wherever an opening fails, not only where it was clicked.
            onClick={() => void useProject.getState().open(project.path)}
          />
        )}
      />
    </Section>
  )
}

/**
 * The one screen a first launch actually shows. It says what to do rather than that there is
 * nothing — a studio with no project yet is a studio about to have one.
 */
function Empty() {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      {...HINT_TOP(t('home.createProjectHint'))}
      onClick={() => void useProject.getState().createPicked()}
      className={cn(
        'border-border text-muted hover:border-accent hover:text-text flex cursor-pointer',
        'items-center justify-center gap-2 rounded-(--radius-sc-md) border border-dashed',
        'bg-transparent p-6 text-[12px] transition-colors',
        FOCUS_RING,
      )}
      style={{ height: SHELF_CARD_HEIGHT }}
    >
      <UiIcon path={mdiFolderOutline} size={18} />
      {t('home.projects.none')}
    </button>
  )
}
