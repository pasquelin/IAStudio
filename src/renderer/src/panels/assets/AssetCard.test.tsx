import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset, AssetBadge, AssetType } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { useCloud } from '@/stores/cloud'
import { job } from '@/stores/job-fixtures'
import { useProject } from '@/stores/project'
import { AssetCard } from './AssetCard'
import type { AssetRowModel } from './rows'

const LABELS = new Map<AssetBadge, string>([
  ['remote-only', 'In the library'],
  ['fetching', 'Fetching…'],
  ['generating', 'Being generated'],
  ['missing', 'File not found'],
  ['local-only', 'Local only'],
])

const picture: Asset = {
  id: 'asset_1',
  name: 'moss.png',
  type: 'image',
  location: 'local',
  path: 'assets/img/moss.png',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
}

const sound: Asset = {
  id: 'asset_2',
  name: 'pad.wav',
  type: 'audio',
  location: 'local',
  path: 'assets/audio/pad.wav',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
}

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

describe('one cell of the shelf, whatever it stands for', () => {
  beforeEach(() => {
    installFakeBridge({})
    useCloud.getState().clear()
    useProject.setState({ project: null })
  })

  it('names a catalogue row and wears its mark', () => {
    draw({ id: 'asset_1', from: 'local', asset: picture }, 'local-only')

    expect(screen.getByText('moss.png')).toBeInTheDocument()
  })

  /**
   * The defect this mark exists for: the shelf's type glyph was the tile's FALLBACK, so it only
   * ever showed where there was no thumbnail — never on the tiles worth telling apart. A `.glb`
   * whose preview has been rendered and a `.png` looked exactly alike.
   */
  it('says what a tile is, thumbnail or no thumbnail', () => {
    // A local picture: `posterUrl` answers for it, so the tile draws the file itself and the
    // fallback glyph the shelf used to rely on never renders.
    draw({ id: 'asset_1', from: 'local', asset: picture }, 'local-only')

    expect(screen.getByRole('img', { name: 'Image' })).toBeInTheDocument()
  })

  /**
   * A sound is the one kind the studio writes no poster for — a still would be painted under the
   * waveform of every clip it becomes. Every sound of the shelf therefore wore the same speaker
   * glyph, and two takes of the same length were told apart only by playing them.
   */
  it('draws a sound as its own waveform rather than as a glyph', () => {
    const { container } = draw({ id: 'asset_2', from: 'local', asset: sound }, 'local-only')

    expect(container.querySelector('canvas')).toBeInTheDocument()
    expect(screen.getByText('pad.wav')).toBeInTheDocument()
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

  // The mark a row wears when the disk has lost its file and no twin can bring it back.
  it('marks a catalogue row whose file has gone', () => {
    draw({ id: 'asset_1', from: 'local', asset: picture }, 'missing')

    expect(screen.getByRole('img', { name: 'File not found' })).toBeInTheDocument()
  })

  // A library line that is NOT being fetched wears no veil: the dimming is what says "this one,
  // right now", and a permanent one would say it of every cell.
  it('leaves a library line undimmed while nothing is coming down', () => {
    draw({ id: 'remote:asset_remote', from: 'remote', asset: remote }, 'remote-only')

    expect(screen.queryByRole('status')).toBeNull()
  })
})
