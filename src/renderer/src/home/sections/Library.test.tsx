import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { settleHome } from '../home-fixtures'
import { useCloud } from '@/stores/cloud'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { Library } from './Library'

function cloudAsset(overrides: Partial<CloudAsset> = {}): CloudAsset {
  return {
    id: 'cloud_1',
    name: 'boulder.png',
    type: 'image',
    remoteType: 'texture',
    ownerId: 'team_1',
    createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-08T10:00:00.000Z',
    privacy: 'private',
    tags: [],
    collectionIds: [],
    thumbnailUrl: 'https://cdn.example/thumb.png',
    generation: { modelId: 'flux_2', modelLabel: 'FLUX.2', prompt: 'a boulder', params: {} },
    ...overrides,
  }
}

function install(assets: readonly CloudAsset[]) {
  const browse = vi.fn(() => Promise.resolve({ assets: [...assets], cursor: null }))
  const pull = vi.fn(() => Promise.resolve([]))
  installFakeBridge({ cloud: { browse, pull } })
  return { browse, pull }
}

beforeEach(() => {
  settleHome()
  useSettings.setState({ auth: { authenticated: true, ownerId: 'team_1' } })
  useCloud.setState({ busy: false, outcomes: [] })
})

describe('the library shelf', () => {
  /**
   * The thumbnail, not the asset: its URL is public and stable, while the asset's own carries a
   * signature that appending anything to would invalidate — the CDN answers 403.
   */
  it('captions each tile with the model, and draws the thumbnail it may resize', async () => {
    install([cloudAsset()])
    const { container } = render(<Library />)

    expect(await screen.findByText('FLUX.2')).toBeInTheDocument()
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.example/thumb.png?width=264',
    )
  })

  it('fetches into the project when one is open', async () => {
    const { pull } = install([cloudAsset()])
    render(<Library />)

    await userEvent.click(await screen.findByRole('button', { name: /boulder\.png/ }))

    expect(pull).toHaveBeenCalledWith(['cloud_1'])
  })

  /**
   * The section only needs a key, not a folder — what the account holds is worth showing before
   * a project is open. But nothing here may act without one to write into.
   */
  it('shows what the account holds without a project, and offers no way to fetch it', async () => {
    useProject.setState({ project: null, known: true })
    install([cloudAsset()])
    render(<Library />)

    expect(await screen.findByText('FLUX.2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /boulder\.png/ })).not.toBeInTheDocument()
  })

  it('takes itself off when the library answers nothing', async () => {
    const { browse } = install([])
    const { container } = render(<Library />)

    await vi.waitFor(() => expect(browse).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  /**
   * The one an empty band could not say. A 429 took the shelf off the page without a word —
   * and since `cloudBrowse` goes through `quietlyReducedBy`, the journal did not say it either,
   * so there was no trace of it anywhere the user could look.
   */
  it('stays and says so when the library refuses, rather than disappearing', async () => {
    installFakeBridge({ cloud: { browse: () => Promise.reject(new Error('429')) } })
    render(<Library />)

    expect(await screen.findByText(/n’a pas obtenu de réponse/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it('reads the library again when that button is pressed', async () => {
    const browse = vi
      .fn<() => Promise<{ assets: CloudAsset[]; cursor: string | null }>>()
      .mockRejectedValueOnce(new Error('429'))
      .mockResolvedValueOnce({ assets: [cloudAsset()], cursor: null })
    installFakeBridge({ cloud: { browse } })
    render(<Library />)
    await screen.findByRole('button', { name: 'Réessayer' })

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('FLUX.2')).toBeInTheDocument()
  })

  it('reads the library again when the active key changes', async () => {
    const { browse } = install([cloudAsset()])
    render(<Library />)

    await screen.findByText('FLUX.2')
    useSettings.setState({ auth: { authenticated: true, ownerId: 'team_2' } })

    await vi.waitFor(() => expect(browse).toHaveBeenCalledTimes(2))
  })
})
