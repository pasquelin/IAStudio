import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_HOME_SECTIONS } from '@shared/domain/home'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { HomeView } from './HomeView'

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
  useDocuments.setState({ documents: {} })
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
      documents: { a: { id: 'a', kind: 'image', title: 'Poster', workspace: 'image' } },
    })
    render(<HomeView />)

    expect(screen.getByText('Documents ouverts')).toBeInTheDocument()
    expect(screen.getByText('Poster')).toBeInTheDocument()
    expect(screen.getByText('Reprendre où vous en étiez')).toBeInTheDocument()
  })

  it('ends on a way forward rather than on the last shelf', () => {
    render(<HomeView />)

    expect(screen.getByText('Créer ou explorer. Un clic vers la suite.')).toBeInTheDocument()
  })
})
