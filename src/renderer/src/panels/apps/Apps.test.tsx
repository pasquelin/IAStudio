import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Job } from '@shared/domain/job'
import { job as jobOf } from '@/stores/job-fixtures'
import type { WorkflowDescriptor, WorkflowSummary } from '@shared/domain/workflow'
import { withQueries } from '@/app/query-fixtures'
import { installFakeBridge } from '@/services/fake-bridge'
import { useJobs } from '@/stores/jobs'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { Apps } from './Apps'

function app(overrides: Partial<WorkflowSummary> = {}): WorkflowSummary {
  return {
    id: 'workflow_1',
    name: 'Background remover',
    description: 'Cuts the subject out',
    status: 'ready',
    privacy: 'public',
    tags: ['tool'],
    ...overrides,
  }
}

function descriptor(overrides: Partial<WorkflowDescriptor> = {}): WorkflowDescriptor {
  return {
    ...app(),
    fields: [{ key: 'image', kind: 'text', label: 'Image', required: false }],
    ...overrides,
  }
}

function renderPanel() {
  return render(withQueries(<Apps />))
}

describe('Apps panel', () => {
  beforeEach(() => {
    useSettings.setState({ auth: { authenticated: true } })
    useProject.setState({
      project: {
        path: '/projects/kingdom',
        manifest: {
          version: 1,
          name: 'Kingdom',
          createdAt: '2026-08-09T10:00:00.000Z',
          updatedAt: '2026-08-09T10:00:00.000Z',
        },
      },
    })
  })

  it('says what to do rather than showing an empty panel without credentials', () => {
    useSettings.setState({ auth: { authenticated: false, reason: 'missing' } })
    installFakeBridge()
    renderPanel()

    expect(screen.getByText(/identifiants API/i)).toBeInTheDocument()
  })

  /** Public workflows and nothing else: a private one belongs to whoever wrote it. */
  it('lists the public workflows of the platform', async () => {
    const search = vi.fn(() => Promise.resolve({ items: [app()], cursor: null }))
    installFakeBridge({ workflows: { search } })
    renderPanel()

    expect(await screen.findByText('Background remover')).toBeInTheDocument()
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ privacy: 'public' }))
  })

  /** Scenario answers in English only, so the sentence its author wrote is said here. */
  it('says what an App wrote about itself in the studio language', async () => {
    installFakeBridge({
      workflows: {
        search: () =>
          Promise.resolve({ items: [app({ description: 'Remove background' })], cursor: null }),
      },
    })
    renderPanel()

    expect(await screen.findByText('Supprimer l’arrière-plan')).toBeInTheDocument()
  })

  /**
   * « c'est quoi App, le titre je ne le comprends pas ». The word is Scenario's and stays
   * untranslated, so the panel has to say what one is — and say it over the list, not only in
   * the empty state, which is the one case with nothing on screen to understand.
   */
  it('says what an App is, over the listing rather than in place of it', async () => {
    installFakeBridge({
      workflows: { search: () => Promise.resolve({ items: [app()], cursor: null }) },
    })
    renderPanel()

    expect(await screen.findByText('Background remover')).toBeInTheDocument()
    expect(screen.getByText(/plusieurs modèles enchaînés/)).toBeInTheDocument()
  })

  // The sentence explains the panel, so it is there whether or not the platform answered.
  it('says it with nothing to list too', async () => {
    installFakeBridge({ workflows: { search: () => Promise.resolve({ items: [], cursor: null }) } })
    renderPanel()

    expect(await screen.findByText(/plusieurs modèles enchaînés/)).toBeInTheDocument()
  })

  it('opens one on its form, built from the inputs the API declares', async () => {
    installFakeBridge({
      workflows: {
        search: () => Promise.resolve({ items: [app()], cursor: null }),
        describe: () => Promise.resolve(descriptor()),
      },
    })
    renderPanel()

    await userEvent.click(await screen.findByText('Background remover'))

    expect(await screen.findByLabelText('Image')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeInTheDocument()
  })

  /**
   * A row here leads somewhere: clicking it swaps the whole panel for the App it names, so no
   * row is ever the selected one. Announced as a `listbox` the list promised a selection it
   * could not have, and every row carried `aria-selected="false"` for the life of the panel.
   */
  it('announces a list of rows that open, not a listbox of rows to pick', async () => {
    installFakeBridge({
      workflows: { search: () => Promise.resolve({ items: [app()], cursor: null }) },
    })
    renderPanel()

    await screen.findByText('Background remover')
    expect(screen.getByRole('list', { name: 'Apps' })).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('listitem')).not.toHaveAttribute('aria-selected')
  })

  it('runs it through the workflow channel, and puts the job in the bar', async () => {
    const started: Job = jobOf({
      kind: 'workflow',
      targetId: 'workflow_1',
      label: 'Background remover',
      status: 'queued',
    })
    const run = vi.fn(() => Promise.resolve(started))
    installFakeBridge({
      workflows: {
        search: () => Promise.resolve({ items: [app()], cursor: null }),
        describe: () => Promise.resolve(descriptor()),
        run,
      },
    })
    useJobs.setState({ jobs: [], bodies: {} })
    renderPanel()

    await userEvent.click(await screen.findByText('Background remover'))
    await userEvent.type(await screen.findByLabelText('Image'), 'asset_1')
    await userEvent.click(screen.getByRole('button', { name: 'Lancer' }))

    await waitFor(() => expect(run).toHaveBeenCalledWith('workflow_1', { image: 'asset_1' }))
    await waitFor(() => expect(useJobs.getState().jobs).toHaveLength(1))
  })

  /** A draft answers 400 at the API. Saying so beats a failure nobody can read. */
  it('says a draft cannot be run, and does not offer to', async () => {
    installFakeBridge({
      workflows: {
        search: () => Promise.resolve({ items: [app({ status: 'draft' })], cursor: null }),
        describe: () => Promise.resolve(descriptor({ status: 'draft' })),
      },
    })
    renderPanel()

    await userEvent.click(await screen.findByText('Background remover'))

    expect(await screen.findByText(/brouillon/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeDisabled()
  })

  it('comes back to the listing from an App', async () => {
    installFakeBridge({
      workflows: {
        search: () => Promise.resolve({ items: [app()], cursor: null }),
        describe: () => Promise.resolve(descriptor()),
      },
    })
    renderPanel()

    await userEvent.click(await screen.findByText('Background remover'))
    await userEvent.click(await screen.findByRole('button', { name: 'Toutes les Apps' }))

    expect(await screen.findByText('Cuts the subject out')).toBeInTheDocument()
  })

  // Without this the panel sits on "loading" for ever when the API refuses the request.
  it('says why the listing is empty when the API refuses it', async () => {
    installFakeBridge({ workflows: { search: () => Promise.reject(new Error('rate-limited')) } })
    renderPanel()

    expect(await screen.findByText(/Trop de requêtes/i)).toBeInTheDocument()
  })
})
