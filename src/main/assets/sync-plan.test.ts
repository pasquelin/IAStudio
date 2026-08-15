import { describe, expect, it } from 'vitest'
import type { SyncPolicy } from '@shared/domain/sync'
import { planSync, type SyncSide } from './sync-plan'

const OWNER = 'proj_current'

/** A local file with a settled twin: both sides agreed at 10:00 and neither has moved. */
function settled(overrides: Partial<SyncSide> = {}): SyncSide {
  return {
    assetId: 'asset_1',
    hasLocalFile: true,
    remoteAssetId: 'remote_1',
    remoteOwnerId: OWNER,
    remoteUpdatedAt: '2026-08-06T10:00:00.000Z',
    remoteSyncedAt: '2026-08-06T10:00:00.000Z',
    localChangedAt: '2026-08-06T10:00:00.000Z',
    ...overrides,
  }
}

const AHEAD = '2026-08-06T12:00:00.000Z'

describe('pushing', () => {
  it('sends a local file that has no twin yet', () => {
    const side = settled({ remoteAssetId: undefined, remoteOwnerId: undefined })
    expect(planSync([side], 'push', OWNER).actions).toEqual([{ kind: 'push', assetId: 'asset_1' }])
  })

  it('sends a file edited since the two sides last agreed', () => {
    const plan = planSync([settled({ localChangedAt: AHEAD })], 'push', OWNER)
    expect(plan.actions).toEqual([{ kind: 'push', assetId: 'asset_1' }])
  })

  it('leaves a settled asset alone', () => {
    const plan = planSync([settled()], 'push', OWNER)
    expect(plan.actions).toEqual([{ kind: 'skip', assetId: 'asset_1', reason: 'nothing-to-do' }])
  })

  it('cannot send what it does not hold', () => {
    const plan = planSync([settled({ hasLocalFile: false })], 'push', OWNER)
    expect(plan.actions).toEqual([{ kind: 'skip', assetId: 'asset_1', reason: 'no-local-file' }])
  })
})

describe('pulling', () => {
  it('fetches an asset the project does not hold', () => {
    const plan = planSync([settled({ hasLocalFile: false })], 'pull', OWNER)
    expect(plan.actions).toEqual([{ kind: 'pull', assetId: 'asset_1', remoteAssetId: 'remote_1' }])
  })

  it('fetches an asset the library changed since they agreed', () => {
    const plan = planSync([settled({ remoteUpdatedAt: AHEAD })], 'pull', OWNER)
    expect(plan.actions).toEqual([{ kind: 'pull', assetId: 'asset_1', remoteAssetId: 'remote_1' }])
  })

  it('has nothing to fetch for an asset with no twin', () => {
    const side = settled({ remoteAssetId: undefined, remoteOwnerId: undefined })
    expect(planSync([side], 'pull', OWNER).actions).toEqual([
      { kind: 'skip', assetId: 'asset_1', reason: 'no-twin' },
    ])
  })
})

describe('the two-way policy, which no screen asks for yet', () => {
  it('reports a conflict when both sides moved, and resolves nothing', () => {
    const side = settled({ localChangedAt: AHEAD, remoteUpdatedAt: AHEAD })
    expect(planSync([side], 'two-way', OWNER).actions).toEqual([
      { kind: 'conflict', assetId: 'asset_1', remoteAssetId: 'remote_1' },
    ])
  })

  it('sends when only this side moved', () => {
    const plan = planSync([settled({ localChangedAt: AHEAD })], 'two-way', OWNER)
    expect(plan.actions).toEqual([{ kind: 'push', assetId: 'asset_1' }])
  })

  it('fetches when only the library moved', () => {
    const plan = planSync([settled({ remoteUpdatedAt: AHEAD })], 'two-way', OWNER)
    expect(plan.actions).toEqual([{ kind: 'pull', assetId: 'asset_1', remoteAssetId: 'remote_1' }])
  })

  it('leaves alone what neither side touched', () => {
    expect(planSync([settled()], 'two-way', OWNER).actions).toEqual([
      { kind: 'skip', assetId: 'asset_1', reason: 'nothing-to-do' },
    ])
  })

  it('sends a local-only asset and fetches a cloud-only one', () => {
    const localOnly = settled({
      assetId: 'a',
      remoteAssetId: undefined,
      remoteOwnerId: undefined,
    })
    const cloudOnly = settled({ assetId: 'b', hasLocalFile: false })

    expect(planSync([localOnly, cloudOnly], 'two-way', OWNER).actions).toEqual([
      { kind: 'push', assetId: 'a' },
      { kind: 'pull', assetId: 'b', remoteAssetId: 'remote_1' },
    ])
  })
})

describe('an asset whose twin belongs to another project', () => {
  // A key carries its own project: the same identifier means nothing under a different key.
  const foreign = settled({ remoteOwnerId: 'proj_other', localChangedAt: AHEAD })

  it('is left out of the way, whatever the policy', () => {
    const policies: SyncPolicy[] = ['push', 'pull', 'two-way']
    for (const policy of policies) {
      expect(planSync([foreign], policy, OWNER).actions).toEqual([
        { kind: 'skip', assetId: 'asset_1', reason: 'other-account' },
      ])
    }
  })

  it('is judged normally while no account is active', () => {
    expect(planSync([foreign], 'push', null).actions).toEqual([
      { kind: 'push', assetId: 'asset_1' },
    ])
  })
})

describe('what the confirmation shows', () => {
  it('counts each outcome', () => {
    const plan = planSync(
      [
        settled({ assetId: 'a', localChangedAt: AHEAD }),
        settled({ assetId: 'b' }),
        settled({ assetId: 'c', hasLocalFile: false }),
      ],
      'two-way',
      OWNER,
    )

    expect(plan.summary).toEqual({ push: 1, pull: 1, conflict: 0, skip: 1 })
  })

  it('plans nothing for an empty selection', () => {
    expect(planSync([], 'push', OWNER)).toEqual({
      actions: [],
      summary: { push: 0, pull: 0, conflict: 0, skip: 0 },
    })
  })
})

describe('reading the stamps', () => {
  it('treats a pair that never agreed as moved on both sides', () => {
    // No baseline: the two have never been reconciled, so whatever each holds is new.
    const never = settled({ remoteSyncedAt: undefined })
    expect(planSync([never], 'two-way', OWNER).actions).toEqual([
      { kind: 'conflict', assetId: 'asset_1', remoteAssetId: 'remote_1' },
    ])
  })

  it('refuses to act on a stamp it cannot read', () => {
    // Overwriting a file on the strength of a date nobody can parse is worse than doing nothing.
    const broken = settled({ localChangedAt: 'last thursday' })
    expect(planSync([broken], 'push', OWNER).actions).toEqual([
      { kind: 'skip', assetId: 'asset_1', reason: 'nothing-to-do' },
    ])
  })
})

describe('an asset that is nowhere', () => {
  it('is left alone under two-way: there is nothing to send and nothing to fetch', () => {
    const nowhere = settled({
      hasLocalFile: false,
      remoteAssetId: undefined,
      remoteOwnerId: undefined,
    })

    expect(planSync([nowhere], 'two-way', OWNER).actions).toEqual([
      { kind: 'skip', assetId: 'asset_1', reason: 'no-local-file' },
    ])
  })
})
