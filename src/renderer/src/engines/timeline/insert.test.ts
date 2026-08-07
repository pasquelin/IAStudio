import { describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { clipForAsset, trackForAsset, UNPROBED_DURATION } from './insert'
import { sequenceWith, trackFixture } from './timeline-fixtures'
import { DEFAULT_SETTINGS } from './timeline-state'

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'pad.wav',
  type: 'audio',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

describe('turning an asset into a clip', () => {
  it('takes the probed duration when there is one', () => {
    const probed = asset({ probe: { duration: 8_000_000, codec: 'aac' } })
    expect(clipForAsset('asset-1', probed, 0, DEFAULT_SETTINGS).duration).toBe(8_000_000)
  })

  it('falls back to a usable length for an asset nobody has probed yet', () => {
    expect(clipForAsset('asset-1', null, 0, DEFAULT_SETTINGS).duration).toBe(UNPROBED_DURATION)
  })

  it('lands on the frame grid, wherever it was asked to start', () => {
    expect(clipForAsset('asset-1', null, 39_999, DEFAULT_SETTINGS).start).toBe(40_000)
  })

  it('rounds an odd duration up to whole frames, so its tail stays snappable', () => {
    const odd = asset({ probe: { duration: 3_510_000, codec: 'aac' } })
    expect(clipForAsset('asset-1', odd, 0, DEFAULT_SETTINGS).duration).toBe(3_520_000)
  })

  it('gives every clip its own identity', () => {
    const first = clipForAsset('asset-1', null, 0, DEFAULT_SETTINGS)
    const second = clipForAsset('asset-1', null, 0, DEFAULT_SETTINGS)
    expect(first.id).not.toBe(second.id)
  })
})

describe('choosing a track for an asset', () => {
  const state = sequenceWith([trackFixture('V1', 'video'), trackFixture('A1', 'audio')])

  it('puts sound on a sound track', () => {
    expect(trackForAsset(state, asset())?.id).toBe('A1')
  })

  it('puts a picture on a picture track', () => {
    expect(trackForAsset(state, asset({ type: 'video' }))?.id).toBe('V1')
  })

  it('treats an unknown asset as a picture, which is what the eye expects', () => {
    expect(trackForAsset(state, null)?.id).toBe('V1')
  })

  it('skips a locked track rather than looking like it did nothing', () => {
    const locked = sequenceWith([
      trackFixture('A1', 'audio', [], { locked: true }),
      trackFixture('A2', 'audio'),
    ])
    expect(trackForAsset(locked, asset())?.id).toBe('A2')
  })

  it('skips a muted track for the same reason', () => {
    const muted = sequenceWith([
      trackFixture('A1', 'audio', [], { muted: true }),
      trackFixture('A2', 'audio'),
    ])
    expect(trackForAsset(muted, asset())?.id).toBe('A2')
  })

  it('falls back to whatever track is usable when none matches the kind', () => {
    const pictureOnly = sequenceWith([trackFixture('V1', 'video')])
    expect(trackForAsset(pictureOnly, asset())?.id).toBe('V1')
  })

  it('answers nothing when every track refuses', () => {
    const shut = sequenceWith([trackFixture('V1', 'video', [], { locked: true })])
    expect(trackForAsset(shut, asset())).toBeNull()
  })
})
