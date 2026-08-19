import { describe, expect, it } from 'vitest'
import type { OtioClip, OtioTimeRange, OtioTimeline, OtioTrack, OtioTrackItem } from './otio'
import { bundleEntryOf, bundleOf, freeName, isBundleEntry, OTIOZ_VERSION, safeName } from './otioz'

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

describe('what the writing side accepts as an entry', () => {
  it('takes one plain name under the media folder', () => {
    expect(isBundleEntry('media/plan.mp4')).toBe(true)
    expect(isBundleEntry('media/prise deux.mp4')).toBe(true)
  })

  /**
   * The studio EMITS this file and hands it to somebody else, so a climbing entry is a zip-slip
   * archive of its own making — worse than opening one.
   */
  it('refuses an entry that would climb out of the bundle', () => {
    expect(isBundleEntry('media/../../.bashrc')).toBe(false)
    expect(isBundleEntry('media/sub/plan.mp4')).toBe(false)
    expect(isBundleEntry('media/..')).toBe(false)
    expect(isBundleEntry('media/')).toBe(false)
  })

  it('refuses an entry that sits anywhere but the media folder', () => {
    expect(isBundleEntry('content.otio')).toBe(false)
    expect(isBundleEntry('plan.mp4')).toBe(false)
    expect(isBundleEntry('medias/plan.mp4')).toBe(false)
  })

  it('refuses a backslash, which a reader on another system reads as a separator', () => {
    expect(isBundleEntry('media/..\\..\\plan.mp4')).toBe(false)
  })

  it('accepts every entry it composes itself, which is what makes the pair hold', () => {
    const { media } = bundleOf(
      timelineOf(clip('a', 'file:///A/plan.mp4'), clip('b', 'file:///B/plan.mp4')),
    )

    expect(media.map(one => isBundleEntry(one.entry))).toEqual([true, true])
  })

  it('flattens a url that spells a separator into its own name', () => {
    const { media } = bundleOf(timelineOf(clip('a', 'file:///A/odd%2F..%2Fname.mp4')))

    expect(media.every(one => isBundleEntry(one.entry))).toBe(true)
  })
})

/**
 * THREE answers, not two. « is not a medium » and « climbs out » were one refusal, and every
 * `zip -r` bundle was hostile for it: that command writes a `media/` directory entry.
 */
describe('what a reader is to do with one entry', () => {
  it('takes a plain name under the media folder as the medium it claims to be', () => {
    expect(bundleEntryOf('media/plan.mp4')).toEqual({ kind: 'medium', name: 'plan.mp4' })
  })

  it('ignores the folder markers an archiver writes beside the media', () => {
    expect(bundleEntryOf('media/').kind).toBe('ignored')
    expect(bundleEntryOf('media/rushes/').kind).toBe('ignored')
  })

  it('ignores what claims to be no medium at all, rather than refusing the bundle', () => {
    expect(bundleEntryOf('content.otio').kind).toBe('ignored')
    expect(bundleEntryOf('notes/readme.txt').kind).toBe('ignored')
    expect(bundleEntryOf('medias/plan.mp4').kind).toBe('ignored')
  })

  it('calls hostile what would land outside the folder it is unpacked into', () => {
    expect(bundleEntryOf('media/../../.bashrc').kind).toBe('hostile')
    expect(bundleEntryOf('media/sub/plan.mp4').kind).toBe('hostile')
    expect(bundleEntryOf('media/..').kind).toBe('hostile')
    expect(bundleEntryOf('media/..\\..\\plan.mp4').kind).toBe('hostile')
  })
})

describe('a name a file system will take', () => {
  /** `CON.mp4` IS the console on Win32, whatever the extension — and the pipeline builds there. */
  it('moves a Win32 device name out of the way, extension and all', () => {
    expect(safeName('CON.mp4')).toBe('_CON.mp4')
    expect(safeName('nul')).toBe('_nul')
    expect(safeName('com1.wav')).toBe('_com1.wav')
  })

  it('leaves a name that merely starts like one alone', () => {
    expect(safeName('console.mp4')).toBe('console.mp4')
    expect(safeName('lpt10.mp4')).toBe('lpt10.mp4')
  })

  /** Win32 trims both silently, which turns two entries of an archive into one file on disk. */
  it('trims a trailing dot or space rather than letting the system do it', () => {
    expect(safeName('plan.mp4 ')).toBe('plan.mp4')
    expect(safeName('plan.mp4.')).toBe('plan.mp4')
  })

  it('suffixes before the dot, so the extension a reader looks at survives', () => {
    expect(freeName('plan.mp4', new Set(['plan.mp4']))).toBe('plan-2.mp4')
  })
})

describe('the version the format states', () => {
  it('carries no trailing newline, which is what a reference bundle holds', () => {
    expect(OTIOZ_VERSION).toBe('1.0.0')
    expect(OTIOZ_VERSION).not.toMatch(/\s/)
  })
})
