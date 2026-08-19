import type { SequenceState, Track } from './timelineState'
import { clipEnd } from './timelineState'

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

const escaped = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Microseconds as the format's own rational. The numerator counts FRAMES times the microseconds
 * one frame lasts — never a division, so a time that falls between frames rounds once, here.
 */
function rationalOf(time: number, fps: number): string {
  const frames = Math.max(0, Math.round((time * fps) / 1_000_000))
  return `${frames}/${fps}s`
}

type Media = { id: string; name: string; assetId: string }

/** One `asset` per rush the cut names, however many clips point at it. */
function mediaOf(state: SequenceState, nameOf: (assetId: string) => string): Media[] {
  const seen = new Map<string, Media>()
  for (const track of state.tracks) {
    for (const clip of track.clips) {
      if (!clip.assetId || seen.has(clip.assetId)) continue
      seen.set(clip.assetId, {
        id: `r${seen.size + 1}`,
        name: nameOf(clip.assetId),
        assetId: clip.assetId,
      })
    }
  }
  return [...seen.values()]
}

function clipsIn(track: Track, lane: number, fps: number, byAsset: Map<string, Media>): string[] {
  // The track's own switch, which is the only one the format has a place for: a clip carries no
  // mute of its own here, and `enabled` is what a reader draws greyed.
  const enabled = track.muted ? '0' : '1'

  return track.clips.flatMap(clip => {
    const media = byAsset.get(clip.assetId)
    // A clip drawing a live scene has no asset and no `asset-clip` to be: the format names a
    // file, and there is none to name.
    if (!media) return []

    return [
      `        <asset-clip ref="${media.id}" lane="${lane}" offset="${rationalOf(clip.start, fps)}"` +
        ` name="${escaped(media.name)}" start="${rationalOf(clip.inPoint, fps)}"` +
        ` duration="${rationalOf(clipEnd(clip) - clip.start, fps)}" enabled="${enabled}"/>`,
    ]
  })
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
): string {
  const { fps, width, height } = state.settings
  const media = mediaOf(state, nameOf)
  const byAsset = new Map(media.map(one => [one.assetId, one]))
  const name = escaped(title)

  const duration = rationalOf(
    Math.max(0, ...state.tracks.flatMap(track => track.clips.map(clipEnd))),
    fps,
  )

  // Lane 0 is the spine — the picture row every reader draws first — and the rows beside it count
  // up from 1. The studio holds its tracks top first, which is the order the lanes run in.
  const lanes = state.tracks.flatMap((track, row) => clipsIn(track, row, fps, byAsset))

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<fcpxml version="${FCPXML_VERSION}">`,
    '  <resources>',
    `    <format id="r0" name="FFVideoFormat" frameDuration="1/${fps}s"` +
      ` width="${width}" height="${height}"/>`,
    ...media.map(
      one =>
        `    <asset id="${one.id}" name="${escaped(one.name)}" start="0s" hasVideo="1"` +
        ' hasAudio="1"/>',
    ),
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
