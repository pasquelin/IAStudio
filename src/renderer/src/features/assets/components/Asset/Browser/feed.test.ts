import { describe, expect, it } from 'vitest'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { job } from '@/stores/job-fixtures'
import { mergeFeed } from './feed'
import type { AssetRowModel } from '../rows'

function row(id: string, createdAt: string): AssetRowModel {
  const asset: CloudAsset = {
    id,
    name: id,
    type: 'image',
    remoteType: 'txt2img',
    ownerId: 'proj_1',
    createdAt,
    updatedAt: createdAt,
    privacy: 'private',
    tags: [],
    collectionIds: [],
  }
  return { id, from: 'remote', asset }
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
      published: { readTo: '2026-06-01T00:00:00.000Z', exhausted: true },
      library: { readTo: '2026-08-01T00:00:00.000Z', exhausted: true },
    })

    expect(idsOf(merged.rows)).toEqual(['august', 'july', 'june'])
    expect(merged.hungry).toEqual([])
  })

  it('holds back what an unfinished source could still come before', () => {
    // The library has only been read back to July, so nothing older than that is settled: a
    // June row drawn now is one the next library page may insert five rows above.
    const merged = mergeFeed(ROWS, {
      published: { readTo: '2026-06-01T00:00:00.000Z', exhausted: true },
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

  /**
   * A whole page can come back empty — the main process narrows the API's answer after it lands.
   * Read as « this source could still hold anything », that page hid the project's own catalogue
   * behind a library of another kind, with no scroll able to bring it back.
   */
  it('publishes the rest when a source answered with nothing, and asks that one again', () => {
    const merged = mergeFeed(ROWS, {
      published: { readTo: '2026-06-01T00:00:00.000Z', exhausted: true },
      library: { exhausted: false },
    })

    expect(idsOf(merged.rows)).toEqual(['august', 'july', 'june'])
    expect(merged.hungry).toEqual(['library'])
  })

  // Sorted last is what `stampOfRow` promises for an unreadable stamp — not dropped from the list.
  it('keeps a row whose stamp cannot be read', () => {
    const merged = mergeFeed([...ROWS, row('undated', 'not a date')], {
      library: { readTo: '2026-07-01T00:00:00.000Z', exhausted: false },
    })

    expect(idsOf(merged.rows)).toContain('undated')
  })

  it('names the source sitting on the cut, and only it', () => {
    // Asking them both spends a search quota on the one that is not what the list is short of.
    const merged = mergeFeed(ROWS, {
      published: { readTo: '2026-06-01T00:00:00.000Z', exhausted: false },
      library: { readTo: '2026-08-01T00:00:00.000Z', exhausted: false },
    })

    expect(merged.hungry).toEqual(['published'])
  })

  it('names every source sharing the cut', () => {
    const merged = mergeFeed(ROWS, {
      published: { readTo: '2026-07-01T00:00:00.000Z', exhausted: false },
      library: { readTo: '2026-07-01T00:00:00.000Z', exhausted: false },
    })

    expect(merged.hungry).toEqual(['library', 'published'])
  })

  it('ignores a source nobody is reading', () => {
    // The public feed is read only while the Source facet asks for it. Left out, it must not
    // hold back the one that IS being read — an unnamed source would otherwise cut everything.
    const merged = mergeFeed(ROWS, {
      published: { readTo: '2026-06-01T00:00:00.000Z', exhausted: false },
    })

    expect(idsOf(merged.rows)).toEqual(['august', 'july'])
    expect(merged.hungry).toEqual(['published'])
  })

  it('draws a running generation whatever the sources have reached', () => {
    // It carries no stamp, it stands above the sort, and it is what the reader is waiting on.
    const running: AssetRowModel = {
      id: 'job:1',
      from: 'job',
      job: job({ status: 'running' }),
      type: null,
    }

    const merged = mergeFeed([running, ...ROWS], {
      library: { readTo: '2026-09-01T00:00:00.000Z', exhausted: false },
    })

    // The cut is newer than every row here, so only the generation is left.
    expect(idsOf(merged.rows)).toEqual(['job:1'])
  })

  it('treats an unreadable stamp as the far past rather than blocking the list', () => {
    const merged = mergeFeed(ROWS, { library: { readTo: 'not a date', exhausted: false } })

    expect(idsOf(merged.rows)).toEqual(['august', 'july', 'june'])
    expect(merged.hungry).toEqual(['library'])
  })
})
