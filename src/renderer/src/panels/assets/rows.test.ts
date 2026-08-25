import { describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { job } from '@/stores/job-fixtures'
import { markOf, mergeRows, nameOfRow, reconciled, typeOfRow, type AssetRowModel } from './rows'

const NONE: ReadonlySet<string> = new Set()
const NO_TWINS: ReadonlyMap<string, Asset> = new Map()

function local(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset_local',
    name: 'moss.png',
    type: 'image',
    location: 'local',
    path: 'assets/img/moss.png',
    tags: [],
    createdAt: '2026-08-07T10:00:00.000Z',
    ...overrides,
  }
}

function cloud(overrides: Partial<CloudAsset> = {}): CloudAsset {
  return {
    id: 'asset_remote',
    name: 'skeleton',
    type: 'mesh',
    remoteType: 'img23d',
    ownerId: 'proj_1',
    createdAt: '2026-08-12T11:00:00.000Z',
    updatedAt: '2026-08-12T11:00:00.000Z',
    privacy: 'private',
    tags: [],
    collectionIds: [],
    ...overrides,
  }
}

describe('the provenances a line of the remote browser can have', () => {
  it('lists a running generation and the library as one list', () => {
    const rows = mergeRows({
      remote: [cloud()],
      jobs: [job({ label: 'A skeleton', status: 'running', progress: 0.4 })],
      scope: null,
    })

    // A running generation sits above the sort: it is what is being waited on.
    expect(rows.map(row => row.from)).toEqual(['job', 'remote'])
  })

  it('orders the two libraries by date rather than by origin', () => {
    const rows = mergeRows({
      remote: [cloud({ id: 'mine', createdAt: '2026-08-12T11:00:00.000Z' })],
      published: [cloud({ id: 'theirs', createdAt: '2026-08-20T10:00:00.000Z' })],
      jobs: [],
      scope: null,
    })

    expect(rows.map(row => (row.from === 'remote' ? row.asset.id : ''))).toEqual(['theirs', 'mine'])
  })

  // An asset one owns AND has published is one line, and it is one's own: the account's copy is
  // the truer of the two, and two lines under one id collide as a React key.
  it('shows an asset one owns and has also published once, as one’s own', () => {
    const rows = mergeRows({
      remote: [cloud({ id: 'both' })],
      published: [cloud({ id: 'both' })],
      jobs: [],
      scope: null,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.from === 'remote' && rows[0].published).toBeUndefined()
  })

  it('drops what the space in front has no use for', () => {
    const rows = mergeRows({
      remote: [cloud({ type: 'mesh' }), cloud({ id: 'a_picture', type: 'image' })],
      jobs: [],
      scope: ['image'],
    })

    expect(rows.map(row => (row.from === 'remote' ? row.asset.id : ''))).toEqual(['a_picture'])
  })

  /**
   * A job does not say what kind it will produce until it answers, and this panel exists to show
   * it: hiding a running generation because its type is unknown is worse than showing one that
   * belongs to another space.
   */
  it('keeps a running generation whatever the space asks for', () => {
    const rows = mergeRows({
      remote: [],
      jobs: [job({ status: 'running' })],
      scope: ['audio'],
    })

    expect(rows.map(row => row.from)).toEqual(['job'])
  })

  it('answers with the label a generation was submitted under, having no asset yet', () => {
    const rows = mergeRows({
      remote: [],
      jobs: [job({ label: 'A skeleton', status: 'running' })],
      scope: null,
    })

    expect(rows[0] && nameOfRow(rows[0])).toBe('A skeleton')
    expect(rows[0] && typeOfRow(rows[0])).toBeNull()
  })
})

describe('the mark one line wears', () => {
  const line = (asset: CloudAsset, published?: true): AssetRowModel => ({
    id: `remote:${asset.id}`,
    from: 'remote',
    asset,
    ...(published ? { published } : {}),
  })

  it('says a library asset is not on this disk', () => {
    expect(markOf(line(cloud()), { inFlight: NONE, twins: NO_TWINS })).toBe('remote-only')
  })

  it('tells someone else’s from one’s own', () => {
    expect(markOf(line(cloud(), true), { inFlight: NONE, twins: NO_TWINS })).toBe('published')
  })

  /**
   * What the panel is FOR: the one thing a store has to say about a line is whether spending a
   * download on it would bring anything.
   */
  it('says when the project already holds it', () => {
    const held = local({
      remoteAssetId: 'asset_remote',
      remoteSyncedAt: '2026-08-12T11:00:00.000Z',
    })
    const twins = new Map([['asset_remote', held]])

    expect(markOf(line(cloud()), { inFlight: NONE, twins })).toBe('synced')
  })

  // What is moving right now outranks every settled answer: it is the only state the user is
  // waiting on, and the tile draws a veil over it.
  it('lets a transfer under way outrank what is settled', () => {
    const held = local({
      remoteAssetId: 'asset_remote',
      remoteSyncedAt: '2026-08-12T11:00:00.000Z',
    })
    const twins = new Map([['asset_remote', held]])
    const inFlight = new Set(['asset_remote'])

    expect(markOf(line(cloud()), { inFlight, twins })).toBe('fetching')
  })

  it('marks a generation still running', () => {
    const row: AssetRowModel = {
      id: 'job:1',
      from: 'job',
      job: job({ status: 'running' }),
      type: null,
    }

    expect(markOf(row, { inFlight: NONE, twins: NO_TWINS })).toBe('generating')
  })
})

/**
 * Read from the REMOTE side, which is what losing the local half made possible: `to-pull` and
 * `conflict` used to sit on a project row and be reachable only while a page of the library
 * happened to be in hand.
 */
describe('how the copy a project holds stands against the library', () => {
  it('says nothing has moved when the stamps agree', () => {
    const asset = local({
      remoteAssetId: 'asset_remote',
      remoteSyncedAt: '2026-08-12T11:00:00.000Z',
    })

    expect(reconciled(asset, cloud())).toBeNull()
  })

  it('asks for a download when only the library moved', () => {
    const asset = local({
      remoteAssetId: 'asset_remote',
      remoteSyncedAt: '2026-08-10T11:00:00.000Z',
    })

    expect(reconciled(asset, cloud({ updatedAt: '2026-08-12T11:00:00.000Z' }))).toBe('to-pull')
  })

  it('says conflict when both sides moved since the last reconciliation', () => {
    const asset = local({
      remoteAssetId: 'asset_remote',
      remoteSyncedAt: '2026-08-10T11:00:00.000Z',
      localChangedAt: '2026-08-11T11:00:00.000Z',
    })

    expect(reconciled(asset, cloud({ updatedAt: '2026-08-12T11:00:00.000Z' }))).toBe('conflict')
  })

  it('marks the line with it, so the panel and the badge cannot disagree', () => {
    const asset = local({
      remoteAssetId: 'asset_remote',
      remoteSyncedAt: '2026-08-10T11:00:00.000Z',
    })
    const twins = new Map([['asset_remote', asset]])
    const row: AssetRowModel = { id: 'remote:asset_remote', from: 'remote', asset: cloud() }

    expect(markOf(row, { inFlight: NONE, twins })).toBe('to-pull')
  })
})
