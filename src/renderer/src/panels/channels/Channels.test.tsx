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

    expect(
      screen.getByRole('img', { name: 'Généré par un modèle — figé tel qu’il est arrivé' }),
    ).toBeInTheDocument()
  })

  it('badges nothing on an empty channel', () => {
    render(<Channels />)

    expect(screen.queryByRole('img')).toBeNull()
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

    /**
     * A channel can be emptied while it is the one being looked at. The document already fell back
     * to the material; the tile went on claiming to be pressed **and** refusing to be pressed —
     * two statements at once. Derived where both stores are visible rather than stored twice.
     */
    it('stops claiming to be current once its channel is emptied', async () => {
      fill('normal')
      render(<Channels />)
      await userEvent.click(screen.getByRole('button', { name: /Regarder Normale seul/ }))

      useTextures.getState().runCommand('doc-1', setChannel('normal', null))

      const tile = await screen.findByRole('button', { name: /Regarder Normale seul/ })
      expect(tile).toHaveAttribute('aria-pressed', 'false')
      expect(tile).toBeDisabled()
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

  describe('what a channel is allowed to hold', () => {
    /**
     * `isLocalPicture`, the filter the environment section already applies: a cloud row would be
     * offered, chosen, and show nothing at all.
     */
    it('offers no picture that has no file to decode yet', async () => {
      useAssets.setState({ items: [picture('cloud-1', 'Distante', 'cloud')] })
      render(<Channels />)

      await userEvent.click(screen.getByRole('button', { name: /Ce que contient Normale/ }))

      expect(screen.queryByRole('menuitem', { name: /Distante/ })).toBeNull()
    })

    /**
     * The menu and the drop have to answer the same question. `accepts` is `PICTURES`, and
     * `placeTextureChannel` takes any of the three — so listing `image` alone meant a local skybox
     * dropped onto Roughness fine and was never offered, leaving a tile showing a picture with no
     * row ticked.
     */
    it('offers a generated sky and a generated texture, which a channel can hold', async () => {
      useAssets.setState({
        items: [
          { ...picture('sky-1', 'Coucher'), type: 'skybox' },
          { ...picture('tex-1', 'Rouille'), type: 'texture' },
        ],
      })
      render(<Channels />)

      await userEvent.click(screen.getByRole('button', { name: /Ce que contient Normale/ }))

      expect(await screen.findByRole('menuitem', { name: /Coucher/ })).toBeInTheDocument()
      expect(await screen.findByRole('menuitem', { name: /Rouille/ })).toBeInTheDocument()
    })

    /** A button that refuses without a word is worse than a menu that says why it is empty. */
    it('says there is no picture rather than refusing to open', async () => {
      useAssets.setState({ items: [] })
      render(<Channels />)

      await userEvent.click(screen.getByRole('button', { name: /Ce que contient Normale/ }))

      expect(
        await screen.findByRole('menuitem', { name: /Aucune image dans ce projet/ }),
      ).toBeInTheDocument()
    })

    /**
     * The regression: with no picture in the project the menu held one row, and `MenuButton` acts
     * outright rather than opening on a single row — so the only remaining action, emptying the
     * channel, sat behind a button that looked alive and did nothing.
     */
    it('can still empty a channel in a project that holds no picture', async () => {
      useTextures
        .getState()
        .runCommand(
          'doc-1',
          setChannel('normal', { assetId: 'gone-1', origin: 'imported', width: 8, height: 8 }),
        )
      useAssets.setState({ items: [] })
      render(<Channels />)

      await userEvent.click(screen.getByRole('button', { name: /Ce que contient Normale/ }))
      await userEvent.click(await screen.findByRole('menuitem', { name: /Vider ce canal/ }))

      expect(channels().normal).toBeUndefined()
    })
  })
})
