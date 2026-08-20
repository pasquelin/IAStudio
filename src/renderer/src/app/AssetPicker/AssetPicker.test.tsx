import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fakeBridge'
import { mountedAssetPicker } from '../assetPicker'
import { AssetPicker } from './AssetPicker'

/**
 * Local, every one of them, and that is not a shortcut: no writer in the app puts a
 * `location: 'cloud'` row in the catalogue, so a fixture that did was describing a state the
 * handler behind `assets.search` cannot produce — and four cases of this file passed on it.
 */
const asset = (id: string, name: string): Asset => ({
  id,
  name,
  type: 'image',
  location: 'local',
  path: `pictures/${id}.png`,
  tags: [],
  createdAt: '2026-08-19T10:00:00.000Z',
})

const HELD = [asset('a-1', 'Brique'), asset('a-2', 'Mousse')]

beforeEach(() => {
  installFakeBridge({ assets: { search: () => Promise.resolve(HELD) } })
})

function ask(): Promise<string | null> {
  const picker = mountedAssetPicker()
  if (!picker) throw new Error('no picker mounted')
  return picker({ accepts: ['image'], label: 'Texture' })
}

describe('the asset picker', () => {
  // Nothing on screen until a slot asks: it is a window, not a panel.
  it('shows nothing while nobody is asking', () => {
    render(<AssetPicker />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('offers what the project holds of the kind asked for', async () => {
    render(<AssetPicker />)
    void ask()

    expect(await screen.findByRole('button', { name: /Brique/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mousse/ })).toBeInTheDocument()
  })

  it('answers with the asset that was chosen, and closes', async () => {
    render(<AssetPicker />)
    const chosen = ask()

    await userEvent.click(await screen.findByRole('button', { name: /Brique/ }))

    await expect(chosen).resolves.toBe('a-1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  /**
   * `null` is the window being called off, which the caller must tell apart from choosing
   * nothing: emptying a slot is what the empty entry of its own list is for.
   */
  it('answers null when it is called off', async () => {
    render(<AssetPicker />)
    const chosen = ask()

    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }))

    await expect(chosen).resolves.toBeNull()
  })

  /**
   * On the DIALOG, not on the search box, which was the only thing carrying it: Escape did
   * nothing from a tile, from Cancel, or from a window just opened whose `autoFocus` had not
   * taken — measured on 2026-08-19, where the focus sat on `<body>`.
   */
  it('is called off by Escape from anywhere inside it', async () => {
    render(<AssetPicker />)
    const chosen = ask()
    const tile = await screen.findByRole('button', { name: /Brique/ })

    tile.focus()
    await userEvent.keyboard('{Escape}')

    await expect(chosen).resolves.toBeNull()
  })

  it('narrows what it shows to what is typed', async () => {
    render(<AssetPicker />)
    void ask()
    await screen.findByRole('button', { name: /Brique/ })

    await userEvent.type(screen.getByRole('searchbox'), 'mou')

    expect(screen.queryByRole('button', { name: /Brique/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mousse/ })).toBeInTheDocument()
  })

  /**
   * The second is called off rather than stacked: the first is on screen, and answering it for
   * the newcomer would fill a slot nobody was looking at.
   */
  it('refuses a second question while one is up', async () => {
    render(<AssetPicker />)
    void ask()
    await screen.findByRole('button', { name: /Brique/ })

    await expect(ask()).resolves.toBeNull()
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })
})
