import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaterialStyle } from '@shared/domain/style'
import { DEFAULT_TEXTURE_MATERIAL } from '@shared/domain/texture'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useStyles } from '@/stores/styles'
import { useTextures } from '@/stores/textures'
import { Styles } from './Styles'

const METAL: MaterialStyle = {
  id: 'style_1',
  name: 'Style 1',
  createdAt: '2026-08-09T00:00:00.000Z',
  values: { ...DEFAULT_TEXTURE_MATERIAL, roughness: 0.1, metalness: 1 },
}

beforeEach(() => {
  vi.clearAllMocks()
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
  useStyles.setState({ styles: [METAL], loaded: true })
  installFakeBridge({})
})

describe('the styles panel', () => {
  it('lists what is saved', () => {
    render(<Styles />)

    expect(screen.getByText('Style 1')).toBeInTheDocument()
  })

  it('says so when nothing is saved, rather than showing an empty box', () => {
    useStyles.setState({ styles: [], loaded: true })
    render(<Styles />)

    expect(screen.getByText(/Aucun style enregistré/)).toBeInTheDocument()
  })

  /**
   * A style cannot be picked, only applied: there is no plural action here. `Collection` reads
   * that off the props it is given, so the roles follow — and announcing a `listbox` would
   * promise a selection these rows can neither take nor give up.
   */
  it('announces a list, not a listbox', () => {
    render(<Styles />)

    expect(screen.getByRole('list', { name: 'Styles' })).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('offers renaming and removing on a right click, JetBrains-style', async () => {
    render(<Styles />)

    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Style 1') })

    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Supprimer' })).toBeInTheDocument()
  })

  it('arms the name field where the name is read', async () => {
    render(<Styles />)

    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Style 1') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renommer' }))

    expect(screen.getByRole('textbox', { name: 'Renommer' })).toHaveValue('Style 1')
  })

  /**
   * The right click cannot be the only way in: `contextmenu` raised by Shift+F10 targets the
   * focused cell, and the listener sits on a div inside it — an event never walks down into its
   * own descendants. Without a button on the row, renaming and removing were mouse-only.
   */
  it('offers the same two actions to the keyboard, through a button on the row', async () => {
    render(<Styles />)

    await userEvent.click(screen.getByRole('button', { name: 'Actions du style' }))

    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Supprimer' })).toBeInTheDocument()
  })

  it('renames from the row button, not only from the right click', async () => {
    render(<Styles />)

    await userEvent.click(screen.getByRole('button', { name: 'Actions du style' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renommer' }))

    expect(screen.getByRole('textbox', { name: 'Renommer' })).toHaveValue('Style 1')
  })

  // The second surface `InlineRename` serves, and the reason the fix belongs to the field rather
  // than to one of its callers: neither of them knows where the focus should land.
  it('gives the focus back to the row when the rename ends', async () => {
    render(<Styles />)

    await userEvent.click(screen.getByRole('button', { name: 'Actions du style' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renommer' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Renommer' }), '{Enter}')

    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())
    expect(screen.getByText('Style 1').closest('[role="listitem"]')).toHaveFocus()
  })

  /**
   * Enter commits, and the field is torn down by the re-render that follows. The teardown used
   * to commit a second time: the caller writes asynchronously, so the name on screen is still
   * the old one when the cleanup asks "was this abandoned mid-type".
   */
  it('renames once when the name is committed with Enter', async () => {
    const rename = vi.fn(() => Promise.resolve([]))
    installFakeBridge({ styles: { rename } })
    render(<Styles />)

    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Style 1') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renommer' }))
    await userEvent.clear(screen.getByRole('textbox', { name: 'Renommer' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Renommer' }), 'Métal brossé{Enter}')

    expect(rename).toHaveBeenCalledExactlyOnceWith('style_1', 'Métal brossé')
  })

  it('removes the one the menu was opened on', async () => {
    const remove = vi.fn(() => Promise.resolve([]))
    installFakeBridge({ styles: { remove } })
    render(<Styles />)

    await userEvent.pointer({ keys: '[MouseRight]', target: screen.getByText('Style 1') })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }))

    expect(remove).toHaveBeenCalledWith('style_1')
  })

  it('writes every value of the style onto the texture in front', async () => {
    const runCommand = vi.fn()
    useTextures.setState({ runCommand })
    useDocuments.setState({
      activeId: 'tex-1',
      documents: {
        'tex-1': { id: 'tex-1', kind: 'texture', title: 'Roche', workspace: 'textures' },
      },
    })
    render(<Styles />)

    await userEvent.dblClick(screen.getByText('Style 1'))

    expect(runCommand).toHaveBeenCalledOnce()
    expect(runCommand.mock.calls[0]?.[0]).toBe('tex-1')
  })

  /**
   * Listing without a texture open is deliberate: a panel that emptied itself when no document
   * was in front would read as styles that had been lost.
   */
  it('still lists what is saved with no texture open, and applies nothing', async () => {
    const runCommand = vi.fn()
    useTextures.setState({ runCommand })
    render(<Styles />)

    await userEvent.dblClick(screen.getByText('Style 1'))

    expect(runCommand).not.toHaveBeenCalled()
  })
})
