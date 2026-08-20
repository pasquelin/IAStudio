import { escapeXml } from '@shared/domain/xmlText'
import type { SequenceState, Track } from './timelineState'
import { clipEnd, playsThrough, sequenceDuration } from './timelineState'

/**
 * FCPXML — what Final Cut Pro reads, and what Premiere and Resolve take as an interchange.
 *
 * Unlike an EDL it keeps the TRACKS: a `spine` for the picture and a `lane` per row beside it,
 * which is how the format spells a stack. What it does not keep is what only this studio composes
 * — the fades, the gains, the links — so those are declared rather than written badly.
 *
 * Times are rationals in SECONDS, spelled `<numerator>/<denominator>s`, and the denominator is
 * the frame rate: `120/25s` is frame 120 of a 25 fps sequence. Writing a decimal instead is the
 * classic way to make a cut land a frame off, so nothing here ever divides.
 */

/** The version every reader since 2019 takes, and the oldest one this writes for. */
const FCPXML_VERSION = '1.9'

/**
 * Microseconds as the format's own rational. The numerator counts FRAMES times the microseconds
 * one frame lasts — never a division, so a time that falls between frames rounds once, here.
 */
function rationalOf(time: number, fps: number): string {
  const frames = Math.max(0, Math.round((time * fps) / 1_000_000))
  return `${frames}/${fps}s`
}

type Media = { id: string; name: string; assetId: string; used: number }

/**
 * One `asset` per rush the cut names, however many clips point at it. `used` is how far into the
 * rush the cut reaches — the format wants a duration, and this is the only one the studio knows.
 */
function mediaOf(state: SequenceState, nameOf: (assetId: string) => string): Media[] {
  const seen = new Map<string, Media>()
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      if (!clip.assetId) continue

      const held = seen.get(clip.assetId)
      const reach = clip.inPoint + clip.duration
      if (held) held.used = Math.max(held.used, reach)
      else
        seen.set(clip.assetId, {
          id: `r${seen.size + 1}`,
          name: nameOf(clip.assetId),
          assetId: clip.assetId,
          used: reach,
        })
    }
  }
  return [...seen.values()]
}

function clipsIn(
  track: Track,
  audible: boolean,
  lane: number,
  fps: number,
  byAsset: Map<string, Media>,
): string[] {
  // `enabled` is the one place the format has the switch, and a clip carries no mute of its own.
  const enabled = audible ? '1' : '0'

  return track.clips.flatMap(clip => {
    const media = byAsset.get(clip.assetId)
    // A clip drawing a live scene has no asset and no `asset-clip` to be: the format names a
    // file, and there is none to name.
    if (!media) return []

    return [
      `        <asset-clip ref="${media.id}" lane="${lane}" offset="${rationalOf(clip.start, fps)}"` +
        ` name="${escapeXml(media.name)}" start="${rationalOf(clip.inPoint, fps)}"` +
        ` duration="${rationalOf(clipEnd(clip) - clip.start, fps)}" enabled="${enabled}"/>`,
    ]
  })
}

/**
 * One rush declared. `media-rep` is what points at the FILE — an `asset` without one names a
 * clip a reader shows offline, with no path to relink from.
 */
function assetIn(media: Media, fps: number, url: string | null): string[] {
  const head =
    `    <asset id="${media.id}" name="${escapeXml(media.name)}" start="0s"` +
    ` duration="${rationalOf(media.used, fps)}" hasVideo="1" hasAudio="1"`

  return url
    ? [
        `${head}>`,
        `      <media-rep kind="original-media" src="${escapeXml(url)}"/>`,
        '    </asset>',
      ]
    : [`${head}/>`]
}

/**
 * The cut as one `project`, in one `event`, in one `library` — the three the format nests, none
 * of which the studio has a notion of. They are written because a reader refuses a file without
 * them, and they carry the document's own name so nothing arrives called `untitled`.
 */
export function fcpxmlOf(
  state: SequenceState,
  title: string,
  nameOf: (assetId: string) => string,
  /**
   * Where the rush sits, as a url. Without it a reader has a name and no file, so every shot
   * arrives offline with nothing to relink from — which is `mediaLink`, declared carried.
   */
  urlOf: (assetId: string) => string | null,
): string {
  const { fps, width, height } = state.settings
  const media = mediaOf(state, nameOf)
  const byAsset = new Map(media.map(one => [one.assetId, one]))
  const name = escapeXml(title)

  const duration = rationalOf(sequenceDuration(state), fps)

  // Lane 0 is the spine — the picture row every reader draws first — and the rows beside it count
  // up from 1. The studio holds its tracks top first, which is the order the lanes run in.
  // The RESULT of the two switches, never `muted` alone — a solo elsewhere silences this row, and
  // that is what another application is told. Read here, as `otioTimeline` reads it.
  const lanes = state.tracks.flatMap((track, row) =>
    clipsIn(track, playsThrough(state, track), row, fps, byAsset),
  )

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<fcpxml version="${FCPXML_VERSION}">`,
    '  <resources>',
    `    <format id="r0" name="FFVideoFormat" frameDuration="1/${fps}s"` +
      ` width="${width}" height="${height}"/>`,
    ...media.flatMap(one => assetIn(one, fps, urlOf(one.assetId))),
    '  </resources>',
    `  <library name="${name}">`,
    `    <event name="${name}">`,
    `      <project name="${name}">`,
    `        <sequence format="r0" duration="${duration}" tcStart="0s">`,
    '        <spine>',
    ...lanes,
    '        </spine>',
    '        </sequence>',
    '      </project>',
    '    </event>',
    '  </library>',
    '</fcpxml>',
    '',
  ].join('\n')
}
