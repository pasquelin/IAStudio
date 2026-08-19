import { describe, expect, it } from 'vitest'
import type { OtioClip, OtioTimeRange, OtioTimeline, OtioTrack, OtioTrackItem } from './otio'
import { bundleOf, OTIOZ_VERSION } from './otioz'

const FIVE_SECONDS: OtioTimeRange = {
  OTIO_SCHEMA: 'TimeRange.1',
  start_time: { OTIO_SCHEMA: 'RationalTime.1', rate: 25, value: 0 },
  duration: { OTIO_SCHEMA: 'RationalTime.1', rate: 25, value: 125 },
}

const clip = (name: string, url: string | null): OtioClip => ({
  OTIO_SCHEMA: 'Clip.1',
  name,
  metadata: {},
  source_range: FIVE_SECONDS,
  effects: [],
  markers: [],
  enabled: true,
  media_reference:
    url === null
      ? { OTIO_SCHEMA: 'MissingReference.1', name, metadata: {}, available_range: null }
      : {
          OTIO_SCHEMA: 'ExternalReference.1',
          name,
          metadata: {},
          available_range: null,
          target_url: url,
        },
})

const timelineOf = (...items: OtioTrackItem[]): OtioTimeline => {
  const track: OtioTrack = {
    OTIO_SCHEMA: 'Track.1',
    name: 'V1',
    metadata: {},
    kind: 'Video',
    children: items,
    source_range: null,
    effects: [],
    markers: [],
    enabled: true,
  }

  return {
    OTIO_SCHEMA: 'Timeline.1',
    name: 'Montage',
    metadata: {},
    global_start_time: null,
    tracks: {
      OTIO_SCHEMA: 'Stack.1',
      name: 'tracks',
      metadata: {},
      children: [track],
      source_range: null,
      effects: [],
      markers: [],
      enabled: true,
    },
  }
}

const urlsIn = (timeline: OtioTimeline): (string | null)[] =>
  timeline.tracks.children.flatMap(track =>
    track.children.map(item =>
      item.OTIO_SCHEMA === 'Clip.1' && item.media_reference.OTIO_SCHEMA === 'ExternalReference.1'
        ? item.media_reference.target_url
        : null,
    ),
  )

describe('what a bundle points at', () => {
  it('rewrites a clip onto a bare relative path inside the bundle', () => {
    const { timeline } = bundleOf(timelineOf(clip('plan', 'file:///Projet/Video/plan.mp4')))

    expect(urlsIn(timeline)).toEqual(['media/plan.mp4'])
  })

  it('lists each source once, however many clips cut from it', () => {
    const { media } = bundleOf(
      timelineOf(
        clip('a', 'file:///Projet/Video/rush.mp4'),
        clip('b', 'file:///Projet/Video/rush.mp4'),
        clip('c', 'file:///Projet/Video/rush.mp4'),
      ),
    )

    expect(media).toEqual([{ source: 'file:///Projet/Video/rush.mp4', entry: 'media/rush.mp4' }])
  })

  it('leaves a live scene alone, which names no file to carry', () => {
    const { timeline, media } = bundleOf(timelineOf(clip('scene', null)))

    expect(urlsIn(timeline)).toEqual([null])
    expect(media).toEqual([])
  })

  it('decodes an escaped name, which is what the file is called on disk', () => {
    const { media } = bundleOf(timelineOf(clip('a', 'file:///Projet/Video/prise%20deux.mp4')))

    expect(media.map(one => one.entry)).toEqual(['media/prise deux.mp4'])
  })
})

describe('two media that share a name, which the reference implementation does not handle', () => {
  const twoFolders = timelineOf(
    clip('a', 'file:///Projet/A/plan.mp4'),
    clip('b', 'file:///Projet/B/plan.mp4'),
  )

  it('gives the second one an entry of its own rather than overwriting the first', () => {
    const { media } = bundleOf(twoFolders)

    expect(media.map(one => one.entry)).toEqual(['media/plan.mp4', 'media/plan-2.mp4'])
  })

  it('suffixes before the dot, so an importer still reads the format off the extension', () => {
    expect(bundleOf(twoFolders).media[1]?.entry.endsWith('.mp4')).toBe(true)
  })

  it('keeps each clip pointing at its own file', () => {
    expect(urlsIn(bundleOf(twoFolders).timeline)).toEqual(['media/plan.mp4', 'media/plan-2.mp4'])
  })

  it('goes on past a second collision', () => {
    const three = timelineOf(
      clip('a', 'file:///A/plan.mp4'),
      clip('b', 'file:///B/plan.mp4'),
      clip('c', 'file:///C/plan.mp4'),
    )

    expect(bundleOf(three).media.map(one => one.entry)).toEqual([
      'media/plan.mp4',
      'media/plan-2.mp4',
      'media/plan-3.mp4',
    ])
  })
})

describe('the version the format states', () => {
  it('carries no trailing newline, which is what a reference bundle holds', () => {
    expect(OTIOZ_VERSION).toBe('1.0.0')
    expect(OTIOZ_VERSION).not.toMatch(/\s/)
  })
})
