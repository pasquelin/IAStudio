import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { DEFAULT_HOME_SECTIONS } from '@shared/domain/home'
import { installFakeBridge } from '@/services/fake-bridge'
import { useCloud } from '@/stores/cloud'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { Library } from './Library'

const PROJECT = {
  path: '/projects/summer',
  manifest: {
    version: 1,
    name: 'Summer',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
}

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
  useSettings.setState(state => ({
    auth: { authenticated: true, ownerId: 'team_1' },
    authKnown: true,
    settings: { ...state.settings, home: { enabled: true, sections: [...DEFAULT_HOME_SECTIONS] } },
  }))
  useProject.setState({ project: PROJECT, known: true })
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

  it('reads the library again when the active key changes', async () => {
    const { browse } = install([cloudAsset()])
    render(<Library />)

    await screen.findByText('FLUX.2')
    useSettings.setState({ auth: { authenticated: true, ownerId: 'team_2' } })

    await vi.waitFor(() => expect(browse).toHaveBeenCalledTimes(2))
  })
})
