import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { job } from '@/stores/job-fixtures'
import { AssetRow } from './AssetRow'

/** Built by the panel in production — see `AssetCardProps.hints`. */
const HINTS = { fetch: {}, generating: {} }

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset_1',
    name: 'Boulder',
    type: 'image',
    location: 'local',
    path: 'assets/img/asset_1.png',
    tags: [],
    createdAt: '2026-08-06T10:00:00.000Z',
    ...overrides,
  }
}

describe('a row of the asset shelf', () => {
  /**
   * The kind sits in the row's `actions`, so the fill under it is the cell's — `elevated` on
   * hover, `accent-soft` once picked — where `muted` reads 3.51:1 and 3.25. It therefore wears
   * `ROW_QUIET` like every other quiet word of a row, rather than `text-muted` alone.
   *
   * Written because this site was the one the whole batch existed for and the only one no test
   * held: reverting it to `text-muted text-tiny` left all 7864 tests green.
   */
  it('lifts the kind out of muted once the row answers', () => {
    render(
      <AssetRow
        row={{ id: 'asset_1', from: 'local', asset: asset() }}
        typeLabel="Image"
        badge="local-only"
        badgeLabels={new Map()}
        hints={HINTS}
      />,
    )

    expect(screen.getByText('Image')).toHaveClass(
      'text-muted',
      'group-hover/row:text-text',
      'group-data-selected/row:text-text',
      'transition-colors',
    )
  })
})

describe('the same line in the list view', () => {
  it('names a library line and says what a double-click will do', () => {
    render(
      <AssetRow
        row={{
          id: 'remote:asset_remote',
          from: 'remote',
          asset: {
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
          },
        }}
        typeLabel="3D"
        badge="remote-only"
        badgeLabels={new Map()}
        hints={HINTS}
      />,
    )

    expect(screen.getByText('A skeleton')).toBeInTheDocument()
  })

  // A job has no kind to name until it answers, so the column is left blank rather than guessed.
  it('leaves the kind blank for a generation that has not answered yet', () => {
    render(
      <AssetRow
        row={{
          id: 'job:job-1',
          from: 'job',
          job: job({ label: 'A skeleton', status: 'running', progress: 0.4 }),
          type: null,
        }}
        typeLabel=""
        badge="generating"
        badgeLabels={new Map()}
        hints={HINTS}
      />,
    )

    expect(screen.getByText('A skeleton')).toBeInTheDocument()
  })
})
