import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import { DEFAULT_HOME_SECTIONS, visibleHomeSections } from '@shared/domain/home'
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
  useProject.setState({ project: null })
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
})

describe('the home', () => {
  it('says something on a studio with no key, no project and no history', () => {
    render(<HomeView />)

    // The two things left to do, and the six ways in — never a blank page.
    expect(screen.getByText('Démarrer un projet')).toBeInTheDocument()
    expect(screen.getByText('Connecter une clé API')).toBeInTheDocument()
    expect(screen.getByText('Outils')).toBeInTheDocument()
    expect(screen.getByText('Vos projets')).toBeInTheDocument()
  })

  it('still fills the page when the user hid everything they are allowed to', () => {
    setSettings(DEFAULT_HOME_SECTIONS.map(section => ({ ...section, visible: false })))
    render(<HomeView />)

    expect(screen.getByText('Outils')).toBeInTheDocument()
    expect(screen.getByText('Vos projets')).toBeInTheDocument()
  })

  it('drops what needs a key rather than drawing it empty', () => {
    render(<HomeView />)

    expect(screen.queryByText('En cours')).not.toBeInTheDocument()
  })

  it('offers the documents of the project once one is open', () => {
    useProject.setState({ project: PROJECT })
    useDocuments.setState({
      documents: { a: POSTER_DOCUMENT },
      stored: [POSTER_DOCUMENT],
      activeId: 'a',
    })
    render(<HomeView />)

    expect(screen.getByText('Vos documents')).toBeInTheDocument()
    expect(screen.getByText('Poster')).toBeInTheDocument()
    expect(screen.getByText('Reprendre où vous en étiez')).toBeInTheDocument()
  })

  /**
   * The state a fresh project is in satisfies none of the spotlight's conditions — no document
   * to resume, no job running, a key already connected. Being pinned is a promise to draw
   * something, and this is the case that broke it.
   */
  it('still opens on a band when a key is connected and the project is empty', () => {
    setSettings(DEFAULT_HOME_SECTIONS, true)
    useProject.setState({ project: PROJECT })
    render(<HomeView />)

    expect(screen.getByText('Tout est prêt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer une image' })).toBeInTheDocument()
  })

  it('ends on a way forward rather than on the last shelf', () => {
    render(<HomeView />)

    expect(screen.getByText('Créer ou explorer. Un clic vers la suite.')).toBeInTheDocument()
  })
})

describe('customising the home', () => {
  /**
   * Every titled band carries the menu, pinned ones included: reordering is what all of them
   * can do, and only hiding is refused. The spotlight is the exception and stays one — it is
   * the page's opening banner, it has no heading to hang a menu from, and being moved out of
   * first place is not something an opening banner does.
   */
  it('carries a menu on every titled band', () => {
    render(<HomeView />)

    const titled = visibleHomeSections(DEFAULT_HOME_SECTIONS, {
      authenticated: false,
      hasProject: false,
    }).filter(id => id !== 'spotlight')

    expect(screen.getAllByRole('button', { name: 'Personnaliser cette section' })).toHaveLength(
      titled.length,
    )
  })

  it('says how many sections are hidden, and takes them back', async () => {
    setSettings(
      DEFAULT_HOME_SECTIONS.map(section =>
        section.id === 'documents' ? { ...section, visible: false } : section,
      ),
    )
    useProject.setState({ project: PROJECT })
    useDocuments.setState({ stored: [POSTER_DOCUMENT] })
    render(<HomeView />)

    expect(screen.queryByText('Vos documents')).not.toBeInTheDocument()
    expect(screen.getByText('1 section masquée')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Les réafficher' }))

    const written = useSettings.getState().settings.home.sections
    expect(written.find(section => section.id === 'documents')?.visible).toBe(true)
  })
})
