import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { AssetRow } from './AssetRow'

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
    render(<AssetRow asset={asset()} typeLabel="Image" ownerId={null} badgeLabels={new Map()} />)

    expect(screen.getByText('Image')).toHaveClass(
      'text-muted',
      'group-hover/row:text-text',
      'group-data-selected/row:text-text',
      'transition-colors',
    )
  })
})
