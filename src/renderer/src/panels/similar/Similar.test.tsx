import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloudAsset, CloudPage } from '@shared/domain/cloud-asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { useSettings } from '@/stores/settings'
import { settleHome, settled } from '@/home/home-fixtures'
import { Similar } from './Similar'

function cloudAsset(id: string, overrides: Partial<CloudAsset> = {}): CloudAsset {
  return {
    id,
    name: `${id}.png`,
    type: 'image',
    remoteType: 'txt2img',
    ownerId: 'team_1',
    createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-08T10:00:00.000Z',
    privacy: 'public',
    tags: [],
    collectionIds: [],
    thumbnailUrl: `https://cdn.example/${id}.png`,
    ...overrides,
  }
}

type Installed = {
  browse: ReturnType<typeof vi.fn>
  similar: ReturnType<typeof vi.fn>
}

/** The two reads the panel makes: one to pick a reference, one to ask what resembles it. */
function install(library: CloudAsset[], alike: CloudAsset[]): Installed {
  const browse = vi.fn(() => Promise.resolve<CloudPage>({ assets: library, cursor: null }))
  const similar = vi.fn(() => Promise.resolve(alike))

  installFakeBridge({ cloud: { browse, similar } })
  return { browse, similar }
}

beforeEach(() => {
  settleHome()
  useSettings.setState({ auth: { authenticated: true, ownerId: 'team_1' } })
})

describe('the panel of lookalikes', () => {
  it('names what the likeness was measured against', async () => {
    // A column of pictures with no stated reason to be there is a column nobody trusts, and the
    // rail's own title cannot carry the name.
    install([cloudAsset('ref', { name: 'boulder.png' })], [cloudAsset('a'), cloudAsset('b')])
    render(<Similar />)

    expect(await screen.findByText('Dans la veine de « boulder.png »')).toBeInTheDocument()
  })

  it('picks the reference itself, rather than being handed one', async () => {
    // The choice belongs to the panel: the channel answers for whatever asset it is given, so a
    // right-click elsewhere can use it too.
    const { similar } = install([cloudAsset('ref')], [cloudAsset('a')])
    render(<Similar />)

    await waitFor(() => expect(similar).toHaveBeenCalledWith('ref'))
  })

  it('looks past the records the catalogue drops, rather than asking for one', async () => {
    // A captioning job writes JSON into the library — the studio makes those itself on every
    // pull — and the catalogue drops them on the way through. One of them at the head of the
    // listing left the reference empty and took the panel off an account holding thousands.
    const { browse } = install([cloudAsset('ref')], [cloudAsset('a')])
    render(<Similar />)

    await waitFor(() => expect(browse).toHaveBeenCalled())
    const asked = browse.mock.calls[0]?.[0] as { pageSize?: number } | undefined
    expect(asked?.pageSize ?? 1).toBeGreaterThan(1)
  })

  it('says the account holds nothing to compare, rather than drawing nothing', async () => {
    const { browse } = install([], [])
    render(<Similar />)

    await settled(browse)
    expect(await screen.findByText(/Rien à comparer pour l’instant/)).toBeInTheDocument()
  })

  it('says as much when nothing out there resembles it', async () => {
    // Not an incident: a fresh account's first upload may genuinely match nothing published.
    const { similar } = install([cloudAsset('ref')], [])
    render(<Similar />)

    await settled(similar)
    expect(await screen.findByText(/Rien à comparer pour l’instant/)).toBeInTheDocument()
  })

  it('offers to try again when the library refused, instead of vanishing', async () => {
    // A refusal used to be indistinguishable from an account with nothing alike: both left an
    // empty shelf, and the band stayed gone until the key changed.
    const browse = vi.fn(() => Promise.reject(new Error('429')))
    installFakeBridge({ cloud: { browse } })
    render(<Similar />)

    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    // Its own words rather than the generic line: what failed is the library, and the panel
    // knows which of its two reads that is.
    expect(screen.getByText(/La bibliothèque n’a pas répondu/)).toBeInTheDocument()
  })

  it('reads again when the offer is taken', async () => {
    const browse = vi
      .fn<() => Promise<CloudPage>>()
      .mockRejectedValueOnce(new Error('429'))
      .mockResolvedValue({ assets: [cloudAsset('ref', { name: 'boulder.png' })], cursor: null })
    const similar = vi.fn(() => Promise.resolve([cloudAsset('a')]))
    installFakeBridge({ cloud: { browse, similar } })
    render(<Similar />)

    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Dans la veine de « boulder.png »')).toBeInTheDocument()
  })

  it('treats a refusal on the second read as a refusal too', async () => {
    // The lookalikes are a separate request, and it is the one that spends the search quota —
    // so it is the likelier of the two to come back 429.
    const browse = vi.fn(() => Promise.resolve({ assets: [cloudAsset('ref')], cursor: null }))
    const similar = vi.fn(() => Promise.reject(new Error('429')))
    installFakeBridge({ cloud: { browse, similar } })
    render(<Similar />)

    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})
