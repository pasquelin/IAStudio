import { describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { job } from '@/stores/job-fixtures'
import { mergeFeed } from './feed'
import type { AssetRowModel } from './rows'

function row(id: string, createdAt: string): AssetRowModel {
  const asset: Asset = {
    id,
    name: id,
    type: 'image',
    location: 'local',
    path: `assets/img/${id}.png`,
    tags: [],
    createdAt,
  }
  return { id, from: 'local', asset }
}

/** Newest first, as `mergeRows` hands them over. */
const ROWS = [
  row('august', '2026-08-12T00:00:00.000Z'),
  row('july', '2026-07-01T00:00:00.000Z'),
  row('june', '2026-06-01T00:00:00.000Z'),
]

const idsOf = (rows: readonly AssetRowModel[]): string[] => rows.map(shown => shown.id)

describe('what the merged timeline may publish', () => {
  it('publishes everything once every source is at its end', () => {
    const merged = mergeFeed(ROWS, {
      local: { readTo: '2026-06-01T00:00:00.000Z', exhausted: true },
      library: { readTo: '2026-08-01T00:00:00.000Z', exhausted: true },
    })

    expect(idsOf(merged.rows)).toEqual(['august', 'july', 'june'])
    expect(merged.hungry).toEqual([])
  })

  it('holds back what an unfinished source could still come before', () => {
    // The library has only been read back to July, so nothing older than that is settled: a
    // June row drawn now is one the next library page may insert five rows above.
    const merged = mergeFeed(ROWS, {
      local: { readTo: '2026-06-01T00:00:00.000Z', exhausted: true },
      library: { readTo: '2026-07-01T00:00:00.000Z', exhausted: false },
    })

    expect(idsOf(merged.rows)).toEqual(['august'])
  })

  it('keeps back the rows sharing the stamp a source stopped on', () => {
    // A batch generation writes several assets in the same second, and they can straddle a page.
    const merged = mergeFeed(ROWS, {
      library: { readTo: '2026-07-01T00:00:00.000Z', exhausted: false },
    })

    expect(idsOf(merged.rows)).not.toContain('july')
  })

  it('publishes nothing while a source that has answered nothing is still open', () => {
    const merged = mergeFeed(ROWS, {
      local: { readTo: '2026-06-01T00:00:00.000Z', exhausted: true },
      library: { exhausted: false },
    })

    expect(merged.rows).toEqual([])
    expect(merged.hungry).toEqual(['library'])
  })

  it('names the source sitting on the cut, and only it', () => {
    // Asking them all spends a search quota on a feed that is not what the list is short of.
    const merged = mergeFeed(ROWS, {
      local: { readTo: '2026-06-01T00:00:00.000Z', exhausted: false },
      library: { readTo: '2026-08-01T00:00:00.000Z', exhausted: false },
      published: { readTo: '2026-08-01T00:00:00.000Z', exhausted: true },
    })

    expect(merged.hungry).toEqual(['local'])
  })

  it('names every source sharing the cut', () => {
    const merged = mergeFeed(ROWS, {
      local: { readTo: '2026-07-01T00:00:00.000Z', exhausted: false },
      library: { readTo: '2026-07-01T00:00:00.000Z', exhausted: false },
    })

    expect(merged.hungry).toEqual(['local', 'library'])
  })

  it('ignores a source nobody is reading', () => {
    // The public feed is read only while the Location facet asks for it. Left out, it must not
    // hold the two that ARE being read — an unnamed source would otherwise cut everything.
    const merged = mergeFeed(ROWS, {
      local: { readTo: '2026-06-01T00:00:00.000Z', exhausted: false },
    })

    expect(idsOf(merged.rows)).toEqual(['august', 'july'])
    expect(merged.hungry).toEqual(['local'])
  })

  it('draws a running generation whatever the sources have reached', () => {
    // It carries no stamp, it stands above the sort, and it is what the reader is waiting on.
    const running: AssetRowModel = {
      id: 'job:1',
      from: 'job',
      job: job({ status: 'running' }),
      type: null,
    }

    const merged = mergeFeed([running, ...ROWS], { library: { exhausted: false } })
    expect(idsOf(merged.rows)).toEqual(['job:1'])
  })

  it('treats an unreadable stamp as the far past rather than blocking the list', () => {
    const merged = mergeFeed(ROWS, { library: { readTo: 'not a date', exhausted: false } })

    expect(idsOf(merged.rows)).toEqual(['august', 'july', 'june'])
    expect(merged.hungry).toEqual(['library'])
  })
})
