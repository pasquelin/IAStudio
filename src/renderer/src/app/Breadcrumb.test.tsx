import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Project } from '@shared/domain/project'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { Breadcrumb } from './Breadcrumb'

const project = (name: string): Project => ({
  path: `/Users/someone/Films/${name}.scenario`,
  manifest: {
    version: 1,
    name,
    createdAt: '2026-08-07T10:00:00.000Z',
    updatedAt: '2026-08-07T10:00:00.000Z',
  },
})

describe('Breadcrumb', () => {
  beforeEach(() => {
    useProject.setState({ project: null })
    useDocuments.setState({ documents: {}, activeId: null })
  })

  it('names the open project', () => {
    useProject.setState({ project: project('Reel') })
    render(<Breadcrumb />)

    expect(screen.getByText('Reel')).toBeInTheDocument()
  })

  it('adds the document in front, which is what a breadcrumb is for', () => {
    useProject.setState({ project: project('Reel') })
    useDocuments.setState({
      activeId: 'doc-1',
      documents: {
        'doc-1': { id: 'doc-1', kind: 'sequence', title: 'Séquence 1', workspace: 'video' },
      },
    })
    render(<Breadcrumb />)

    expect(screen.getByText('Reel — Séquence 1')).toBeInTheDocument()
  })

  // The footer falls back to "no project open" on its own; saying it here as well would have
  // the line claim it twice, and claim it wrongly the moment a project opens.
  it('says nothing at all when no project is open', () => {
    const { container } = render(<Breadcrumb />)
    expect(container).toBeEmptyDOMElement()
  })
})
