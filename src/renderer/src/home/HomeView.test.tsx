import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import { DEFAULT_HOME_SECTIONS } from '@shared/domain/home'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { HomeView } from './HomeView'

const POSTER_DOCUMENT: DocumentDescriptor = {
  id: 'a',
  kind: 'image',
  title: 'Poster',
  workspace: 'image',
}

const PROJECT = {
  path: '/projects/summer',
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
      home: { enabled: true, sections: [...home] },
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
    render(<HomeView />)

    // The one thing left to do — never a blank page. The ways in are the rails' now, and the
    // spotlight is what the centre still opens on.
    expect(screen.getByText('Connecter une clé API')).toBeInTheDocument()
  })

  it('still fills the page when the user hid everything they are allowed to', () => {
    setSettings(DEFAULT_HOME_SECTIONS.map(section => ({ ...section, visible: false })))
    render(<HomeView />)

    expect(screen.getByText('Connecter une clé API')).toBeInTheDocument()
  })

  it('drops what needs a key rather than drawing it empty', () => {
    render(<HomeView />)

    expect(screen.queryByText('Explorer')).not.toBeInTheDocument()
  })

  it('points back at what was open, which is the one thing it still lists itself', () => {
    useProject.setState({ project: PROJECT, known: true })
    useDocuments.setState({
      documents: { a: POSTER_DOCUMENT },
      stored: [POSTER_DOCUMENT],
      activeId: 'a',
    })
    render(<HomeView />)

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
    render(<HomeView />)

    expect(screen.getByText('Tout est prêt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer une image' })).toBeInTheDocument()
  })

  /**
   * Twelve bands became panels — six on 10 August, six on 11: the shell stands them in the home's
   * two columns, under rail icons like every other panel. Drawn here too, each would be the same
   * store read twice on one screen, with two behaviours to keep in step — which is what they were.
   */
  it('draws none of the bands that became panels: the shell places those', () => {
    setSettings(DEFAULT_HOME_SECTIONS, true)
    useProject.setState({ project: PROJECT, known: true })
    useDocuments.setState({ stored: [POSTER_DOCUMENT] })
    render(<HomeView />)

    for (const title of [
      'Vos projets',
      'Ce que vous avez produit',
      'Par type',
      'Votre bibliothèque',
      'Vos documents',
      'Activité récente',
      'Explorateur',
      'Outils',
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
    const { container, rerender } = render(<HomeView />)
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
    render(<HomeView />)

    expect(screen.getByText('Créer ou explorer. Un clic vers la suite.')).toBeInTheDocument()
  })
})

describe('customising the home', () => {
  /**
   * A titled band carries the menu when the menu has something to offer. The spotlight has no
   * heading to hang one from — it is the page's opening banner — and the feed, which cannot be
   * moved either, keeps its own because it can still be hidden.
   */
  it('carries a menu on every titled band that can still act', () => {
    setSettings(DEFAULT_HOME_SECTIONS, true)
    useProject.setState({ project: PROJECT, known: true })
    useDocuments.setState({ stored: [POSTER_DOCUMENT] })
    const { container } = render(<HomeView />)

    // Counted off what is actually drawn, not off the registry: a section whose shelf is empty
    // takes itself off the page, and it must take its heading and its menu with it.
    const headings = container.querySelectorAll('h2')
    expect(headings.length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Personnaliser cette section' })).toHaveLength(
      headings.length,
    )
  })

  it('says how many sections are hidden, and takes them back', async () => {
    setSettings(
      DEFAULT_HOME_SECTIONS.map(section => ({ ...section, visible: section.id !== 'explore' })),
      true,
    )
    useProject.setState({ project: PROJECT, known: true })
    useDocuments.setState({ stored: [POSTER_DOCUMENT] })
    render(<HomeView />)

    expect(screen.queryByText('Explorer')).not.toBeInTheDocument()
    expect(screen.getByText('1 section masquée')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Les réafficher' }))

    const written = useSettings.getState().settings.home.sections
    expect(written.find(section => section.id === 'explore')?.visible).toBe(true)
  })
})
