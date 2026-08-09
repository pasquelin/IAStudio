import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaterialStyle } from '@shared/domain/style'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useSelection } from '@/stores/selection'
import { useStyles } from '@/stores/styles'
import { useTextures } from '@/stores/textures'
import { newTexture } from '@/engines/texture/texture-state'
import { InspectorActions } from './InspectorActions'

const SAVE = 'Enregistrer comme style'

function openTexture(): void {
  useDocuments.setState({
    activeId: 'tex-1',
    documents: {
      'tex-1': { id: 'tex-1', kind: 'texture', title: 'Roche', workspace: 'textures' },
    },
  })
  useTextures.getState().ensure('tex-1', newTexture)
}

beforeEach(() => {
  vi.clearAllMocks()
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
  useSelection.getState().clear()
  useStyles.setState({ styles: [], loaded: true })
  installFakeBridge({})
})

describe('what the inspector title row carries', () => {
  it('offers to save a style while a texture is being inspected', () => {
    openTexture()
    render(<InspectorActions />)

    expect(screen.getByRole('button', { name: SAVE })).toBeInTheDocument()
  })

  it('carries nothing when no document is in front', () => {
    render(<InspectorActions />)

    expect(screen.queryByRole('button', { name: SAVE })).not.toBeInTheDocument()
  })

  /**
   * The one the eight faces make easy to get wrong: the title row is shared, so a button posted
   * unconditionally would offer to save a material while a clip filled the panel below it.
   */
  it('carries nothing while a clip is selected, even with a texture open behind', () => {
    openTexture()
    useSelection.getState().selectClip('seq-1', 'clip-1')
    render(<InspectorActions />)

    expect(screen.queryByRole('button', { name: SAVE })).not.toBeInTheDocument()
  })

  it('saves the settings of the texture it is showing', async () => {
    const save = vi.fn((style: MaterialStyle) => Promise.resolve([style]))
    installFakeBridge({ styles: { save } })
    openTexture()
    useTextures.getState().runCommand('tex-1', {
      id: 'test',
      apply: texture => ({ ...texture, material: { ...texture.material, metalness: 0.75 } }),
      revert: texture => texture,
    })
    render(<InspectorActions />)

    await userEvent.click(screen.getByRole('button', { name: SAVE }))

    expect(save.mock.calls[0]?.[0]).toMatchObject({ name: 'Style 1' })
    expect(save.mock.calls[0]?.[0].values.metalness).toBe(0.75)
  })
})
