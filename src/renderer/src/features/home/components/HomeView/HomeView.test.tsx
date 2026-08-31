import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import {
  DEFAULT_HOME_SECTIONS,
  HOME_SECTION_IDS,
  homeSectionOf,
  type HomeSectionId,
} from '@shared/domain/home'
import { queryHost } from '@/features/shell/components/query-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { HomeView } from './HomeView'

const POSTER_DOCUMENT: DocumentDescriptor = {
  id: 'a',
  kind: 'image',
  title: 'Poster',
  workspace: 'image',
  path: 'documents/Poster.ora',
}

/** What each band's heading reads, so a drawn heading can be traced back to its entry. Keyed on
 * the union: a band added without a line here fails to compile. */
const SECTION_TITLES: Record<HomeSectionId, string> = {
  spotlight: 'Où vous en étiez',
  tools: 'Outils',
  models: 'Vos modèles',
  news: 'Ce qui bouge',
}

const PROJECT = {
  path: '/projects/Summer',
  manifest: {
    version: 1,
    name: 'Summer',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
}

function setSettings(home = DEFAULT_HOME_SECTIONS, authenticated = false): void {
  useSettings.setState(state => ({
    auth: authenticated ? { authenticated: true } : { authenticated: false, reason: 'missing' },
    // A studio that has already answered. The home says nothing before it has — see the
    // spotlight's own suite.
    authKnown: true,
    loaded: true,
    settings: {
      ...state.settings,
      home: { enabled: true, news: true, sections: [...home] },
      storage: { ...state.settings.storage, recentProjects: [] },
    },
  }))
}

beforeEach(() => {
  installFakeBridge()
  setSettings()
  useProject.setState({ project: null, known: true })
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
})

describe('the home', () => {
  it('says something on a studio with no key, no project and no history', () => {
    render(<HomeView />, { wrapper: queryHost() })

    // The one thing left to do — never a blank page. The ways in are the rails' now, and the
    // spotlight is what the centre still opens on.
    expect(screen.getByText('Connecter une clé API')).toBeInTheDocument()
  })

  it('still fills the page when the user hid everything they are allowed to', () => {
    setSettings(DEFAULT_HOME_SECTIONS.map(section => ({ ...section, visible: false })))
    render(<HomeView />, { wrapper: queryHost() })

    expect(screen.getByText('Connecter une clé API')).toBeInTheDocument()
  })

  /**
   * What the feed this band replaced could not do. It needed a key to draw a single tile, so the
   * home of a machine with none was two bands; the models band is at its most useful there,
   * since saying that nothing is set up yet is half of what it is for.
   */
  it('draws the models band on a studio with no key at all', () => {
    render(<HomeView />, { wrapper: queryHost() })

    expect(screen.getByText('Vos modèles')).toBeInTheDocument()
  })

  /**
   * And the band that reads somebody else's hub is the opposite case: nothing about it is worth a
   * heading on a studio that talks to nobody.
   */
  it('leaves out the news band on a studio with no key at all', () => {
    render(<HomeView />, { wrapper: queryHost() })

    expect(screen.queryByText('Ce qui bouge')).not.toBeInTheDocument()
  })

  it('points back at what was open, which is the one thing it still lists itself', () => {
    useProject.setState({ project: PROJECT, known: true })
    useDocuments.setState({
      documents: { a: POSTER_DOCUMENT },
      stored: [POSTER_DOCUMENT],
      activeId: 'a',
    })
    render(<HomeView />, { wrapper: queryHost() })

    expect(screen.getByText('Reprendre où vous en étiez')).toBeInTheDocument()
  })

  /**
   * The state a fresh project is in satisfies none of the spotlight's conditions — no document
   * to resume, no job running, a key already connected. Being pinned is a promise to draw
   * something, and this is the case that broke it.
   */
  it('still opens on a band when a key is connected and the project is empty', () => {
    setSettings(DEFAULT_HOME_SECTIONS, true)
    useProject.setState({ project: PROJECT, known: true })
    render(<HomeView />, { wrapper: queryHost() })

    expect(screen.getByText('Tout est prêt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer une image' })).toBeInTheDocument()
  })

  /**
   * Twelve bands became panels — six on 10 August, six on 11: the shell stands them in the home's
   * two columns, under rail icons like every other panel. Drawn here too, each would be the same
   * store read twice on one screen, with two behaviours to keep in step — which is what they were.
   *
   * Eleven of them, since 12 August: « Outils » came back to the centre, where it is read across
   * rather than stacked in a 320-pixel column. It is a band again, so it is not on this list.
   */
  it('draws none of the bands that became panels: the shell places those', () => {
    setSettings(DEFAULT_HOME_SECTIONS, true)
    useProject.setState({ project: PROJECT, known: true })
    useDocuments.setState({ stored: [POSTER_DOCUMENT] })
    render(<HomeView />, { wrapper: queryHost() })

    for (const title of [
      'Vos projets',
      'Ce que vous avez produit',
      'Par type',
      'Votre bibliothèque',
      'Vos documents',
      'Activité récente',
      'Explorateur',
      'Une idée pour commencer',
      'Vos recettes',
      'Dans la même veine',
      'Ce que vous avez consommé',
      'En cours',
    ]) {
      expect(screen.queryByText(title)).not.toBeInTheDocument()
    }
  })

  /**
   * Both waits are file reads, and both decide what the page holds: which project is open, and
   * which sections this person kept in which order. Drawing before either lays out one page and
   * then reflows it into another — the flicker this guard exists to stop.
   */
  it('draws nothing at all until it knows what it is drawing', () => {
    useProject.setState({ project: null, known: false })
    const { container, rerender } = render(<HomeView />, { wrapper: queryHost() })
    expect(container.textContent).toBe('')

    useProject.setState({ known: true })
    useSettings.setState({ loaded: false })
    rerender(<HomeView />)
    expect(container.textContent).toBe('')

    useSettings.setState({ loaded: true })
    rerender(<HomeView />)
    expect(screen.getByText('Connecter une clé API')).toBeInTheDocument()
  })

  it('ends on a way forward rather than on the last shelf', () => {
    render(<HomeView />, { wrapper: queryHost() })

    expect(screen.getByText('Créer ou explorer. Un clic vers la suite.')).toBeInTheDocument()
  })
})

describe('customising the home', () => {
  /**
   * A titled band carries the control when there is a gesture left to offer. The spotlight has no
   * heading to hang one from — it is the page's opening banner — and the feed keeps its own
   * because it can still be hidden.
   *
   * « Outils » is the third case, and the reason this walks the headings one by one rather than
   * counting them: it is titled AND pinned, so its heading offers nothing. A glyph that can only
   * refuse is worse than none — and whether a band is pinned is read off the registry here, as
   * `HideSection` reads it, so a fourth pinned band cannot pass by not being named « Outils ».
   */
  it('carries the hide button on every titled band that can still act', () => {
    setSettings(DEFAULT_HOME_SECTIONS, true)
    useProject.setState({ project: PROJECT, known: true })
    useDocuments.setState({ stored: [POSTER_DOCUMENT] })
    const { container } = render(<HomeView />, { wrapper: queryHost() })

    // Read off what is actually drawn, not off the registry: a section whose shelf is empty takes
    // itself off the page, and it must take its heading and its button with it.
    const headings = [...container.querySelectorAll('h2')]
    expect(headings.map(node => node.textContent)).toEqual([
      'Outils',
      'Vos modèles',
      'Ce qui bouge',
    ])

    for (const heading of headings) {
      const id = HOME_SECTION_IDS.find(
        candidate => SECTION_TITLES[candidate] === heading.textContent,
      )
      const header = heading.parentElement
      const hide = header && within(header).queryByRole('button', { name: 'Masquer cette section' })
      expect(Boolean(hide)).toBe(homeSectionOf(id)?.pinned !== true)
    }
  })

  it('says how many sections are hidden, and takes them back', async () => {
    setSettings(
      DEFAULT_HOME_SECTIONS.map(section => ({ ...section, visible: section.id !== 'models' })),
      true,
    )
    useProject.setState({ project: PROJECT, known: true })
    useDocuments.setState({ stored: [POSTER_DOCUMENT] })
    render(<HomeView />, { wrapper: queryHost() })

    expect(screen.queryByText('Vos modèles')).not.toBeInTheDocument()
    expect(screen.getByText('1 section masquée')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Les réafficher' }))

    const written = useSettings.getState().settings.home.sections
    expect(written.find(section => section.id === 'models')?.visible).toBe(true)
  })
})
