/**
 * The rows a scene's animation shows, the way a dope sheet lays them out: one line per SUBJECT —
 * an object, or one bone of a rig — and its channels folded underneath.
 *
 * The document holds none of this. It holds tracks, one per property, and that is the right shape
 * to evaluate: what a subject line adds is a way to READ them, which is why it is derived here
 * rather than stored. Folding a subject away must never lose a key.
 */
import type { AnimationTimeline, AnimationTrack } from '@shared/domain/animation'
import type { Us } from '@shared/domain/time'

/** One object, or one bone of one object. Its channels are the tracks that drive it. */
export type Subject = {
  nodeId: string
  bone?: string
}

export type SubjectRow = {
  kind: 'subject'
  /** Stable across a fold, and what the expanded set holds — see `subjectKey`. */
  id: string
  name: string
  subject: Subject
  height: number
  expanded: boolean
  /** Every key of every channel, merged and deduplicated: what the folded line shows. */
  keys: readonly Us[]
  tracks: readonly AnimationTrack[]
}

export type ChannelRow = {
  kind: 'channel'
  id: string
  name: string
  height: number
  track: AnimationTrack
}

export type AnimationRow = SubjectRow | ChannelRow

/**
 * Row heights, in pixels, and they are DERIVED from what the header column must hold rather
 * than chosen: a name on one line, then a row of `--sc-control` buttons under it, plus padding.
 *
 * This is the arithmetic the old panel got wrong in the other direction — it laid six buttons
 * BESIDE a name in a 140 px column, leaving the name zero pixels wide. A height that cannot
 * hold its own controls is the same defect turned ninety degrees.
 *
 * Fixed rather than read from the density gauge because the canvas cannot read a CSS variable;
 * both densities (24 px and 28 px controls) fit inside these.
 */
const CONTROL_ROW = 28
const NAME_ROW = 16
const ROW_PADDING = 4

export const SUBJECT_HEIGHT = NAME_ROW + CONTROL_ROW + ROW_PADDING

/** A channel shows a name and one button, side by side — so one control row is enough. */
export const CHANNEL_HEIGHT = CONTROL_ROW + ROW_PADDING

/**
 * Which subject a track belongs to. A bone is addressed by name because it lives inside the
 * file, so the pair is what identifies a line — see `TrackTarget`.
 */
export function subjectKey(subject: Subject): string {
  return subject.bone ? `${subject.nodeId}/${subject.bone}` : subject.nodeId
}

/** Every instant any of these tracks holds a key at, once each, in order. */
export function mergedKeys(tracks: readonly AnimationTrack[]): Us[] {
  const times = new Set<Us>()
  for (const track of tracks) {
    for (const key of track.keys) times.add(key.time)
  }
  return [...times].sort((left, right) => left - right)
}

export type RowsOptions = {
  /** What an object is called. The tracks carry composed names; a subject wants the plain one. */
  nameOf: (nodeId: string) => string
  /** Which subjects are unfolded. Absent from the set means folded, so a new one arrives folded. */
  expanded: ReadonlySet<string>
}

/**
 * The rows to draw, top to bottom.
 *
 * Subjects come in the order their first track does, so adding a track to an object already on
 * screen never makes the rows jump — the alternative, sorting by name, reorders the whole sheet
 * the moment an object is renamed.
 */
export function animationRows(timeline: AnimationTimeline, options: RowsOptions): AnimationRow[] {
  const grouped = new Map<string, AnimationTrack[]>()

  for (const track of timeline.tracks) {
    const key = subjectKey(track.target)
    const found = grouped.get(key)
    if (found) found.push(track)
    else grouped.set(key, [track])
  }

  const rows: AnimationRow[] = []

  for (const [key, tracks] of grouped) {
    const first = tracks[0]
    if (!first) continue

    const expanded = options.expanded.has(key)
    const plain = options.nameOf(first.target.nodeId)

    rows.push({
      kind: 'subject',
      id: key,
      name: first.target.bone ? `${plain} · ${first.target.bone}` : plain,
      subject: { nodeId: first.target.nodeId, bone: first.target.bone },
      height: SUBJECT_HEIGHT,
      expanded,
      keys: mergedKeys(tracks),
      tracks,
    })

    if (!expanded) continue

    for (const track of tracks) {
      rows.push({
        kind: 'channel',
        id: track.id,
        name: track.name,
        height: CHANNEL_HEIGHT,
        track,
      })
    }
  }

  return rows
}

/** The row a click lands on, folded or not, so a caller never walks the list a second time. */
export function trackIdsOf(row: AnimationRow): string[] {
  return row.kind === 'subject' ? row.tracks.map(track => track.id) : [row.track.id]
}
