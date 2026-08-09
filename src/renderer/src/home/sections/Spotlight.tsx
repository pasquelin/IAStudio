import {
  mdiCreationOutline,
  mdiFolderPlusOutline,
  mdiKeyOutline,
  mdiPlayOutline,
  mdiProgressClock,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { DocumentDescriptor } from '@shared/domain/document'
import { isFinished } from '@shared/domain/job'
import { DEFAULT_WORKSPACE } from '@shared/domain/workspace'
import { Button } from '@/design/Button'
import { Carousel } from '@/design/Carousel'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { getBridge } from '@/services/bridge'
import { useDocuments, type DocumentsSlice } from '@/stores/documents'
import { useJobs } from '@/stores/jobs'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { openDocument } from '@/app/dockview-api'
import { enterWorkspace } from '../open'

/** Banner-sized, like the reference: two of them fill the band, three make it a shelf. */
const CARD_WIDTH = 560
const CARD_HEIGHT = 168

/** What a laid-down banner measures — held so its empty stand-in reserves the same room. */
const BANNER_HEIGHT = 76

type Slide = {
  id: string
  icon: string
  title: string
  body: string
  /** Absent on a card that only reports — the section under it is already the way there. */
  action?: { label: string; onClick: () => void }
  /** The one card the eye should land on first. Set once, on the first card that acts. */
  leading?: boolean
}

/**
 * The document "Resume" means. The tab in front when the studio was last on a workspace, and
 * the first one otherwise — the store keys its record in insertion order, which is the closest
 * thing to recency a `DocumentDescriptor` carries.
 */
function resumable(state: DocumentsSlice): DocumentDescriptor | undefined {
  const active = state.activeId ? state.documents[state.activeId] : undefined
  return active ?? Object.values(state.documents)[0]
}

/**
 * The band at the top of the home, built from what is actually true right now.
 *
 * Deliberately not an editorial carousel: banners of that kind need someone to write them, and
 * a studio that ships with three that never change is a studio whose first screen is stale on
 * the second launch. What a person wants at the top is where they left off, what is running,
 * and what is in their way.
 *
 * It never renders empty, which is why it is pinned — the last branch below is what holds that.
 */
export function Spotlight() {
  const { t } = useTranslation()
  const project = useProject(state => state.project)
  const projectKnown = useProject(state => state.known)
  const last = useDocuments(resumable)
  // The count, not the list: `apply` replaces the whole array on every progress event, and this
  // band only changes when a job starts or stops.
  const running = useJobs(state => state.jobs.filter(job => !isFinished(job.status)).length)
  const authenticated = useSettings(state => state.auth.authenticated)
  const authKnown = useSettings(state => state.authKnown)

  const slides: Slide[] = []

  if (project && last) {
    slides.push({
      id: 'resume',
      icon: mdiPlayOutline,
      title: t('home.spotlight.resume'),
      body: t('home.spotlight.resumeBody', { project: project.manifest.name, name: last.title }),
      action: {
        label: t('home.spotlight.resumeAction'),
        onClick: () => openDocument(last),
      },
    })
  }

  if (running > 0) {
    slides.push({
      id: 'running',
      icon: mdiProgressClock,
      title: t('home.spotlight.running', { count: running }),
      body: t('home.spotlight.runningBody'),
    })
  }

  if (authKnown && !authenticated) {
    slides.push({
      id: 'credentials',
      icon: mdiKeyOutline,
      title: t('home.spotlight.connect'),
      body: t('home.spotlight.connectBody'),
      action: {
        label: t('home.spotlight.connectAction'),
        onClick: () => void getBridge()?.settings.open('account'),
      },
    })
  }

  if (projectKnown && !project) {
    slides.push({
      id: 'create',
      icon: mdiFolderPlusOutline,
      title: t('home.spotlight.start'),
      body: t('home.spotlight.startBody'),
      action: {
        label: t('home.spotlight.startAction'),
        onClick: () => void useProject.getState().createPicked(),
      },
    })
  }

  // Every branch above is conditional, and a project open with nothing in it yet satisfies none
  // of them. Being pinned is a promise to draw something: without this, the home would open on
  // its second band, and the one state a fresh project is in would be the one with no heading.
  if (slides.length === 0) {
    // Except at launch, where "nothing is true" and "nothing is known yet" look the same from
    // here. Naming a state now would name the wrong one and take it back a moment later — which
    // is what made this band flicker through three readings while the window was still opening.
    if (!authKnown || !projectKnown) return <Waiting />

    slides.push({
      id: 'ready',
      icon: mdiCreationOutline,
      title: t('home.spotlight.ready'),
      body: t('home.spotlight.readyBody', { project: project?.manifest.name ?? '' }),
      action: {
        label: t('home.spotlight.readyAction'),
        onClick: () => enterWorkspace(DEFAULT_WORKSPACE),
      },
    })
  }

  // Read off the list rather than set at four push sites: the first card that offers something
  // to do is the one worth the accent, and "running" is the only card that offers nothing.
  const leading = slides.find(slide => slide.action !== undefined)
  if (leading) leading.leading = true

  // A lone banner has no rail to be scrolled along, and a 560 px card marooned in a 1400 px band
  // reads as a leftover rather than as the top of the page. It takes the width instead, and lies
  // down: a full-width card as tall as a stacked one is mostly empty.
  if (slides.length === 1 && slides[0]) return <Card slide={slides[0]} layout="banner" />

  return (
    <Carousel
      items={slides}
      itemWidth={CARD_WIDTH}
      itemHeight={CARD_HEIGHT}
      label={t('home.sections.spotlight')}
      renderCard={slide => <Card slide={slide} layout="stacked" />}
    />
  )
}

/**
 * The band before it knows what it holds. Silent, and exactly the height of the banner that
 * replaces it: a message appearing at the top of the page would push everything under it down,
 * which is the other half of what made the opening feel unsettled.
 */
function Waiting() {
  return (
    <div
      aria-hidden
      className="bg-surface rounded-(--radius-sc-lg)"
      style={{ height: BANNER_HEIGHT }}
    />
  )
}

/**
 * One card of the band. Laid on its side when it is alone and takes the width, stacked when it
 * shares a rail — the same four things either way, which is why it is one component.
 *
 * The leading card carries the studio's create colour, and nothing else on the home does: one
 * accent, on the one thing worth doing first.
 */
function Card({ slide, layout }: { slide: Slide; layout: 'banner' | 'stacked' }) {
  const banner = layout === 'banner'

  return (
    <article
      className={cn(
        'flex overflow-hidden rounded-(--radius-sc-lg) p-4',
        banner ? 'items-center gap-4' : 'size-full flex-col items-start gap-2',
        slide.leading ? 'bg-create/15 border-create/40 border' : 'bg-surface',
      )}
    >
      <UiIcon
        path={slide.icon}
        size={banner ? 20 : 16}
        className={cn('shrink-0', slide.leading ? 'text-create' : 'text-muted')}
      />

      {/* `contents` rather than a second flex column when stacked: the heading and the body are
          then the card's own children, spaced by its gap like the button under them. */}
      <span className={banner ? 'flex min-w-0 flex-1 flex-col gap-2' : 'contents'}>
        <h3 className="text-text m-0 text-[13px] font-semibold">{slide.title}</h3>
        {/* Bounded, and the button is not: a body long enough to push the action out of the
            card would leave the one thing to click off screen. */}
        <p
          className={cn(
            'text-muted m-0 overflow-hidden text-[11px] leading-relaxed',
            banner ? 'max-w-[80ch]' : 'max-w-[64ch] flex-1',
          )}
        >
          {slide.body}
        </p>
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
