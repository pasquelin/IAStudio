import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaterialStyle } from '@shared/domain/style'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDocuments } from '@/stores/documents'
import { useSectionFolds } from '@/stores/sectionFolds'
import { useSelection } from '@/stores/selection'
import { useStyles } from '@/stores/styles'
import { useTextures } from '@/stores/textures'
import { newTexture } from '@/engines/texture/textureState'
import { InspectorActions } from './InspectorActions'

const SAVE = 'Enregistrer comme style'

function openTexture(): void {
  useDocuments.setState({
    activeId: 'tex-1',
    documents: {
      'tex-1': {
        id: 'tex-1',
        kind: 'texture',
        title: 'Roche',
        workspace: 'textures',
        path: 'documents/Roche.mtlx',
      },
    },
  })
  useTextures.getState().ensure('tex-1', newTexture)
}

beforeEach(() => {
  vi.clearAllMocks()
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
  useSelection.getState().clear()
  useStyles.setState({ styles: [], loaded: true })
  // A module-wide store, and no section is mounted here: the offer would otherwise carry over
  // whatever the previous case left answering.
  useSectionFolds.setState({ stamp: 0, wanted: true, sectionsOpen: new Map() })
  installFakeBridge({})
})

/** The button reads what sections answer, and this file mounts none of its own. */
function withOpenSection(): void {
  useSectionFolds.setState({ sectionsOpen: new Map([['a', true]]) })
}

describe('what the inspector title row carries', () => {
  it('offers to save a style while a texture is being inspected', () => {
    openTexture()
    render(<InspectorActions />)

    expect(screen.getByRole('button', { name: SAVE })).toBeInTheDocument()
  })

  it('offers no style to save when no document is in front', () => {
    render(<InspectorActions />)

    expect(screen.queryByRole('button', { name: SAVE })).not.toBeInTheDocument()
  })

  // Whatever the face: every one of them is made of sections, and this panel is read by folding
  // away what is not in hand.
  it('offers the fold with no document at all', () => {
    withOpenSection()
    render(<InspectorActions />)

    expect(screen.getByRole('button', { name: 'Tout replier' })).toBeInTheDocument()
  })

  it('offers it on a document face too', () => {
    withOpenSection()
    openTexture()
    render(<InspectorActions />)

    expect(screen.getByRole('button', { name: 'Tout replier' })).toBeInTheDocument()
  })

  /**
   * Read off what the sections ANSWER rather than off a flag: the inspector swaps its whole face
   * on every selection, and the sections that come back are new ones on their own defaults — a
   * flag would then go on offering to unfold what is already open.
   */
  it('offers to unfold once nothing is left open, and to fold again when a section returns', () => {
    withOpenSection()
    const { rerender } = render(<InspectorActions />)

    act(() => useSectionFolds.setState({ sectionsOpen: new Map([['a', false]]) }))
    rerender(<InspectorActions />)
    expect(screen.getByRole('button', { name: 'Tout déplier' })).toBeInTheDocument()

    act(() => useSectionFolds.setState({ sectionsOpen: new Map([['b', true]]) }))
    rerender(<InspectorActions />)
    expect(screen.getByRole('button', { name: 'Tout replier' })).toBeInTheDocument()
  })

  /**
   * The one the faces make easy to get wrong: the title row is shared, so a button posted for one
   * of them would offer to save a material while a clip filled the panel below it.
   */
  it('offers no style to save while a clip is selected, even with a texture open behind', () => {
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
