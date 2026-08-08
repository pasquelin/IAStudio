import { mdiFolderOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { RecentProject } from '@shared/domain/project'
import { Carousel } from '@/design/Carousel'
import { UiIcon } from '@/design/UiIcon'
import { FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { timeAgo } from '@/helpers/relative-time'
import { getBridge } from '@/services/bridge'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { Section } from '../Section'

const CARD_WIDTH = 220
const CARD_HEIGHT = 84

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

  const open = (project: Card): void => {
    void useProject
      .getState()
      .open(project.path)
      .then(opened => {
        if (opened) return
        // Gone from the disk. Dropped from the shelf rather than left to fail again — and
        // written through the settings, which is where the list lives.
        void getBridge()?.settings.write({
          storage: { recentProjects: recent.filter(entry => entry.path !== project.path) },
        })
      })
  }

  return (
    <Section id="projects" title={t('home.sections.projects')}>
      <Carousel
        items={cards}
        itemWidth={CARD_WIDTH}
        itemHeight={CARD_HEIGHT}
        label={t('home.sections.projects')}
        empty={<Empty />}
        renderCard={project => (
          <button
            type="button"
            onClick={() => open(project)}
            title={project.path}
            className={cn(
              'bg-surface hover:bg-elevated flex size-full cursor-pointer flex-col justify-center',
              'gap-1 rounded-(--radius-sc-md) border-none px-3 text-left transition-colors',
              FOCUS_RING,
            )}
          >
            <span className="flex items-center gap-2">
              <UiIcon path={mdiFolderOutline} size={16} className="text-muted shrink-0" />
              <span className="text-text truncate text-[12px]">{project.name}</span>
            </span>
            <span className="text-muted truncate text-[11px]">
              {timeAgo(project.openedAt, i18n.language) ?? project.path}
            </span>
          </button>
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
      onClick={() => void useProject.getState().createPicked()}
      className={cn(
        'border-border text-muted hover:border-accent hover:text-text flex cursor-pointer',
        'items-center justify-center gap-2 rounded-(--radius-sc-md) border border-dashed',
        'bg-transparent p-6 text-[12px] transition-colors',
        FOCUS_RING,
      )}
      style={{ height: CARD_HEIGHT }}
    >
      <UiIcon path={mdiFolderOutline} size={18} />
      {t('home.projects.none')}
    </button>
  )
}
