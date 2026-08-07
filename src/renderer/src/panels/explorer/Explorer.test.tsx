import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { installScene } from '@/stores/scene-fixtures'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { Explorer } from './Explorer'

beforeEach(() => {
  installScene('doc-1')
  useLayouts.setState({ activeWorkspace: '3d' })
})

describe('Explorer', () => {
  it('shows the scene of the document in front when the 3D space is active', () => {
    render(<Explorer />)

    expect(screen.getByText('Scène')).toBeInTheDocument()
  })

  it('says so when the 3D space has no document open', () => {
    useDocuments.setState({ activeId: null })
    render(<Explorer />)

    expect(screen.getByText('Ouvrez une scène pour voir son contenu.')).toBeInTheDocument()
  })

  /**
   * The project file tree is not written yet, so an outliner from another space would be a lie
   * — but so was the wording. It borrowed `project.none`, and the Image workspace announced
   * "no project open" over a project that was plainly open.
   */
  it('says the explorer follows a scene, rather than that no project is open', () => {
    useLayouts.setState({ activeWorkspace: 'image' })
    render(<Explorer />)

    expect(screen.getByText(/L’explorateur suit une scène 3D/)).toBeInTheDocument()
    expect(screen.queryByText('Aucun projet ouvert')).not.toBeInTheDocument()
  })
})
