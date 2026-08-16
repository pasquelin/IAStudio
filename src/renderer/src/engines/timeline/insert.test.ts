import { describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import {
  clipForAsset,
  newTracksForAsset,
  opensTrackFor,
  placementsForAsset,
  trackForAsset,
  TIMELESS_DURATION,
} from './insert'
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
    expect(clipForAsset('asset-1', null, 0, DEFAULT_SETTINGS).duration).toBe(TIMELESS_DURATION)
  })

  it('gives a still the same usable length, though it probes as zero', () => {
    const still = asset({ type: 'image', probe: { duration: 0, codec: 'png' } })
    expect(clipForAsset('asset-1', still, 0, DEFAULT_SETTINGS).duration).toBe(TIMELESS_DURATION)
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

  /**
   * It used to fall back to whatever track was free, which put sounds on picture tracks: the
   * monitor paints those and `audioChunksIn` schedules none of them, so the take was invisible
   * and silent at once. Refusing says so; landing somewhere useless does not.
   */
  it('answers nothing rather than putting a sound on a picture track', () => {
    const pictureOnly = sequenceWith([trackFixture('V1', 'video')])
    expect(trackForAsset(pictureOnly, asset())).toBeNull()
  })

  it('answers nothing when every track refuses', () => {
    const shut = sequenceWith([trackFixture('V1', 'video', [], { locked: true })])
    expect(trackForAsset(shut, asset())).toBeNull()
  })
})

describe('laying an asset down', () => {
  const state = sequenceWith([trackFixture('V1', 'video'), trackFixture('A1', 'audio')])
  const take = (channels?: number): Asset =>
    asset({
      type: 'video',
      name: 'take.mp4',
      probe: { duration: 5_000_000, codec: 'h264', ...(channels ? { channels } : {}) },
    })

  /**
   * A take is a picture AND a sound. Laid down as one clip on a picture track, its sound was
   * simply never scheduled — `audioChunksIn` only reads sound tracks — so a rush with dialogue
   * played mute and nothing on screen said why.
   */
  it('lays a take that carries a sound as two clips, tied together', () => {
    const [picture, sound, ...rest] = placementsForAsset(state, take(2), 'asset-1', 0, 'V1')

    expect(picture?.trackId).toBe('V1')
    expect(sound?.trackId).toBe('A1')
    expect(rest).toEqual([])
    expect(picture?.clip.linkId).toBe(sound?.clip.linkId)
    expect(picture?.clip.linkId).toBeTruthy()
    // Two clips, never one clip laid twice: every lookup is by id, starting with selection.
    expect(picture?.clip.id).not.toBe(sound?.clip.id)
  })

  it('lays a silent take as the one clip there is something to show for', () => {
    expect(placementsForAsset(state, take(), 'asset-1', 0, 'V1')).toHaveLength(1)
  })

  it('leaves a sound alone: there is no picture to tie it to', () => {
    const [placed, ...rest] = placementsForAsset(state, asset(), 'asset-1', 0, 'A1')

    expect(placed?.trackId).toBe('A1')
    expect(placed?.clip.linkId).toBeUndefined()
    expect(rest).toEqual([])
  })

  /**
   * The pointer decides WHERE within a kind, never the kind itself: a rush dropped on a sound
   * track was laid there whole, where the monitor cannot paint it and the output cannot read it.
   */
  it('sends a take to a picture track even when a sound track was aimed at', () => {
    const [picture] = placementsForAsset(state, take(2), 'asset-1', 0, 'A1')
    expect(picture?.trackId).toBe('V1')
  })

  // A muted track accepted under the pointer and skipped when chosen for the drop would be two
  // rules for one question — and the drop would land where nothing plays it.
  it('refuses a silenced track even when the pointer landed on it', () => {
    const muted = sequenceWith([
      trackFixture('V1', 'video', [], { muted: true }),
      trackFixture('V2', 'video', [], { index: 2 }),
    ])
    const [picture] = placementsForAsset(muted, take(), 'asset-1', 0, 'V1')

    expect(picture?.trackId).toBe('V2')
  })
})

describe('the rows a drop below the last track opens', () => {
  const montage = sequenceWith([trackFixture('V1', 'video'), trackFixture('A1', 'audio')])
  const soundMontage = sequenceWith([trackFixture('A1', 'audio'), trackFixture('A2', 'audio')])
  const take = (channels?: number): Asset =>
    asset({
      type: 'video',
      probe: { duration: 5_000_000, codec: 'h264', ...(channels ? { channels } : {}) },
    })

  it('opens a picture row and the sound row beside it for a take that carries a sound', () => {
    expect(newTracksForAsset(montage, take(2))).toEqual(['video', 'audio'])
  })

  it('opens only a picture row for a silent take', () => {
    expect(newTracksForAsset(montage, take())).toEqual(['video'])
  })

  it('opens a sound row for a sound', () => {
    expect(newTracksForAsset(montage, asset())).toEqual(['audio'])
  })

  /**
   * The Audio workspace opens on sound tracks alone so a rush lands nowhere rather than being
   * montaged into a space with no monitor to show it. Opening a picture row on demand would go
   * behind that decision — silently, since a clip on it would look laid down.
   */
  it('opens nothing for a rush over a montage that holds no picture row', () => {
    expect(newTracksForAsset(soundMontage, take(2))).toEqual([])
  })

  it('still opens a sound row there: every montage plays one', () => {
    expect(newTracksForAsset(soundMontage, asset())).toEqual(['audio'])
  })

  // Read during the drag, where only the announced TYPE is legible: this is what decides whether
  // the strip consumes the drop or leaves the shell to answer it by opening the asset.
  it('answers for a kind alone, and takes an unannounced drag rather than refusing it', () => {
    expect(opensTrackFor(soundMontage, 'video')).toBe(false)
    expect(opensTrackFor(soundMontage, 'audio')).toBe(true)
    expect(opensTrackFor(montage, 'video')).toBe(true)
    expect(opensTrackFor(soundMontage, null)).toBe(true)
  })
})
