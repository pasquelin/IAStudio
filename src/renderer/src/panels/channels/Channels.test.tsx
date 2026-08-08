import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { PBR_CHANNELS } from '@shared/domain/texture'
import { setChannel } from '@/engines/texture/commands'
import { installDocument } from '@/stores/document-fixtures'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { installTexture } from '@/stores/texture-fixtures'
import { inspectedChannel, useTextureViews } from '@/stores/texture-views'
import { textureOf, useTextures } from '@/stores/textures'
import { Channels } from './Channels'

const picture = (id: string, name: string, location: Asset['location'] = 'local'): Asset => ({
  id,
  name,
  type: 'image',
  location,
  path: `assets/${id}.png`,
  tags: [],
  createdAt: '2026-08-08T00:00:00.000Z',
  width: 1024,
  height: 1024,
})

const channels = () => textureOf(useTextures.getState(), 'doc-1').channels

beforeEach(() => {
  installTexture('doc-1')
  // Session state, shared by every document: a channel left inspected would leak into the next.
  useTextureViews.setState({ inspected: {} })
  useAssets.setState({ items: [picture('img-1', 'Brique')] })
})

describe('Channels', () => {
  // The panel sits on the edge, outside Dockview: it reads the texture in front.
  it('says so when no document is in front, rather than showing eight empty tiles', () => {
    useDocuments.setState({ activeId: null })
    render(<Channels />)

    expect(screen.getByText('Ouvrez une texture pour voir ses canaux.')).toBeInTheDocument()
  })

  it('shows nothing for a document that is not a texture', () => {
    installDocument('doc-1', '3d')
    render(<Channels />)

    expect(screen.getByText('Ouvrez une texture pour voir ses canaux.')).toBeInTheDocument()
  })

  /** All eight, empty ones included: what a material lacks is as much the point as what it has. */
  it('shows one tile per channel the domain declares, filled or not', () => {
    render(<Channels />)

    expect(screen.getAllByRole('figure')).toHaveLength(PBR_CHANNELS.length)
    expect(screen.getByText('Couleur de base')).toBeInTheDocument()
    // The cavity mask included, which three has no slot for and the shader reads on its own.
    expect(screen.getByText('Cavité')).toBeInTheDocument()
  })

  it('puts a picture of the project into the channel it was chosen for', async () => {
    render(<Channels />)

    await userEvent.click(screen.getByRole('button', { name: /Ce que contient Normale/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Brique/ }))

    expect(channels().normal?.assetId).toBe('img-1')
    // And only that one: eight tiles offering the same list is how the wrong slot gets filled.
    expect(channels().baseColor).toBeUndefined()
  })

  it('empties a channel that holds something', async () => {
    useTextures
      .getState()
      .runCommand(
        'doc-1',
        setChannel('roughness', { assetId: 'img-1', origin: 'imported', width: 8, height: 8 }),
      )
    render(<Channels />)

    await userEvent.click(screen.getByRole('button', { name: /Ce que contient Rugosité/ }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Vider ce canal/ }))

    expect(channels().roughness).toBeUndefined()
  })

  /**
   * Empty is one of the choices, as `TextureField` has it: choosing no picture is choosing. It
   * also keeps the menu two rows deep at its shallowest — `MenuButton` acts outright on one row
   * instead of opening, which left a project holding a single picture unable to open this menu.
   */
  it('offers the empty row whether the channel holds anything or not', async () => {
    render(<Channels />)

    await userEvent.click(screen.getByRole('button', { name: /Ce que contient Rugosité/ }))

    expect(await screen.findByRole('menuitem', { name: /Vider ce canal/ })).toBeInTheDocument()
    expect(await screen.findByRole('menuitem', { name: /Brique/ })).toBeInTheDocument()
  })

  /**
   * The badge is what tells a frozen channel from one that recomputes. Read from the origin the
   * command wrote, so "imported" is what a picture the user dropped reads as.
   */
  it('says where the pixels of a channel came from', () => {
    useTextures
      .getState()
      .runCommand(
        'doc-1',
        setChannel('height', { assetId: 'img-1', origin: 'generated', width: 8, height: 8 }),
      )
    render(<Channels />)

    expect(screen.getByText('Généré par un modèle — figé tel qu’il est arrivé')).toBeInTheDocument()
  })

  it('badges nothing on an empty channel', () => {
    render(<Channels />)

    expect(screen.queryByText(/Votre propre fichier/)).toBeNull()
    expect(screen.queryByText(/Généré par un modèle/)).toBeNull()
  })

  describe('looking at one channel on its own', () => {
    const fill = (channel: 'normal' | 'roughness') =>
      useTextures
        .getState()
        .runCommand(
          'doc-1',
          setChannel(channel, { assetId: 'img-1', origin: 'derived', width: 8, height: 8 }),
        )

    it('marks the channel the document is showing flat', async () => {
      fill('normal')
      render(<Channels />)

      await userEvent.click(screen.getByRole('button', { name: /Regarder Normale seul/ }))

      expect(inspectedChannel(useTextureViews.getState(), 'doc-1')).toBe('normal')
    })

    it('goes back to the lit material when the same tile is pressed again', async () => {
      fill('normal')
      render(<Channels />)

      await userEvent.click(screen.getByRole('button', { name: /Regarder Normale seul/ }))
      await userEvent.click(screen.getByRole('button', { name: /Revenir au matériau éclairé/ }))

      expect(inspectedChannel(useTextureViews.getState(), 'doc-1')).toBeNull()
    })

    it('moves straight from one channel to another', async () => {
      fill('normal')
      fill('roughness')
      render(<Channels />)

      await userEvent.click(screen.getByRole('button', { name: /Regarder Normale seul/ }))
      await userEvent.click(screen.getByRole('button', { name: /Regarder Rugosité seul/ }))

      expect(inspectedChannel(useTextureViews.getState(), 'doc-1')).toBe('roughness')
    })

    /** A blank frame that says nothing is worse than a tile that refuses to be pressed. */
    it('refuses on a channel with no pixels to look at', () => {
      render(<Channels />)

      expect(screen.getByRole('button', { name: /Regarder Normale seul/ })).toBeDisabled()
    })

    it('says which tile is current, so the ring is not decoration', async () => {
      fill('normal')
      render(<Channels />)

      const tile = screen.getByRole('button', { name: /Regarder Normale seul/ })
      expect(tile).toHaveAttribute('aria-pressed', 'false')

      await userEvent.click(tile)

      expect(screen.getByRole('button', { name: /Revenir au matériau éclairé/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })
  })

  /**
   * `isLocalPicture` and nothing else, the filter the environment section already applies: a cloud
   * row would be offered, chosen, and show nothing at all.
   */
  it('offers no picture that has no file to decode yet', async () => {
    useAssets.setState({ items: [picture('cloud-1', 'Distante', 'cloud')] })
    render(<Channels />)

    const button = screen.getByRole('button', { name: /Ce que contient Normale/ })
    expect(button).toBeDisabled()
  })
})
