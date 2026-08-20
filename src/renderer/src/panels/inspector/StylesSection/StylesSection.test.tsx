import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaterialStyle } from '@shared/domain/style'
import { DEFAULT_TEXTURE_MATERIAL } from '@shared/domain/texture'
import { newTexture } from '@/engines/texture/textureState'
import { installFakeBridge } from '@/services/fakeBridge'
import { useStyles } from '@/stores/styles'
import { installTexture } from '@/stores/texture-fixtures'
import { useTextures } from '@/stores/textures'
import { StylesSection } from './StylesSection'

const METAL: MaterialStyle = {
  id: 'style_1',
  name: 'Style 1',
  createdAt: '2026-08-09T00:00:00.000Z',
  values: { ...DEFAULT_TEXTURE_MATERIAL, roughness: 0.1, metalness: 1 },
}

beforeEach(() => {
  vi.clearAllMocks()
  useStyles.setState({ styles: [METAL], loaded: true })
  installFakeBridge({})
})

const show = (documentId = 'doc-1'): void => {
  render(<StylesSection documentId={documentId} />)
}

describe('the styles of a material', () => {
  it('lists what is saved', () => {
    show()

    expect(screen.getByRole('button', { name: 'Style 1' })).toBeInTheDocument()
  })

  it('says so when nothing is saved, rather than showing an empty box', () => {
    useStyles.setState({ styles: [], loaded: true })
    show()

    expect(screen.getByText(/Aucun style enregistré/)).toBeInTheDocument()
  })

  /**
   * Which style is in force is read by comparison, since applying keeps no name. The tint is the
   * studio's one answer to "this line is the one" — the same `accent-soft` the other lists use.
   */
  describe('the style in force', () => {
    const openTexture = (material = DEFAULT_TEXTURE_MATERIAL): void =>
      installTexture('doc-1', { ...newTexture(), material })

    it('paints the style whose values the material carries', () => {
      openTexture(METAL.values)
      show()

      expect(
        screen.getByRole('button', { name: 'Style 1' }).closest('.bg-accent-soft'),
      ).not.toBeNull()
    })

    /** Move one slider afterwards and no style is in force any more — which is the truth. */
    it('paints none once the material has drifted from it', () => {
      openTexture({ ...METAL.values, roughness: 0.42 })
      show()

      expect(screen.getByRole('button', { name: 'Style 1' }).closest('.bg-accent-soft')).toBeNull()
    })

    /** The store answers nothing for a document whose state has not been built yet. */
    it('paints none while the material behind the id is not there', () => {
      show('doc-unknown')

      expect(screen.getByRole('button', { name: 'Style 1' }).closest('.bg-accent-soft')).toBeNull()
    })
  })

  it('offers renaming and removing on a right click, JetBrains-style', async () => {
    show()

    await userEvent.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Style 1' }),
    })

    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Supprimer' })).toBeInTheDocument()
  })

  /**
   * The right click cannot be the only way in: `contextmenu` raised by Shift+F10 targets the
   * focused element, so a row whose only listener sits above it depends on the focus being inside
   * it. Without a button on the row, renaming and removing were mouse-only.
   */
  it('offers the same two actions to the keyboard, through a button on the row', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Actions du style' }))

    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Supprimer' })).toBeInTheDocument()
  })

  it('arms the name field where the name is read', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Actions du style' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renommer' }))

    expect(screen.getByRole('textbox', { name: 'Renommer' })).toHaveValue('Style 1')
  })

  /**
   * An input torn out of the tree leaves the focus on `document.body`, and the next Tab restarts
   * from the top of the window. `InlineRename` hands it back to the nearest `[tabindex]`, which is
   * why the row carries one — the collection cell that used to be that anchor went with the panel.
   */
  it('gives the focus back to the row when the rename ends', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Actions du style' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renommer' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Renommer' }), '{Enter}')

    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Style 1' }).closest('li')).toHaveFocus()
  })

  /**
   * Enter commits, and the field is torn down by the re-render that follows. The teardown used
   * to commit a second time: the caller writes asynchronously, so the name on screen is still
   * the old one when the cleanup asks "was this abandoned mid-type".
   */
  it('renames once when the name is committed with Enter', async () => {
    const rename = vi.fn(() => Promise.resolve([]))
    installFakeBridge({ styles: { rename } })
    show()

    await userEvent.click(screen.getByRole('button', { name: 'Actions du style' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renommer' }))
    await userEvent.clear(screen.getByRole('textbox', { name: 'Renommer' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Renommer' }), 'Métal brossé{Enter}')

    expect(rename).toHaveBeenCalledExactlyOnceWith('style_1', 'Métal brossé')
  })

  it('removes the one the menu was opened on', async () => {
    const remove = vi.fn(() => Promise.resolve([]))
    installFakeBridge({ styles: { remove } })
    show()

    await userEvent.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', { name: 'Style 1' }),
    })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }))

    expect(remove).toHaveBeenCalledWith('style_1')
  })

  /**
   * A single press, where the panel took a double-click: the name is a button now, and a button
   * that needed pressing twice would be the one control of the studio that does.
   */
  it('writes every value of the style onto the document it was given', async () => {
    const runCommand = vi.fn()
    useTextures.setState({ runCommand })
    show('tex-1')

    await userEvent.click(screen.getByRole('button', { name: 'Style 1' }))

    expect(runCommand).toHaveBeenCalledOnce()
    expect(runCommand.mock.calls[0]?.[0]).toBe('tex-1')
  })
})
