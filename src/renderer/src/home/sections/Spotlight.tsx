import {
  mdiCreationOutline,
  mdiFolderPlusOutline,
  mdiKeyOutline,
  mdiPlayOutline,
  mdiProgressClock,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { isFinished } from '@shared/domain/job'
import { Carousel } from '@/design/Carousel'
import { Button } from '@/design/Button'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { getBridge } from '@/services/bridge'
import { useDocuments } from '@/stores/documents'
import { useJobs } from '@/stores/jobs'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { DEFAULT_WORKSPACE } from '@shared/domain/workspace'
import { enterWorkspace, openExistingDocument } from '../open'

/** Banner-sized, like the reference: two of them fill the band, three make it a shelf. */
const CARD_WIDTH = 560
const CARD_HEIGHT = 168

type Slide = {
  id: string
  icon: string
  title: string
  body: string
  /** Absent on a card that only reports — the section under it is already the way there. */
  action?: { label: string; onClick: () => void }
  /** The one card the eye should land on first. At most one is ever set. */
  leading?: boolean
}

/**
 * The band at the top of the home, built from what is actually true right now.
 *
 * Deliberately not an editorial carousel: banners of that kind need someone to write them, and
 * a studio that ships with three that never change is a studio whose first screen is stale on
 * the second launch. What a person wants at the top is where they left off, what is running,
 * and what is in their way.
 *
 * It never renders empty, which is why it is pinned: with no project and no key, the two cards
 * that remain are exactly the two things left to do.
 */
export function Spotlight() {
  const { t } = useTranslation()
  const project = useProject(state => state.project)
  const documents = useDocuments(state => state.documents)
  const jobs = useJobs(state => state.jobs)
  const authenticated = useSettings(state => state.auth.authenticated)

  const running = jobs.filter(job => !isFinished(job.status))
  const last = Object.values(documents)[0]
  const slides: Slide[] = []

  if (project && last) {
    slides.push({
      id: 'resume',
      icon: mdiPlayOutline,
      title: t('home.spotlight.resume'),
      body: t('home.spotlight.resumeBody', { project: project.manifest.name, name: last.title }),
      action: {
        label: t('home.spotlight.resumeAction'),
        onClick: () => openExistingDocument(last),
      },
      leading: true,
    })
  }

  if (running.length > 0) {
    slides.push({
      id: 'running',
      icon: mdiProgressClock,
      title: t('home.spotlight.running', { count: running.length }),
      body: t('home.spotlight.runningBody'),
    })
  }

  if (!authenticated) {
    slides.push({
      id: 'credentials',
      icon: mdiKeyOutline,
      title: t('home.spotlight.connect'),
      body: t('home.spotlight.connectBody'),
      action: {
        label: t('home.spotlight.connectAction'),
        onClick: () => void getBridge()?.settings.open('account'),
      },
      leading: slides.length === 0,
    })
  }

  if (!project) {
    slides.push({
      id: 'create',
      icon: mdiFolderPlusOutline,
      title: t('home.spotlight.start'),
      body: t('home.spotlight.startBody'),
      action: {
        label: t('home.spotlight.startAction'),
        onClick: () => void useProject.getState().createPicked(),
      },
      leading: slides.length === 0,
    })
  }

  // Everything above is conditional, and a project open with nothing in it yet satisfies none
  // of them. Being pinned is a promise to draw something: without this, the home would open on
  // its second band, and the one state a fresh project is in would be the one with no heading.
  if (slides.length === 0) {
    slides.push({
      id: 'ready',
      icon: mdiCreationOutline,
      title: t('home.spotlight.ready'),
      body: t('home.spotlight.readyBody', { project: project?.manifest.name ?? '' }),
      action: {
        label: t('home.spotlight.readyAction'),
        onClick: () => enterWorkspace(DEFAULT_WORKSPACE),
      },
      leading: true,
    })
  }

  // A lone banner has no rail to be scrolled along, and a 560 px card marooned in a 1400 px
  // band reads as a leftover rather than as the top of the page. It takes the width instead,
  // and lies down: a full-width card as tall as a stacked one is mostly empty.
  if (slides.length === 1 && slides[0]) return <Banner slide={slides[0]} />

  return (
    <Carousel
      items={slides}
      itemWidth={CARD_WIDTH}
      itemHeight={CARD_HEIGHT}
      label={t('home.sections.spotlight')}
      renderCard={slide => <Card slide={slide} />}
    />
  )
}

/** The same card laid on its side: text takes the width, the action sits at the far end. */
function Banner({ slide }: { slide: Slide }) {
  return (
    <article className={cn('flex items-center gap-4 rounded-(--radius-sc-lg) p-4', skinOf(slide))}>
      <UiIcon
        path={slide.icon}
        size={20}
        className={cn('shrink-0', slide.leading ? 'text-create' : 'text-muted')}
      />

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-text m-0 text-[13px] font-semibold">{slide.title}</h3>
        <p className="text-muted m-0 max-w-[80ch] text-[11px] leading-relaxed">{slide.body}</p>
      </span>

      {slide.action && (
        <span className="shrink-0">
          <Button variant={slide.leading ? 'primary' : 'neutral'} onClick={slide.action.onClick}>
            {slide.action.label}
          </Button>
        </span>
      )}
    </article>
  )
}

/**
 * The leading card carries the studio's create colour, and nothing else on the home does: one
 * accent, on the one thing worth doing first.
 */
function skinOf(slide: Slide): string {
  return slide.leading ? 'bg-create/15 border-create/40 border' : 'bg-surface'
}

function Card({ slide }: { slide: Slide }) {
  return (
    <article
      className={cn(
        'flex size-full flex-col items-start gap-2 overflow-hidden rounded-(--radius-sc-lg) p-4',
        skinOf(slide),
      )}
    >
      <span className="flex items-center gap-2">
        <UiIcon
          path={slide.icon}
          size={16}
          className={slide.leading ? 'text-create' : 'text-muted'}
        />
        <h3 className="text-text m-0 text-[13px] font-semibold">{slide.title}</h3>
      </span>

      {/* Bounded, and the button below is not: a body long enough to push the action out of the
          card would leave the one thing to click off screen. */}
      <p className="text-muted m-0 max-w-[64ch] flex-1 overflow-hidden text-[11px] leading-relaxed">
        {slide.body}
      </p>

      {slide.action && (
        <Button variant={slide.leading ? 'primary' : 'neutral'} onClick={slide.action.onClick}>
          {slide.action.label}
        </Button>
      )}
    </article>
  )
}
