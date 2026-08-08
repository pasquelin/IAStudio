import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { showPanels } from '@/stores/layout-fixtures'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { Explorer } from './Explorer'

const openDocument = vi.fn()
vi.mock('@/app/dockview-api', () => ({
  openDocument: (...args: unknown[]) => openDocument(...args),
}))

const scene: DocumentDescriptor = { id: 'doc-1', kind: 'scene', title: 'Niveau', workspace: '3d' }
const sequence: DocumentDescriptor = {
  id: 'doc-2',
  kind: 'sequence',
  title: 'Bande annonce',
  workspace: 'video',
}

const withProject = (): void => {
  useProject.setState({
    project: {
      path: '/projects/demo',
      manifest: { version: 1, name: 'demo', createdAt: '', updatedAt: '' },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
  useProject.setState({ project: null })
  useLayouts.setState({ layouts: {} })
  installFakeBridge({})
})

describe('the project explorer', () => {
  it('says so when no project is open, rather than listing nothing', () => {
    render(<Explorer />)
    expect(screen.getByText(/Aucun projet ouvert/)).toBeInTheDocument()
  })

  it('lists what the project folder holds', async () => {
    withProject()
    installFakeBridge({ documents: { list: () => Promise.resolve([scene, sequence]) } })

    render(<Explorer />)

    expect(await screen.findByText('Bande annonce')).toBeInTheDocument()
    expect(screen.getByText('Niveau')).toBeInTheDocument()
  })

  // The whole point of the panel: a document closed while no layout held it is unreachable
  // otherwise, and it is exactly the one being hunted.
  it('lists a document no tab is showing', async () => {
    withProject()
    installFakeBridge({ documents: { list: () => Promise.resolve([scene]) } })

    render(<Explorer />)

    expect(await screen.findByText('Niveau')).toBeInTheDocument()
    expect(useDocuments.getState().documents['doc-1']).toBeUndefined()
  })

  it('marks the documents a tab is already showing', async () => {
    withProject()
    showPanels('3d', 'doc-1')
    installFakeBridge({ documents: { list: () => Promise.resolve([scene, sequence]) } })

    render(<Explorer />)

    await screen.findByText('Niveau')
    expect(screen.getAllByText('Ouvert')).toHaveLength(1)
  })

  it('opens a document on a double-click', async () => {
    withProject()
    installFakeBridge({ documents: { list: () => Promise.resolve([sequence]) } })

    render(<Explorer />)
    await userEvent.dblClick(await screen.findByText('Bande annonce'))

    expect(openDocument).toHaveBeenCalledWith(sequence)
  })

  it('says the project is empty rather than showing a blank panel', async () => {
    withProject()
    installFakeBridge({ documents: { list: () => Promise.resolve([]) } })

    render(<Explorer />)
    expect(await screen.findByText(/aucun document/)).toBeInTheDocument()
  })
})
