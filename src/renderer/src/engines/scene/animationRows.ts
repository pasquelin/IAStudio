/**
 * The rows a scene's animation shows, the way a dope sheet lays them out: one line per SUBJECT —
 * an object, or one bone of a rig — and its channels folded underneath.
 *
 * The document holds none of this. It holds tracks, one per property, and that is the right shape
 * to evaluate: what a subject line adds is a way to READ them, which is why it is derived here
 * rather than stored. Folding a subject away must never lose a key.
 */
import type { AnimationTimeline, AnimationTrack } from '@shared/domain/animation'
import { reconcileOrder } from '@shared/domain/order'
import type { Us } from '@shared/domain/time'
import { ROW_PADDING } from '../timeline/timelineGeometry'

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

/**
 * One lane of a subject's track, and the blocks laid along it — Blender's NLA rather than its
 * dope sheet.
 *
 * A lane holds SEVERAL blocks, each with a length, which is why it is a row of its own rather
 * than a channel: what it draws is bars one drags, not diamonds. Lanes stack, and two of them
 * play at once.
 */
export type LaneRow = {
  kind: 'lane'
  id: string
  name: string
  height: number
  nodeId: string
  laneId: string
  /** The last lane of its object offers to add one after it, and it alone: adding is one action. */
  last: boolean
  blocks: readonly ClipBlock[]
}

export type AnimationRow = SubjectRow | ChannelRow | LaneRow

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

/** A model playing a clip, as the document holds it and the engine measured it. */
export type ClipBlock = {
  clipId: string
  name: string
  start: Us
  /** How long the block runs on the band, at the speed it plays. */
  duration: Us
}

/** One lane of one model, as the panel hands it over: the document's layering, measured. */
export type SheetLane = {
  nodeId: string
  laneId: string
  name: string
  blocks: readonly ClipBlock[]
}

/** An object of the scene, as the sheet needs to name a line for it. */
export type SheetNode = {
  id: string
  name: string
}

/**
 * The subjects in the order the sheet shows them: the arrangement the user made first, then
 * whatever the scene has added since, in the order the scene holds it.
 *
 * The arrangement is a WAY OF WORKING and nothing else — objects one returns to are brought to
 * the top. It never touches the scene: the outliner keeps its own order, and an object moved here
 * stays exactly where the hierarchy put it.
 */
export function orderedSubjects(
  natural: readonly string[],
  preferred: readonly string[],
): string[] {
  const known = new Set(natural)
  // `reconcileOrder` rather than appending the newcomers at the end, and the difference is what
  // one SEES: an object added to the scene lands under the neighbours the hierarchy already gives
  // it, instead of at the bottom of a sheet somebody has arranged. Its header says as much — this
  // reconciliation had already been written twice before it was named.
  return reconcileOrder(
    preferred.filter(id => known.has(id)),
    natural,
    id => id,
  )
}

/**
 * The same list with one entry moved by that many places. Clamped at both ends rather than
 * wrapping: a row dragged past the top has arrived, it has not gone to the bottom.
 */
export function movedWithin(ids: readonly string[], id: string, by: number): readonly string[] {
  const from = ids.indexOf(id)
  if (from === -1 || by === 0) return ids

  const to = Math.min(Math.max(from + by, 0), ids.length - 1)
  // The SAME array back when nothing moved — a line dragged against the top is asked to move on
  // every step of the gesture, and a fresh array each time rebuilds the whole sheet for nothing.
  if (to === from) return ids

  const moved = [...ids]
  moved.splice(from, 1)
  moved.splice(to, 0, id)
  return moved
}

export type RowsOptions = {
  /**
   * The objects on stage, in outliner order. EVERY one gets a line, keyed or not: a scene's
   * objects already exist, so a band that showed only those with a track made a person create
   * something before they could see anything — which is the whole reason the old panel read as
   * empty while a cube stood in the viewport.
   */
  nodes: readonly SheetNode[]
  /** Which subjects are unfolded. Absent from the set means folded, so a new one arrives folded. */
  expanded: ReadonlySet<string>
  /**
   * The lanes on stage. Their blocks come from the ENGINE, not the timeline: a clip's length
   * lives in the GLB, so nothing that reads only the document can know how long a block runs.
   */
  lanes?: readonly SheetLane[]
  /** How the user has arranged the lines. Empty leaves the scene's own order — see `orderedSubjects`. */
  order?: readonly string[]
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

  const named = new Map(options.nodes.map(node => [node.id, node.name]))
  const rows: AnimationRow[] = []

  const lanesOfNode = new Map<string, SheetLane[]>()
  for (const lane of options.lanes ?? []) {
    const found = lanesOfNode.get(lane.nodeId)
    if (found) found.push(lane)
    else lanesOfNode.set(lane.nodeId, [lane])
  }

  /** The objects first, in the order the scene holds them, then the bones keyed inside them. */
  const natural = [
    ...options.nodes.map(node => node.id),
    ...[...grouped.keys()].filter(key => !named.has(key)),
  ]
  const order = orderedSubjects(natural, options.order ?? [])

  for (const key of order) {
    const tracks = grouped.get(key) ?? []
    const bone = tracks[0]?.target.bone
    const plain = named.get(bone ? (tracks[0]?.target.nodeId ?? key) : key) ?? key

    const expanded = options.expanded.has(key)

    rows.push({
      kind: 'subject',
      id: key,
      name: bone ? `${plain} · ${bone}` : plain,
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

    // The lanes of the object come under its channels, INSIDE the same unfolded track: what a
    // subject moves and what it plays belong to one thing, and a run of lanes at the foot of the
    // sheet said the opposite. A bone subject has none — a lane plays a whole rig at once.
    const lanes = lanesOfNode.get(key) ?? []
    for (const [rank, lane] of lanes.entries()) {
      rows.push({
        kind: 'lane',
        id: laneKey(lane.nodeId, lane.laneId),
        name: lane.name,
        height: CHANNEL_HEIGHT,
        nodeId: lane.nodeId,
        laneId: lane.laneId,
        last: rank === lanes.length - 1,
        blocks: lane.blocks,
      })
    }
  }

  return rows
}

/** How a lane row is named, and what a hit test hands back — one spelling for both. */
export function laneKey(nodeId: string, laneId: string): string {
  return `lane:${nodeId}:${laneId}`
}

/** The row a click lands on, folded or not, so a caller never walks the list a second time. */
export function trackIdsOf(row: AnimationRow): string[] {
  if (row.kind === 'subject') return row.tracks.map(track => track.id)
  if (row.kind === 'channel') return [row.track.id]
  // A lane drives no channel: it plays clips the file brought.
  return []
}
