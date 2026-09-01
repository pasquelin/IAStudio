import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AssetBadge, AssetType } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { installFakeBridge } from '@/services/fakeBridge'
import { useCloud } from '@/stores/cloud'
import { job } from '@/stores/job-fixtures'
import { useProject } from '@/stores/project'
import { AssetCard } from './AssetCard'
import type { AssetRowModel } from './rows'

const LABELS = new Map<AssetBadge, string>([
  ['remote-only', 'In the library'],
  ['fetching', 'Fetching…'],
  ['generating', 'Being generated'],
  ['synced', 'Already in the project'],
])

const remote: CloudAsset = {
  id: 'asset_remote',
  name: 'A skeleton',
  type: 'mesh',
  remoteType: 'img23d',
  ownerId: 'proj_1',
  createdAt: '2026-08-12T11:00:00.000Z',
  updatedAt: '2026-08-12T11:00:00.000Z',
  privacy: 'private',
  tags: [],
  collectionIds: [],
}

const TYPE_LABELS = new Map<AssetType, string>([
  ['image', 'Image'],
  ['mesh', 'Modèle 3D'],
])

/** Built by the panel in production — see `AssetCardProps.hints`. */
const HINTS = { fetch: {}, generating: {} }

function draw(row: AssetRowModel, badge: AssetBadge) {
  return render(
    <AssetCard
      row={row}
      badge={badge}
      badgeLabels={LABELS}
      typeLabels={TYPE_LABELS}
      hints={HINTS}
    />,
  )
}

describe('one cell of the remote browser, whatever it stands for', () => {
  beforeEach(() => {
    installFakeBridge({})
    useCloud.getState().clear()
    useProject.setState({ project: null })
  })

  it('tells a mesh from a picture, which their two previews do not', () => {
    draw({ id: 'remote:asset_remote', from: 'remote', asset: remote }, 'remote-only')

    expect(screen.getByRole('img', { name: 'Modèle 3D' })).toBeInTheDocument()
  })

  it('draws a library line under the name the API gave it', () => {
    draw({ id: 'remote:asset_remote', from: 'remote', asset: remote }, 'remote-only')

    expect(screen.getByText('A skeleton')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'In the library' })).toBeInTheDocument()
  })

  /**
   * Three signs, not one: `remote-only` and `fetching` are two blue download glyphs in a 12 px
   * corner, and a 45 Ko picture is here in 200 ms — the mark alone changed faster than an eye
   * can tell two similar ones apart.
   */
  it('dims the whole cell and spins while its bytes come down', () => {
    draw({ id: 'remote:asset_remote', from: 'remote', asset: remote }, 'fetching')

    expect(screen.getByRole('status', { name: 'Fetching…' })).toBeInTheDocument()
  })

  // A generation reports a real fraction, so it gets the bar — and the design system's one,
  // which carries the role and the percentage a screen reader reads out.
  it('shows how far along a generation is', () => {
    const running = job({ label: 'A skeleton', status: 'running', progress: 0.4 })
    draw({ id: 'job:job-1', from: 'job', job: running, type: null }, 'generating')

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  /**
   * What a store has to say about a line: whether spending a download on it would bring
   * anything. Read from the twin the project holds — see `markOf`.
   */
  it('says when the project already holds a library line', () => {
    draw({ id: 'remote:asset_remote', from: 'remote', asset: remote }, 'synced')

    expect(screen.getByRole('img', { name: 'Already in the project' })).toBeInTheDocument()
  })

  // A library line that is NOT being fetched wears no veil: the dimming is what says "this one,
  // right now", and a permanent one would say it of every cell.
  it('leaves a library line undimmed while nothing is coming down', () => {
    draw({ id: 'remote:asset_remote', from: 'remote', asset: remote }, 'remote-only')

    expect(screen.queryByRole('status')).toBeNull()
  })
})
