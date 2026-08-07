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

  // The project file tree is not written yet: an outliner from another space would be a lie.
  it('shows no outliner outside the 3D space', () => {
    useLayouts.setState({ activeWorkspace: 'image' })
    render(<Explorer />)

    expect(screen.getByText('Aucun projet ouvert')).toBeInTheDocument()
  })
})
