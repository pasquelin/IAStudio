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
        'doc-1': { id: 'doc-1', kind: 'sequence', title: 'Sans titre 1', workspace: 'video' },
      },
    })
    render(<Breadcrumb />)

    expect(screen.getByText('Reel — Sans titre 1')).toBeInTheDocument()
  })

  /**
   * The wording used to live in `Footer` as a fallback for an absent `left`. Passing a
   * breadcrumb made it unreachable, and the status line went blank instead of saying anything.
   */
  it('says no project is open when none is', () => {
    render(<Breadcrumb />)
    expect(screen.getByText('Aucun projet ouvert')).toBeInTheDocument()
  })
})
