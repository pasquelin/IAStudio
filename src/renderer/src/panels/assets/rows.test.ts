import { describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloudAsset'
import { job } from '@/stores/job-fixtures'
import { badgeOfRow, mergeRows, nameOfRow, reconciled, typeOfRow } from './rows'

const NONE: ReadonlySet<string> = new Set()

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

describe('the three provenances a browser line can have', () => {
  it('lists a running generation, the catalogue and the library as one list', () => {
    const rows = mergeRows({
      local: [local()],
      remote: [cloud()],
      jobs: [job({ label: 'A skeleton', status: 'running', progress: 0.4 })],
      scope: null,
      absent: NONE,
    })

    // Newest first, whatever produced it — the library asset is dated after the local one, so it
    // comes first. A running generation sits above the sort: it is what is being waited on.
    expect(rows.map(row => row.from)).toEqual(['job', 'remote', 'local'])
  })

  it('orders the two settled provenances by date rather than by origin', () => {
    const rows = mergeRows({
      local: [local({ id: 'asset_new', createdAt: '2026-08-20T10:00:00.000Z' })],
      remote: [cloud({ createdAt: '2026-08-12T11:00:00.000Z' })],
      jobs: [],
      scope: null,
      absent: NONE,
    })

    expect(rows.map(row => row.id)).toEqual(['asset_new', 'remote:asset_remote'])
  })

  // A finished job has already been collected: the row it stood for now exists for real, and
  // leaving it would show the same output twice.
  it('drops a generation the moment it stops running', () => {
    const rows = mergeRows({
      local: [],
      remote: [],
      jobs: [job({ status: 'succeeded' }), job({ id: 'job_2', status: 'failed' })],
      scope: null,
      absent: NONE,
    })

    expect(rows).toEqual([])
  })

  it('shows a library asset the project already holds once, not twice', () => {
    const rows = mergeRows({
      local: [local({ remoteAssetId: 'asset_remote' })],
      remote: [cloud()],
      jobs: [],
      scope: null,
      absent: NONE,
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.from).toBe('local')
  })

  it('narrows both sides to what the space in front can take', () => {
    const rows = mergeRows({
      local: [local(), local({ id: 'asset_mesh', type: 'mesh' })],
      remote: [cloud(), cloud({ id: 'asset_pic', type: 'image' })],
      jobs: [],
      scope: ['mesh'],
      absent: NONE,
    })

    expect(rows.map(row => typeOfRow(row))).toEqual(['mesh', 'mesh'])
  })

  /**
   * A job says nothing about what it will produce until it answers, so it has no kind to be
   * narrowed by. Hiding it would be the studio refusing to mention a generation the user is
   * waiting on because it cannot yet name its shelf.
   */
  it('keeps a running generation whatever the space asks for', () => {
    const rows = mergeRows({
      local: [],
      remote: [],
      jobs: [job({ label: 'A skeleton', status: 'running', progress: 0.4 })],
      scope: ['audio'],
      absent: NONE,
    })

    expect(rows).toHaveLength(1)
    expect(typeOfRow(rows[0] as never)).toBeNull()
  })
})

describe('a row whose file the disk has lost', () => {
  // The whole point of the recovery path: what is gone is the FILE, and the asset is one
  // download away — so the line goes back to being the library one it can be fetched from.
  it('gives its place back to its twin when the library still holds one', () => {
    const rows = mergeRows({
      local: [local({ id: 'asset_gone', remoteAssetId: 'asset_remote' })],
      remote: [cloud()],
      jobs: [],
      scope: null,
      absent: new Set(['asset_gone']),
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.from).toBe('remote')
  })

  // Lost with nothing to fetch it back from: the row stays, and the badge is all that can be
  // said. Handing it to the library would promise a download that has no source.
  it('stays a local row when no twin answers for it', () => {
    const rows = mergeRows({
      local: [local({ id: 'asset_gone' })],
      remote: [cloud()],
      jobs: [],
      scope: null,
      absent: new Set(['asset_gone']),
    })

    expect(rows.map(row => row.from)).toEqual(['remote', 'local'])
  })

  // The twin is only recoverable if it is in the page actually read: a row whose twin sits
  // beyond it would be handed to a library line that is not there to receive it.
  it('stays local when its twin is outside the page that was read', () => {
    const rows = mergeRows({
      local: [local({ id: 'asset_gone', remoteAssetId: 'asset_elsewhere' })],
      remote: [cloud()],
      jobs: [],
      scope: null,
      absent: new Set(['asset_gone']),
    })

    expect(rows.map(row => row.from)).toEqual(['remote', 'local'])
  })
})

describe('what a line is called and what mark it wears', () => {
  it('names a job by its label and a library asset by its own name', () => {
    const rows = mergeRows({
      local: [],
      remote: [cloud()],
      jobs: [job({ label: 'A skeleton', status: 'running', progress: 0.4 })],
      scope: null,
      absent: NONE,
    })

    expect(rows.map(nameOfRow)).toEqual(['A skeleton', 'skeleton'])
  })

  /**
   * The name and nothing else, where this used to answer with the model that made it. Two things
   * took that away: a name is derived from the PROMPT now, so it says the thing rather than the
   * machine — and an asset can be renamed, which left it listed under its old word and
   * unfindable by its new one, the search reading exactly this.
   */
  it('calls a generated asset by its name, not by the model that made it', () => {
    const rows = mergeRows({
      local: [
        {
          id: 'asset_1',
          name: 'Pas courus dans les feuilles',
          type: 'audio',
          location: 'local',
          tags: [],
          createdAt: '2026-08-07',
          generation: {
            modelId: 'model_1',
            modelLabel: 'ElevenLabs Sound Effects',
            prompt: 'Background footsteps and rustling sounds',
            params: {},
          },
        },
      ],
      remote: [],
      jobs: [],
      scope: null,
      absent: NONE,
    })

    expect(rows.map(nameOfRow)).toEqual(['Pas courus dans les feuilles'])
  })

  it('marks the two provenances the catalogue cannot answer for', () => {
    const rows = mergeRows({
      local: [],
      remote: [cloud()],
      jobs: [job({ label: 'A skeleton', status: 'running', progress: 0.4 })],
      scope: null,
      absent: NONE,
    })

    expect(rows.map(row => badgeOfRow(row, 'proj_1'))).toEqual(['generating', 'remote-only'])
  })

  // A local row still goes through `assetBadgeOf`, which is what keeps the rule that reads a
  // catalogue row in one place rather than two that must agree.
  it('leaves a catalogue row to the shared reader', () => {
    const row = mergeRows({
      local: [local()],
      remote: [],
      jobs: [],
      scope: null,
      absent: NONE,
    })[0]

    expect(row && badgeOfRow(row, 'proj_1')).toBe('local-only')
  })
})

describe('reading a local row against the library page in hand', () => {
  const synced = local({
    remoteAssetId: 'asset_remote',
    remoteSyncedAt: '2026-08-12T11:00:00.000Z',
  })

  it('says nothing at all when no page was read for it', () => {
    expect(reconciled(synced, undefined)).toBeNull()
  })

  it('says nothing when the twin has not moved since the two were reconciled', () => {
    expect(reconciled(synced, cloud({ updatedAt: '2026-08-12T11:00:00.000Z' }))).toBeNull()
  })

  // The state nothing could reach before a page was read beside the catalogue.
  it('asks for a pull when only the library has moved', () => {
    expect(reconciled(synced, cloud({ updatedAt: '2026-08-12T12:00:00.000Z' }))).toBe('to-pull')
  })

  it('calls it a conflict when both sides moved since the baseline', () => {
    const edited = { ...synced, localChangedAt: '2026-08-12T11:30:00.000Z' }

    expect(reconciled(edited, cloud({ updatedAt: '2026-08-12T12:00:00.000Z' }))).toBe('conflict')
  })

  // Without a twin recorded there is nothing to compare: judging it would mean reading another
  // asset's stamp against this one's baseline.
  it('says nothing about a row that never had a twin', () => {
    expect(reconciled(local(), cloud())).toBeNull()
  })
})
