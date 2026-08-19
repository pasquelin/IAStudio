import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fakeBridge'
import { useCloud } from '@/stores/cloud'
import { mountedAssetPicker } from '../assetPicker'
import { AssetPicker } from './AssetPicker'

const asset = (id: string, name: string, location: Asset['location'] = 'local'): Asset => ({
  id,
  name,
  type: 'image',
  location,
  tags: [],
  createdAt: '2026-08-19T10:00:00.000Z',
})

const HELD = [asset('a-1', 'Brique'), asset('a-2', 'Mousse', 'cloud')]

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
   * A library row is fetched BEFORE its id is handed over. Without it the slot took an id its
   * own list could not resolve — the row read « Image introuvable » and the engine asked for a
   * file that was never on disk. The drop path had always pulled first; this one had not.
   */
  it('fetches a library picture before handing its id over', async () => {
    const pulled = vi.fn().mockResolvedValue(asset('a-2-local', 'Mousse'))
    useCloud.setState({ fetchOne: pulled })
    render(<AssetPicker />)
    const chosen = ask()

    await userEvent.click(await screen.findByRole('button', { name: /Mousse/ }))

    expect(pulled).toHaveBeenCalledWith('a-2')
    await expect(chosen).resolves.toBe('a-2-local')
  })

  // The window stays up rather than filling a slot with an id that resolves to nothing.
  it('stays open when the exchange failed', async () => {
    useCloud.setState({ fetchOne: vi.fn().mockResolvedValue(null) })
    render(<AssetPicker />)
    void ask()

    await userEvent.click(await screen.findByRole('button', { name: /Mousse/ }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
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
