import { render, screen } from '@testing-library/react'
import type { DocumentDescriptor } from '@shared/domain/document'
import { beforeEach, describe, expect, it } from 'vitest'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDocuments } from '@/stores/documents'
import { job } from '@/stores/job-fixtures'
import { useJobs } from '@/stores/jobs'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { Spotlight } from './Spotlight'

const DOCUMENT: DocumentDescriptor = {
  id: 'a',
  kind: 'image',
  title: 'Recette lot C',
  workspace: 'image',
  path: 'documents/Recette.ora',
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

/** The state the window is in for the first moments: nothing has answered yet. */
function opening(): void {
  useSettings.setState({ auth: { authenticated: false, reason: 'missing' }, authKnown: false })
  useProject.setState({ project: null, known: false })
}

beforeEach(() => {
  installFakeBridge()
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
  useJobs.setState({ jobs: [] })
  opening()
})

/**
 * What this suite is about: at launch the settings come off a file and the key is tried against
 * the API, so `authenticated` and `project` are both falsy for a moment while being unknown, not
 * absent. Read as answers they made the band announce a missing key and a missing project, then
 * withdraw both — three readings in the second it took the window to open.
 */
describe('the spotlight while the studio is still opening', () => {
  it('says nothing about a key nobody has tried yet', () => {
    render(<Spotlight />)

    expect(screen.queryByText('Connecter une clé API')).not.toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('holds the room the banner will take, so nothing shifts under the reader', () => {
    const { container } = render(<Spotlight />)

    expect(container.firstElementChild).toHaveStyle({ height: '76px' })
  })

  it('speaks up as soon as the key has been tried', () => {
    useSettings.setState({ authKnown: true })
    useProject.setState({ known: true })
    render(<Spotlight />)

    expect(screen.getByText('Connecter une clé API')).toBeInTheDocument()
  })

  /**
   * The project answers first, off a file, while the key is still being tried against the API.
   * "Ready when you are" is the card for having nothing else to say — and whether there is a
   * key is precisely something still to be said, so it waits rather than being replaced.
   */
  it('waits for both answers before concluding there is nothing to report', () => {
    useProject.setState({ project: PROJECT, known: true })
    const { container } = render(<Spotlight />)

    expect(screen.queryByText('Tout est prêt')).not.toBeInTheDocument()
    expect(container.firstElementChild).toHaveStyle({ height: '76px' })
  })

  /**
   * Seen on screen, which is the only place it shows: the body names the project, so with none
   * open the hole was filled with '' and the sentence lost its subject — "est ouvert et ne
   * contient encore rien", of nothing. Every guard was green: the hole WAS filled.
   */
  it('does not say a project is open when none is', () => {
    useSettings.setState({ auth: { authenticated: true }, authKnown: true })
    useProject.setState({ project: null, known: true })
    render(<Spotlight />)

    expect(
      screen.getByText(
        'Rien n’est encore ouvert. Choisissez un espace et créez-y la première pièce.',
      ),
    ).toBeInTheDocument()
  })

  /** What is already true is said at once: a running job does not wait on the key either. */
  it('reports what is true whatever else is still on its way', () => {
    useJobs.setState({
      jobs: [job({ targetId: 'flux_2', label: 'a boulder', progress: 0.4 })],
    })
    render(<Spotlight />)

    expect(screen.getByText('1 génération en cours')).toBeInTheDocument()
  })
})

/**
 * The mark belongs to the heading, not to the card: stamped on its own line above the title it
 * read as decoration, and pushed the sentence under it down a card whose height is fixed.
 */
describe('the card', () => {
  /**
   * A stacked card's height is fixed, so a body too long has to stop — mid-word is not a place.
   * The class is what this can read: jsdom lays nothing out, so no case here sees the ellipsis,
   * and no SHIPPED body reaches four lines. What does is a project or document name a person
   * chose, which is why the clamp is on the card rather than on the sentences.
   */
  it('carries the clamp on the body of a card that shares the band', () => {
    useSettings.setState({ authKnown: true })
    useProject.setState({ project: PROJECT, known: true })
    useDocuments.setState({ documents: { a: DOCUMENT }, stored: [DOCUMENT], activeId: 'a' })
    render(<Spotlight />)

    expect(screen.getByText(/Les modèles, la génération/)).toHaveClass('line-clamp-4')
  })

  it('sets the icon on the same line as the title', () => {
    useSettings.setState({ authKnown: true })
    useProject.setState({ known: true })
    render(<Spotlight />)

    const heading = screen.getByRole('heading', { name: 'Connecter une clé API' })
    expect(heading.parentElement?.querySelector('svg')).toBeInTheDocument()
  })
})
