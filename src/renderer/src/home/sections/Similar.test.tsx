import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloudAsset, SimilarPage } from '@shared/domain/cloud-asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { useSettings } from '@/stores/settings'
import { settleHome } from '../home-fixtures'
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

function install(page: SimilarPage | null) {
  const similar = vi.fn(() => Promise.resolve(page))
  installFakeBridge({ cloud: { similar } })
  return { similar }
}

beforeEach(() => {
  settleHome()
  useSettings.setState({ auth: { authenticated: true, ownerId: 'team_1' } })
})

describe('the band of lookalikes', () => {
  it('names what the likeness was measured against', async () => {
    // A row of pictures with no stated reason to be there is a row nobody trusts.
    install({
      reference: cloudAsset('ref', { name: 'boulder.png' }),
      assets: [cloudAsset('a'), cloudAsset('b')],
    })
    render(<Similar />)

    expect(await screen.findByText('Dans la veine de « boulder.png »')).toBeInTheDocument()
  })

  it('draws nothing when the account holds nothing to compare', async () => {
    const { similar } = install(null)
    const { container } = render(<Similar />)

    await waitFor(() => expect(similar).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('draws nothing when nothing out there resembles it', async () => {
    // Not an incident: a fresh account's first upload may genuinely match nothing published.
    install({ reference: cloudAsset('ref'), assets: [] })
    const { container } = render(<Similar />)

    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
