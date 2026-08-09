import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

/** The panel reaches it through an `import()`, and behind it sit three.js and a WebGL context. */
const deriveTextureChannel = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))

vi.mock('@/spaces/textures/derive-channel', () => ({ deriveTextureChannel }))

beforeEach(() => {
  installTexture('doc-1')
  // Session state, shared by every document: a channel left inspected would leak into the next.
  useTextureViews.setState({ inspected: {} })
  useAssets.setState({ items: [picture('img-1', 'Brique')] })
  // `vi.fn` keeps its calls across tests, and a count read from the previous one proves nothing.
  deriveTextureChannel.mockClear()
})

const fillChannel = (channel: 'height' | 'baseColor') =>
  useTextures
    .getState()
    .runCommand(
      'doc-1',
      setChannel(channel, { assetId: 'img-1', origin: 'imported', width: 8, height: 8 }),
    )

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

  describe('computing a channel from another', () => {
    const open = (channel: string) =>
      userEvent.click(
        screen.getByRole('button', { name: new RegExp(`Ce que contient ${channel}`) }),
      )

    /** `sourceFor` decides: four channels have one, and the other four have nothing to read. */
    it('offers no derivation for a channel nothing computes', async () => {
      render(<Channels />)

      await open('Couleur de base')

      expect(screen.queryByRole('menuitem', { name: /Calculer depuis/ })).toBeNull()
    })

    it('computes the channel from the source the domain names', async () => {
      fillChannel('height')
      render(<Channels />)

      await open('Normale')
      await userEvent.click(
        await screen.findByRole('menuitem', { name: /Calculer depuis Hauteur/ }),
      )

      expect(deriveTextureChannel).toHaveBeenCalledWith('doc-1', 'normal')
    })

    /**
     * Offered and refused rather than absent: an empty source is something to go and fill, and a
     * row that simply is not there leaves nothing to read that from.
     */
    it('says which channel is missing instead of hiding the row', async () => {
      render(<Channels />)

      await open('Normale')

      const row = await screen.findByRole('menuitem', {
        name: /Calculer depuis Hauteur — Hauteur est vide/,
      })
      expect(row).toBeDisabled()
      expect(deriveTextureChannel).not.toHaveBeenCalled()
    })

    /** The manual sends the reader to the first row of the menu. Nothing else held that. */
    it('offers the derivation before the pictures of the project', async () => {
      fillChannel('height')
      render(<Channels />)

      await open('Normale')

      const rows = await screen.findAllByRole('menuitem')
      expect(rows[0]).toHaveAccessibleName(/Calculer depuis Hauteur/)
    })

    /**
     * Each derivation opens a WebGL context of its own, and a browser evicts the oldest to hand
     * out the seventeenth — what would go black is a viewport somebody is looking at. So the
     * other rows go dead while one runs, they say why, and they come back.
     */
    it('closes every other derivation while one is running, and reopens them after', async () => {
      let finish = (): void => {}
      deriveTextureChannel.mockImplementationOnce(
        () => new Promise<boolean>(resolve => (finish = () => resolve(true))),
      )
      fillChannel('height')
      fillChannel('baseColor')
      render(<Channels />)

      await open('Normale')
      await userEvent.click(
        await screen.findByRole('menuitem', { name: /Calculer depuis Hauteur/ }),
      )

      await open('Normale')
      expect(await screen.findByRole('menuitem', { name: /Calcul en cours/ })).toBeDisabled()

      await open('Rugosité')
      const other = await screen.findByRole('menuitem', { name: /un autre canal est en calcul/ })
      expect(other).toBeDisabled()

      finish()

      // Without it, every derivable row of the session stays dead after the first computation.
      await open('Rugosité')
      expect(
        await screen.findByRole('menuitem', { name: /Calculer depuis Couleur de base$/ }),
      ).toBeEnabled()
    })

    /**
     * The channel being computed is the grid's own state, and one instance served every texture:
     * a job on one document left the rows of the one in front dead, with a reason that was true
     * of a document nobody was looking at.
     */
    it('leaves another texture alone while one of them computes', async () => {
      deriveTextureChannel.mockImplementationOnce(() => new Promise<boolean>(() => {}))
      fillChannel('height')
      const { rerender } = render(<Channels />)

      await open('Normale')
      await userEvent.click(
        await screen.findByRole('menuitem', { name: /Calculer depuis Hauteur/ }),
      )

      installTexture('doc-2')
      useTextures.setState(state => ({
        states: { ...state.states, 'doc-2': { ...textureOf(state, 'doc-2') } },
      }))
      rerender(<Channels />)

      await open('Normale')
      expect(
        await screen.findByRole('menuitem', { name: /Calculer depuis Hauteur — Hauteur est vide/ }),
      ).toBeInTheDocument()
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
